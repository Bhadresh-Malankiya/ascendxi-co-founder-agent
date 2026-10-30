import { LocalFilesystem, LocalSandbox, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';
import { PlatformFilesystem, PlatformSandbox } from '@mastra/platform-workspace';
import { hasConnectEnv } from './connections';

const workspacePath = 'workspace';

/**
 * Platform workspace primitives activate when their env is present
 * (MASTRA_ENVIRONMENT_ID for the sandbox, MASTRA_PLATFORM_BUCKET_NAME for the
 * filesystem); otherwise the local primitives keep the template bootable with
 * nothing but a database.
 */
const usePlatformSandbox = hasConnectEnv && Boolean(process.env.MASTRA_ENVIRONMENT_ID?.trim());
const usePlatformFilesystem =
  hasConnectEnv && Boolean(process.env.MASTRA_PLATFORM_BUCKET_NAME?.trim());

export const workspace = new Workspace({
  id: 'agent-workspace',
  name: 'Agent Workspace',
  filesystem: usePlatformFilesystem
    ? new PlatformFilesystem({ id: 'agent-workspace-fs' })
    : new LocalFilesystem({ basePath: workspacePath }),
  sandbox: usePlatformSandbox
    ? new PlatformSandbox({ id: 'agent-workspace-sandbox' })
    : new LocalSandbox({ workingDirectory: workspacePath }),
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { requireApproval: true },
    [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { requireApproval: true },
    [WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS]: { requireApproval: true },
    [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
      requireReadBeforeWrite: true,
      requireApproval: true,
    },
    [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: {
      requireReadBeforeWrite: true,
      requireApproval: true,
    },
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval: true },
    [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: {
      requireApproval: true,
    },
  },
});
