import { connectorStore } from './connector-store';
import { operatingSummary } from './operating-summary';
import { team } from './team';
import { hourlyJobLimit, internalAutonomyEnabled } from './autonomy';
import { serviceChecks } from './monitoring';
import { planningStore } from './planning-store';
import { InboxWatch } from './inbox-watch';
import { DiscordService } from './discord-service';
import { registerApiRoute, type MiddlewareHandler } from '@mastra/core/server';
import { z } from 'zod';
import {
  operationsStore,
  preferenceInput,
  suggestionInput,
} from './operations-store';
import { projectStore } from './project-store';
import { departments, roleCatalog } from './catalog';
import { defaultAgentModel, modelProfiles } from './model-policy';
import { eventStore } from './event-store';
export function operationsRoutes(guard: MiddlewareHandler) {
  const wrap = (fn: (c: any) => Promise<any>) => async (c: any) => {
    try {
      return await fn(c);
    } catch (e) {
      return c.json(
        {
          error:
            e instanceof z.ZodError
              ? 'Check the supplied fields.'
              : e instanceof Error
                ? e.message
                : 'Operation failed',
        },
        e instanceof z.ZodError ? 400 : 409,
      );
    }
  };
  const validAgent = (c: any, id: string) => {
    if (!c.get('mastra').listAgents()[id]) throw Error('Agent not found');
  };
  async function frame(c: any) {
    await projectStore().init();
    const definitions = Object.entries(c.get('mastra').listAgents()).map(
      ([id, a]: [string, any]) => ({
        id,
        name: a.name ?? id,
        department:
          id === 'agent'
            ? 'executive'
            : id === 'operations-monitor'
              ? 'operations'
              : (team[id as keyof typeof team]?.department ?? roleCatalog[id as keyof typeof roleCatalog]?.department ??
                (id in departments ? id : 'executive')),
        model: defaultAgentModel(id),
      }),
    );
    const snapshot = await operationsStore().snapshot(definitions);
    const plans = await planningStore().list();
    for (const task of snapshot.tasks) {
      const scope = plans.find(p=>p.work.some((m:any)=>m.taskId===task.id));
      const work = scope?.work.find((m:any)=>m.taskId===task.id);
      const milestone=scope?.payload.milestones.find((m:any)=>m.key===work?.key);
      if (milestone) task.blockedBy=milestone.after.filter((key:string)=>!scope!.work.some((m:any)=>m.key===key&&m.status==='completed'));
      if (milestone && !task.plan) task.plan={priority:scope.payload.priority||'normal',estimate_minutes:milestone.estimateMinutes,due_at:null,next_step:milestone.objective,target_date:milestone.targetDate};
    }
    const revision = String(
      (
        await eventStore().pool.query(
          'SELECT COALESCE(max(id),0) AS id FROM ascendxi_events',
        )
      ).rows[0].id,
    );
    const capacity = (await eventStore().pool.query("SELECT count(*)::int AS used,min(created_at)+interval '1 hour' AS next_at FROM ascendxi_events WHERE created_at>now()-interval '1 hour' AND(kind='ai.job.reserved' OR(kind='task.started' AND data->>'jobId' IS NULL))")).rows[0];
    const limit = hourlyJobLimit();
    return {
      ...snapshot,
      connectors: await connectorStore().list(),
      operation: operatingSummary({ ...snapshot, plans }),
      budget:{used:capacity.used,limit,nextAvailableAt:limit !== null && capacity.used>=limit?(await eventStore().pool.query("SELECT created_at+interval '1 hour' AS next_at FROM ascendxi_events WHERE created_at>now()-interval '1 hour' AND(kind='ai.job.reserved' OR(kind='task.started' AND data->>'jobId' IS NULL))ORDER BY created_at DESC OFFSET $1 LIMIT 1",[limit-1])).rows[0]?.next_at:null,newSpendingApproved:false},
      autonomy:{mode:internalAutonomyEnabled()?'internal':'manual',routineApprovals:internalAutonomyEnabled(),externalDecisions:'Founder approval: new spending, access, services, client scope and deployment'},
      integrations:await serviceChecks(),
      revision,
      modelProfiles,
      analytics:(await eventStore().pool.query("SELECT (started_at AT TIME ZONE 'UTC')::date::text AS day,count(*)::int AS runs,count(*)FILTER(WHERE status='succeeded')::int AS succeeded,count(*)FILTER(WHERE status='failed')::int AS failed,COALESCE(sum(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)),0)::text AS tokens,count(*)FILTER(WHERE input_tokens IS NULL AND output_tokens IS NULL)::int AS usage_unknown FROM ascendxi_runs WHERE started_at>now()-interval '7 days' GROUP BY 1 ORDER BY 1")).rows,
      plans,
      discord: await new DiscordService().status(),
      inboxWatch: await new InboxWatch().status(),
    };
  }
  return [
    registerApiRoute('/company/inbox-watch', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        const d = z
          .object({ enabled: z.boolean(), query: z.string().min(3).max(500) })
          .parse(await c.req.json());
        return c.json(await new InboxWatch().configure(d.enabled, d.query));
      }),
    }),
    registerApiRoute('/company/discord', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        const d = z.object({ enabled: z.boolean() }).parse(await c.req.json());
        return c.json(await new DiscordService().activate(d.enabled));
      }),
    }),
    registerApiRoute('/company/operations', {
      method: 'GET',
      middleware: guard,
      handler: wrap(async (c) => c.json(await frame(c))),
    }),
    registerApiRoute('/company/live', {
      method: 'GET',
      middleware: guard,
      handler: async (c) => {
        c.header('Cache-Control', 'no-cache, no-transform');
        c.header('X-Accel-Buffering', 'no');
        let cancelled = false,
          timer: ReturnType<typeof setTimeout> | undefined;
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            let previous = '';
            const send = async () => {
              if (cancelled) return;
              try {
                const data = await frame(c);
                const version = JSON.stringify([
                  data.revision,
                  data.integrations,
                  data.worker.heartbeat_at,
                  data.runs.map((r: any) => [r.id, r.status, r.preview.length]),
                  data.notifications.map((n: any) => [
                    n.id,
                    n.status,
                    n.updated_at,
                  ]),
                ]);
                if (previous !== version) {
                  controller.enqueue(
                    encoder.encode(
                      'event: snapshot\ndata: ' + JSON.stringify(data) + '\n\n',
                    ),
                  );
                  previous = version;
                } else controller.enqueue(encoder.encode(': heartbeat\n\n'));
              } catch {
                if (!cancelled)
                  controller.enqueue(
                    encoder.encode(
                      'event: problem\ndata: {"error":"Live state temporarily unavailable"}\n\n',
                    ),
                  );
              }
              if (!cancelled) timer = setTimeout(send, 1500);
            };
            void send();
            c.req.raw.signal.addEventListener(
              'abort',
              () => {
                cancelled = true;
                if (timer) clearTimeout(timer);
                try {
                  controller.close();
                } catch {}
              },
              { once: true },
            );
          },
          cancel() {
            cancelled = true;
            if (timer) clearTimeout(timer);
          },
        });
        return new Response(body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
          },
        });
      },
    }),
    registerApiRoute('/company/agents/:id/settings', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        const id = c.req.param('id');
        validAgent(c, id);
        const d = z
          .object({
            paused: z.boolean().optional(),
            model: z
              .enum([modelProfiles.routine, modelProfiles.complex])
              .nullable()
              .optional(),
            autoPreferences: z.boolean().optional(),
          })
          .strict()
          .parse(await c.req.json());
        return c.json(await operationsStore().configure(id, d));
      }),
    }),
    registerApiRoute('/company/agents/:id/access', {
      method: 'GET',
      middleware: guard,
      handler: wrap(async (c) => {
        const id = c.req.param('id');
        validAgent(c, id);
        const tools = await c.get('mastra').getAgent(id).listTools();
        return c.json(
          Object.entries(tools).map(([id, t]: [string, any]) => ({
            id,
            description: t.description,
            approval:
              t.requireApproval === true
                ? 'required'
                : t.requireApproval
                  ? 'conditional'
                  : 'internal / reviewed read',
          })),
        );
      }),
    }),
    registerApiRoute('/company/feedback', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        const d = z
          .object({
            agentId: z.string(),
            taskId: z.string().uuid().nullable().optional(),
            rating: z.number().int().min(1).max(5),
            note: z.string().min(10).max(4000),
            preferences: preferenceInput.optional(),
          })
          .strict()
          .parse(await c.req.json());
        validAgent(c, d.agentId);
        return c.json(await operationsStore().feedback(d));
      }),
    }),
    registerApiRoute('/company/improvements', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        const d = suggestionInput
          .extend({ preferences: preferenceInput.optional() })
          .parse(await c.req.json());
        validAgent(c, d.agentId);
        return c.json(
          await operationsStore().suggest(
            'operator:' + crypto.randomUUID(),
            d,
            d.preferences,
          ),
        );
      }),
    }),
    registerApiRoute('/company/improvements/:id/decision', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        const d = z
          .object({
            decision: z.enum(['apply', 'reject']),
            future: z.boolean().default(false),
          })
          .parse(await c.req.json());
        return c.json(
          await operationsStore().decide(
            z.string().uuid().parse(c.req.param('id')),
            d.decision,
            d.future,
          ),
        );
      }),
    }),
    registerApiRoute('/company/notifications/:id/read', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        await operationsStore().readNotification(
          z.string().regex(/^\d+$/).parse(c.req.param('id')),
        );
        return c.json({ ok: true });
      }),
    }),
    registerApiRoute('/company/tasks/:id/plan', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => {
        const d = z
          .object({
            priority: z.enum(['urgent', 'high', 'normal', 'low']),
            estimateMinutes: z.number().int().min(1).max(525600).nullable(),
            dueAt: z.iso.datetime({ offset: true }).nullable(),
            nextStep: z.string().max(2000),
          })
          .parse(await c.req.json());
        await operationsStore().plan(
          z.string().uuid().parse(c.req.param('id')),
          d,
        );
        return c.json({ ok: true });
      }),
    }),
    registerApiRoute('/company/monitor', {
      method: 'POST',
      middleware: guard,
      handler: wrap(async (c) => c.json(await operationsStore().monitor())),
    }),
  ];
}
