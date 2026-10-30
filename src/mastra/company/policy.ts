import type { ToolsInput } from '@mastra/core/agent';
import type { Tool } from '@mastra/core/tools';

/** Exact tool IDs, reviewed by the operator. Unknown tools always require approval. */
export function readToolAllowlist(value = process.env.ASCENDXI_READ_TOOLS ?? ''): Set<string> {
  return new Set(
    value
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
}
export function requiresApproval(toolId: string, reads = readToolAllowlist()): boolean {
  return !reads.has(toolId);
}
/** Preserve Tool instances/metadata and upstream restrictions without mutating shared resolver objects. */
export function guardConnectedTools(
  discovered: ToolsInput,
  reads = readToolAllowlist(),
): ToolsInput {
  return Object.fromEntries(
    Object.entries(discovered).map(([key, tool]) => {
      const original = tool as Tool;
      const guarded = Object.assign(Object.create(Object.getPrototypeOf(tool)), tool, {
        // Unknown tool always requires approval, even if upstream's conditional check returns false.
        requireApproval: requiresApproval(key, reads) ? true : original.requireApproval,
      });
      return [key, guarded];
    }),
  );
}
