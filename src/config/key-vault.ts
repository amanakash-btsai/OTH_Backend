import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '@utils/logger';

const VAULT_URL = process.env.AZURE_KEY_VAULT_URL;

export async function getSecret(secretName: string): Promise<string | undefined> {
  if (process.env.NODE_ENV !== 'production' || !VAULT_URL) {
    return process.env[secretName];
  }
  try {
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(VAULT_URL, credential);
    const secret = await client.getSecret(secretName);
    return secret.value;
  } catch (err) {
    logger.error({ message: `Failed to fetch secret ${secretName} from Key Vault`, error: err });
    return undefined;
  }
}
