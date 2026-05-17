import { CardFactory, ConversationReference } from 'botbuilder';
import { getGraphClient } from './graph.client';
import { getBotAdapter } from './bot.adapter';
import { logger } from '@utils/logger';

interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface RequestForNotification {
  request_id: string;
  request_number: string;
  purpose1: string;
  purpose2: string;
  start_use_date: Date | string;
  estimate_return_date: Date | string;
  account: { account_name: string };
  sales_person: { name: string };
  deployments: Array<{
    asset: { asset_name: string; serial_number: string };
  }>;
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

export async function getManagerOf(userEmail: string): Promise<GraphUser> {
  console.log('[Teams] getManagerOf → looking up manager for:', userEmail);
  try {
    const manager = await getGraphClient()
      .api(`/users/${encodeURIComponent(userEmail)}/manager`)
      .select('id,displayName,mail,userPrincipalName')
      .get() as GraphUser;
    console.log('[Teams] getManagerOf → manager found:', { id: manager.id, name: manager.displayName, mail: manager.mail });
    return manager;
  } catch (err) {
    console.error('[Teams] getManagerOf ❌ FAILED for', userEmail, ':', (err as Error).message);
    throw err;
  }
}

/**
 * Ensures the EQC Teams app is installed for the given user and returns the
 * 1-on-1 chat ID between the user and the bot.
 * Requires: TeamsAppInstallation.ReadWriteForUser.All, Chat.ReadBasic.All
 */
async function getBotChatId(userId: string): Promise<string> {
  console.log('[Teams] getBotChatId → userId:', userId);
  const client = getGraphClient();
  const appExternalId = process.env.TEAMS_APP_EXTERNAL_ID ?? 'com.olympus.eqc.oth';
  const catalogAppId = process.env.TEAMS_CATALOG_APP_ID;

  console.log('[Teams] getBotChatId → config:', {
    appExternalId,
    catalogAppId: catalogAppId ?? '❌ MISSING',
  });

  if (!catalogAppId) throw new Error('TEAMS_CATALOG_APP_ID is not configured in .env');

  // Check whether the app is already installed for this user
  console.log('[Teams] getBotChatId → checking installation for user', userId, 'externalId:', appExternalId);
  let installed: { value: Array<{ id: string }> };
  try {
    installed = await client
      .api(`/users/${userId}/teamwork/installedApps`)
      .filter(`teamsApp/externalId eq '${appExternalId}'`)
      .expand('teamsApp')
      .get() as { value: Array<{ id: string }> };
    console.log('[Teams] getBotChatId → installed apps found:', installed.value.length);
  } catch (err) {
    console.error('[Teams] getBotChatId ❌ Failed to list installed apps:', (err as Error).message);
    console.error('[Teams]   → Check: TeamsAppInstallation.ReadWriteForUser.All permission granted?');
    throw err;
  }

  let installationId: string;

  if (installed.value.length > 0) {
    installationId = installed.value[0].id;
    console.log('[Teams] getBotChatId → app already installed, installationId:', installationId);
  } else {
    console.log('[Teams] getBotChatId → app not installed, installing with catalogAppId:', catalogAppId);
    try {
      await client.api(`/users/${userId}/teamwork/installedApps`).post({
        'teamsApp@odata.bind': `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/${catalogAppId}`,
      });
      console.log('[Teams] getBotChatId → install POST sent');
    } catch (err) {
      console.error('[Teams] getBotChatId ❌ Install failed:', (err as Error).message);
      console.error('[Teams]   → Check: Is the app approved in Teams Admin Center (org catalog)?');
      console.error('[Teams]   → Check: TeamsAppInstallation.ReadWriteForUser.All permission granted?');
      throw err;
    }

    // Re-fetch the installation to get its ID
    const fresh = await client
      .api(`/users/${userId}/teamwork/installedApps`)
      .filter(`teamsApp/externalId eq '${appExternalId}'`)
      .get() as { value: Array<{ id: string }> };

    console.log('[Teams] getBotChatId → re-fetched after install, count:', fresh.value.length);
    if (!fresh.value.length) throw new Error('App installation not found after install');
    installationId = fresh.value[0].id;
  }

  // Get the 1-on-1 chat for this app + user pair
  console.log('[Teams] getBotChatId → fetching chat for installationId:', installationId);
  let chat: { id: string };
  try {
    chat = await client
      .api(`/users/${userId}/teamwork/installedApps/${installationId}/chat`)
      .select('id')
      .get() as { id: string };
    console.log('[Teams] getBotChatId ✅ chatId:', chat.id);
  } catch (err) {
    console.error('[Teams] getBotChatId ❌ Failed to get chat:', (err as Error).message);
    console.error('[Teams]   → Check: Chat.ReadBasic.All permission granted?');
    throw err;
  }

  return chat.id;
}

// ── Adaptive card builders ────────────────────────────────────────────────────

function fmt(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function buildApprovalCard(request: RequestForNotification): Record<string, unknown> {
  const assetList = request.deployments.length
    ? request.deployments.map(d => `${d.asset.asset_name} (${d.asset.serial_number})`).join(', ')
    : 'No assets selected';

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'emphasis',
        items: [
          {
            type: 'TextBlock',
            text: 'NEW SALES REQUEST — APPROVAL REQUIRED',
            weight: 'Bolder',
            size: 'Small',
            color: 'Accent',
            spacing: 'None',
          },
        ],
      },
      {
        type: 'TextBlock',
        text: request.request_number,
        size: 'ExtraLarge',
        weight: 'Bolder',
        spacing: 'Small',
      },
      {
        type: 'FactSet',
        spacing: 'Small',
        facts: [
          { title: 'Sales Rep',   value: request.sales_person.name },
          { title: 'Hospital',    value: request.account.account_name },
          { title: 'Purpose',     value: `${request.purpose1} / ${request.purpose2.replace(/_/g, ' ')}` },
          { title: 'Start Date',  value: fmt(request.start_use_date) },
          { title: 'Return Date', value: fmt(request.estimate_return_date) },
          { title: 'Assets',      value: assetList },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: 'Approve',
        verb: 'approve',
        style: 'positive',
        data: { requestId: request.request_id },
      },
      {
        type: 'Action.ShowCard',
        title: 'Reject',
        style: 'destructive',
        card: {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'Input.Text',
              id: 'rejectionReason',
              label: 'Rejection reason',
              placeholder: 'Enter reason...',
              isMultiline: true,
              isRequired: true,
            },
          ],
          actions: [
            {
              type: 'Action.Execute',
              title: 'Confirm Rejection',
              verb: 'reject',
              data: { requestId: request.request_id },
            },
          ],
        },
      },
      {
        type: 'Action.OpenUrl',
        title: 'Open Manager Dashboard',
        url: `${frontendUrl}/dashboard`,
      },
    ],
  };
}

