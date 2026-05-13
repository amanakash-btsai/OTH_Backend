import OpenAI from 'openai';
import { config } from './index';

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    if (!config.AZURE_OPENAI_ENDPOINT || !config.AZURE_OPENAI_API_KEY) {
      throw new Error('Azure OpenAI is not configured');
    }
    _client = new OpenAI({
      apiKey: config.AZURE_OPENAI_API_KEY,
      baseURL: `${config.AZURE_OPENAI_ENDPOINT}/openai/deployments/${config.AZURE_OPENAI_DEPLOYMENT}`,
      defaultQuery: { 'api-version': '2024-08-01-preview' },
      defaultHeaders: { 'api-key': config.AZURE_OPENAI_API_KEY },
    });
  }
  return _client;
}
