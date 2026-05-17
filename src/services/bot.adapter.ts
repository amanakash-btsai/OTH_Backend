import { BotFrameworkAdapter } from 'botbuilder';

let adapter: BotFrameworkAdapter | null = null;

export function getBotAdapter(): BotFrameworkAdapter {
  if (!adapter) {
    const appId = process.env.TEAMS_BOT_APP_ID;
    const appPassword = process.env.TEAMS_BOT_PASSWORD;
    if (!appId || !appPassword) {
      throw new Error('TEAMS_BOT_APP_ID or TEAMS_BOT_PASSWORD not set in environment');
    }
    adapter = new BotFrameworkAdapter({ appId, appPassword, channelAuthTenant: process.env.GRAPH_TENANT_ID });
  }
  return adapter;
}