export function buildConfirmedCard(
  request: RequestForNotification,
  action: 'approved' | 'rejected',
  performedBy: string,
  rejectionReason?: string,
): Record<string, unknown> {
  const color = action === 'approved' ? 'Good' : 'Attention';
  const label = action === 'approved' ? 'APPROVED' : 'REJECTED';

  const facts: Array<{ title: string; value: string }> = [
    { title: 'Request No.', value: request.request_number },
    { title: 'Hospital',    value: request.account.account_name },
    { title: 'Action by',   value: performedBy },
  ];
  if (rejectionReason) facts.push({ title: 'Reason', value: rejectionReason });

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: action === 'approved' ? 'good' : 'attention',
        items: [
          {
            type: 'TextBlock',
            text: label,
            weight: 'Bolder',
            size: 'Medium',
            color,
          },
        ],
      },
      { type: 'FactSet', facts },
    ],
  };
}

// ── EQC channel webhook notification ─────────────────────────────────────────

function buildEqcApprovalCard(request: RequestForNotification, approvedByName: string): Record<string, unknown> {
  const assetList = request.deployments.length
    ? request.deployments.map(d => `${d.asset.asset_name} (${d.asset.serial_number})`).join(', ')
    : 'No assets';
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'good',
        items: [
          {
            type: 'TextBlock',
            text: 'REQUEST APPROVED — EQC ACTION REQUIRED',
            weight: 'Bolder',
            size: 'Small',
            spacing: 'None',
          },
        ],
      },
      {
        type: 'TextBlock',
        text: request.request_number,
        size: 'ExtraLarge',
        weight: 'Bolder',
        spacing: 'Small',
      },
      {
        type: 'FactSet',
        spacing: 'Small',
        facts: [
          { title: 'Sales Rep',   value: request.sales_person.name },
          { title: 'Approved By', value: approvedByName },
          { title: 'Hospital',    value: request.account.account_name },
          { title: 'Purpose',     value: `${request.purpose1} / ${request.purpose2.replace(/_/g, ' ')}` },
          { title: 'Start Date',  value: fmt(request.start_use_date) },
          { title: 'Return Date', value: fmt(request.estimate_return_date) },
          { title: 'Assets',      value: assetList },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'Open EQC Dashboard',
        url: `${frontendUrl}/eqc-dashboard`,
      },
    ],
  };
}

/**
 * Broadcasts an Adaptive Card to the EQC ops Teams channel via the Workflows webhook.
 * Non-blocking — caller should `.catch(err => logger.error(...))`.
 */
