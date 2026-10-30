import { SimpleAuth } from '@mastra/core/server';

/** Platform Studio keeps its own organization login; direct server APIs need a separate operator key. */
export function companyServerAuth(
  token = process.env.ASCENDXI_API_TOKEN,
  production = Boolean(process.env.MASTRA_ENVIRONMENT_ID) || process.env.NODE_ENV === 'production',
) {
  if (!token?.trim()) {
    if (production)
      throw new Error('ASCENDXI_API_TOKEN is required in production to protect the company API');
    return undefined;
  }
  if (token.length < 40)
    throw new Error('ASCENDXI_API_TOKEN must be a high-entropy key of at least 40 characters');
  return new SimpleAuth({
    tokens: { [token]: { id: 'ascendxi-operator', name: 'AscendXI operator', role: 'admin' } },
  });
}
