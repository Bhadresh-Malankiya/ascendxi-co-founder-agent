import { tools } from '@mastra/connect';
import { guardConnectedTools } from './policy';
import { z } from 'zod';
import { departmentIds, roleIds } from './catalog';

/** UI-configured profiles still use the same Connect SDK boundary and invocation policy. */
export function configuredConnectResolver(projectId:string,providers:string[],accessToken:string){
  return tools({projectId,providers,ttlMs:0,client:{accessToken}});
}

export const hasConnectEnv = Boolean(
  (process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim() ||
    process.env.MASTRA_PLATFORM_SECRET_KEY?.trim()) &&
  process.env.MASTRA_PROJECT_ID?.trim(),
);
const resolve = hasConnectEnv ? tools() : undefined;
export const connectTools = resolve
  ? async (context: Parameters<typeof resolve>[0]) => guardConnectedTools(await resolve(context))
  : undefined;

// Use a strict object instead of loose names: a typo must fail startup rather than widen access.
export function departmentToolGrants(
  value = process.env.ASCENDXI_DEPARTMENT_TOOLS ?? '{}',
): Record<string, string[]> {
  const parsed: unknown = JSON.parse(value);
  const schema = z
    .object(
      Object.fromEntries(departmentIds.map((id) => [id, z.array(z.string().min(1)).optional()])),
    )
    .strict();
  return schema.parse(parsed) as Record<string, string[]>;
}
const grants = departmentToolGrants();
export const departmentTools =
  (department: string) => async (context: Parameters<NonNullable<typeof connectTools>>[0]) => {
    const permitted = new Set(grants[department] ?? []);
    if (!permitted.size || !connectTools) return {};
    const available = await connectTools(context);
    return Object.fromEntries(Object.entries(available).filter(([key]) => permitted.has(key)));
  };

/** Role access is explicit and independent of the department lead's grants. */
export function roleToolGrants(
  value = process.env.ASCENDXI_ROLE_TOOLS ?? '{}',
): Record<string, string[]> {
  const schema = z
    .object(Object.fromEntries(roleIds.map((id) => [id, z.array(z.string().min(1)).optional()])))
    .strict();
  return schema.parse(JSON.parse(value)) as Record<string, string[]>;
}
const roleGrants = roleToolGrants();
export const roleTools =
  (role: string) => async (context: Parameters<NonNullable<typeof connectTools>>[0]) => {
    const permitted = new Set(roleGrants[role] ?? []);
    if (!permitted.size || !connectTools) return {};
    const available = await connectTools(context);
    return Object.fromEntries(Object.entries(available).filter(([key]) => permitted.has(key)));
  };
