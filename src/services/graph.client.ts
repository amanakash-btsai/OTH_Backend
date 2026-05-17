import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

let _client: Client | null = null;

export function getGraphClient(): Client {
  if (_client) {
    console.log('[Graph] Reusing existing Graph client');
    return _client;
  }

  const tenantId = process.env.GRAPH_TENANT_ID ?? process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID ?? process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET ?? process.env.AZURE_AD_CLIENT_SECRET;

  console.log('[Graph] Initialising Graph client', {
    tenantId: tenantId ?? '❌ MISSING',
    clientId: clientId ?? '❌ MISSING',
    clientSecretSet: !!clientSecret,
  });

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Graph credentials not configured (GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET)');
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  _client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        console.log('[Graph] Acquiring access token for https://graph.microsoft.com/.default');
        try {
          const token = await credential.getToken('https://graph.microsoft.com/.default');
          if (!token) throw new Error('Failed to acquire Graph access token');
          console.log('[Graph] ✅ Token acquired, expires:', new Date(token.expiresOnTimestamp).toISOString());
          return token.token;
        } catch (err) {
          console.error('[Graph] ❌ Token acquisition failed:', (err as Error).message);
          throw err;
        }
      },
    },
  });

  console.log('[Graph] ✅ Graph client initialised');
  return _client;
}

// Call when credentials change (e.g., secret rotation) to force re-init
export function resetGraphClient(): void {
  _client = null;
}