export async function notifyEqcTeamOfApproval(
  request: RequestForNotification,
  approvedByName: string,
): Promise<void> {
  const webhookUrl = process.env.EQC_TEAMS_CHANNEL_WEBHOOK;
  if (!webhookUrl) {
    console.warn('[Teams] EQC_TEAMS_CHANNEL_WEBHOOK not set — skipping EQC channel notification');
    logger.warn({ message: 'EQC_TEAMS_CHANNEL_WEBHOOK not configured — skipping channel notification' });
    return;
  }

  console.log('[Teams] notifyEqcTeamOfApproval → request:', request.request_number, '| approver:', approvedByName);
  console.log('[Teams] notifyEqcTeamOfApproval → webhook URL (first 80 chars):', webhookUrl.slice(0, 80) + '...');

  const card = buildEqcApprovalCard(request, approvedByName);
  const payload = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: card,
      },
    ],
  };

  console.log('[Teams] notifyEqcTeamOfApproval → sending payload:', JSON.stringify(payload).slice(0, 300) + '...');

  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[Teams] notifyEqcTeamOfApproval ❌ fetch threw:', (err as Error).message);
    throw err;
  }

  console.log('[Teams] notifyEqcTeamOfApproval → HTTP response status:', res.status, res.statusText);

  if (!res.ok) {
    const body = await res.text().catch(() => '(could not read body)');
    console.error('[Teams] notifyEqcTeamOfApproval ❌ webhook returned', res.status, '— body:', body);
    console.error('[Teams]   → Check: Is the Power Automate workflow published & active?');
    console.error('[Teams]   → Check: Does the workflow accept { type, attachments } payload schema?');
    throw new Error(`EQC webhook returned ${res.status}: ${body}`);
  }

  const responseText = await res.text().catch(() => '');
  console.log('[Teams] notifyEqcTeamOfApproval ✅ EQC channel notified. Response:', responseText.slice(0, 200));
  logger.info({ message: 'Teams: EQC channel notified', request: request.request_number });
}

// ── Manager DM notification ───────────────────────────────────────────────────

/**
 * Fires a Teams Adaptive Card approval notification to the sales rep's manager.
 * Non-blocking — caller should `.catch(err => logger.error(...))`.
 */
export async function notifyManagerOfNewRequest(
  request: RequestForNotification,
  salesRepEmail: string,
): Promise<void> {
  console.log('[Teams] notifyManagerOfNewRequest → START');
  console.log('[Teams]   request_number:', request.request_number);
  console.log('[Teams]   salesRepEmail:', salesRepEmail);
  console.log('[Teams]   sales_person:', request.sales_person?.name);
  console.log('[Teams]   account:', request.account?.account_name);
  console.log('[Teams]   deployments count:', request.deployments?.length ?? 0);

  // 1. Get the manager
  const manager = await getManagerOf(salesRepEmail);
  logger.info({
    message: 'Teams: notifying manager of new sales request',
    manager: manager.mail,
    request: request.request_number,
  });

  // 2. Get / create 1-on-1 bot chat with the manager
  console.log('[Teams] notifyManagerOfNewRequest → getting bot chat for manager.id:', manager.id);
  const chatId = await getBotChatId(manager.id);
  console.log('[Teams] notifyManagerOfNewRequest → chatId:', chatId);

  // 3. Build the Adaptive Card
  const card = buildApprovalCard(request);
  console.log('[Teams] notifyManagerOfNewRequest → card built');
  console.log('[Teams] notifyManagerOfNewRequest → card JSON (first 500):', JSON.stringify(card).slice(0, 500));

  // 4. Send the card via Bot Framework proactive messaging.
  // Graph API POST /chats/{id}/messages requires Teamwork.Migrate.All for app-only auth,
  // which is not grantable. Bot Framework continueConversation is the correct pattern.
  console.log('[Teams] notifyManagerOfNewRequest → sending via Bot Framework proactive messaging');
  try {
    const conversationRef: Partial<ConversationReference> = {
      channelId: 'msteams',
      serviceUrl: 'https://smba.trafficmanager.net/teams/',
      conversation: {
        id: chatId,
        isGroup: false,
        conversationType: 'personal',
        tenantId: process.env.GRAPH_TENANT_ID,
        name: '',
      },
      bot: { id: process.env.TEAMS_BOT_APP_ID!, name: 'NotificationBot101' },
    };
    await getBotAdapter().continueConversation(conversationRef, async (context) => {
      await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
    });
    console.log('[Teams] notifyManagerOfNewRequest ✅ Card sent to manager:', manager.mail);
    logger.info({ message: 'Teams: approval card sent', manager: manager.mail });
  } catch (err) {
    console.error('[Teams] notifyManagerOfNewRequest ❌ Failed to send card:', (err as Error).message);
    console.error('[Teams]   → Check: TEAMS_BOT_PASSWORD set in .env?');
    console.error('[Teams]   → Check: Azure Bot has Microsoft Teams channel enabled?');
    throw err;
  }
}
