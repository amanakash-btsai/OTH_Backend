import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@config/database';
import { logger } from '@utils/logger';
import * as salesRequestService from '@modules/salesRequests/salesRequest.service';
import { buildConfirmedCard, buildApprovalCard, notifyEqcTeamOfApproval, type RequestForNotification } from '@services/teams.service';

// ── JWT validation ────────────────────────────────────────────────────────────

/**
 * Lightweight Bot Framework JWT check: verifies the token is signed for our
 * bot app ID (azp/appid claim). Full JWKS signature validation should be
 * added before production deployment.
 */
function validateBotToken(authHeader: string | undefined): boolean {
  console.log('[TeamsWebhook] validateBotToken → Authorization header present:', !!authHeader);
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[TeamsWebhook] validateBotToken ❌ No Bearer token in Authorization header');
    console.warn('[TeamsWebhook]   → If testing locally with curl/Postman, this will fail — Teams sends a real JWT');
    return false;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.decode(token) as Record<string, string> | null;
    if (!decoded) {
      console.warn('[TeamsWebhook] validateBotToken ❌ Could not decode JWT');
      return false;
    }
    console.log('[TeamsWebhook] validateBotToken → JWT claims:', {
      azp: decoded.azp,
      appid: decoded.appid,
      aud: decoded.aud,
      iss: decoded.iss,
      tid: decoded.tid,
      exp: decoded.exp ? new Date(Number(decoded.exp) * 1000).toISOString() : undefined,
    });
    const botAppId = process.env.TEAMS_BOT_APP_ID;
    if (!botAppId) {
      console.warn('[TeamsWebhook] validateBotToken → TEAMS_BOT_APP_ID not set, skipping claim check');
      return true;
    }
    const tokenAppId = decoded.azp ?? decoded.appid ?? decoded.aud;
    const valid = tokenAppId === botAppId;
    console.log('[TeamsWebhook] validateBotToken →', valid ? '✅ valid' : '❌ INVALID',
      `| tokenAppId=${tokenAppId} | expected=${botAppId}`);
    return valid;
  } catch (err) {
    console.error('[TeamsWebhook] validateBotToken ❌ Exception:', (err as Error).message);
    return false;
  }
}

// ── Teams invoke handler ──────────────────────────────────────────────────────

export async function handleTeamsMessages(req: Request, res: Response): Promise<void> {
  console.log('[TeamsWebhook] ──── Incoming request ────');
  console.log('[TeamsWebhook] Method:', req.method, '| Path:', req.path);
  console.log('[TeamsWebhook] Headers:', JSON.stringify({
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? `Bearer ...${req.headers.authorization.slice(-10)}` : 'MISSING',
    'user-agent': req.headers['user-agent'],
  }));
  console.log('[TeamsWebhook] Body:', JSON.stringify(req.body).slice(0, 1000));

  if (!validateBotToken(req.headers.authorization)) {
    console.warn('[TeamsWebhook] ❌ 401 Unauthorized — bot token validation failed');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = req.body as {
    type: string;
    name?: string;
    from?: { aadObjectId?: string; name?: string };
    value?: {
      action?: {
        verb?: string;
        data?: { requestId?: string };
        inputs?: { rejectionReason?: string };
      };
    };
  };

  console.log('[TeamsWebhook] Activity type:', body.type, '| name:', body.name ?? 'n/a');
  console.log('[TeamsWebhook] from.aadObjectId:', body.from?.aadObjectId ?? 'MISSING');
  console.log('[TeamsWebhook] from.name:', body.from?.name ?? 'n/a');

  // ── Non-invoke activities (bot install, etc.) ─────────────────────────────
  if (body.type !== 'invoke') {
    console.log('[TeamsWebhook] Non-invoke activity — acknowledging with 200 {}');
    res.status(200).json({});
    return;
  }

  // ── Adaptive Card Universal Action ────────────────────────────────────────
  if (body.name === 'adaptiveCard/action') {
    const verb = body.value?.action?.verb;
    const requestId = body.value?.action?.data?.requestId;
    const aadObjectId = body.from?.aadObjectId;

    console.log('[TeamsWebhook] adaptiveCard/action → verb:', verb, '| requestId:', requestId, '| aadObjectId:', aadObjectId);

    if (!requestId) {
      console.warn('[TeamsWebhook] ❌ Missing requestId in card data');
      res.status(200).json({ statusCode: 400, type: 'application/vnd.microsoft.activity.message', value: 'Missing requestId' });
      return;
    }

    // Resolve the acting user from their Azure AD Object ID
    console.log('[TeamsWebhook] Looking up user by azure_ad_object_id:', aadObjectId);
    const actingUser = aadObjectId
      ? await prisma.user.findFirst({ where: { azure_ad_object_id: aadObjectId } })
      : null;

    if (!actingUser) {
      console.warn('[TeamsWebhook] ❌ User not found in DB for aadObjectId:', aadObjectId);
      console.warn('[TeamsWebhook]   → Check: Is azure_ad_object_id populated in the users table for this manager?');
      console.warn('[TeamsWebhook]   → The aadObjectId from Teams must match users.azure_ad_object_id in the database');
      logger.warn({ message: 'Teams invoke: user not found in DB', aadObjectId });
      res.status(200).json({ statusCode: 403, type: 'application/vnd.microsoft.activity.message', value: 'User not found in system' });
      return;
    }

    console.log('[TeamsWebhook] ✅ Acting user resolved:', { user_id: actingUser.user_id, name: actingUser.name });

    try {
      if (verb === 'approve') {
        console.log('[TeamsWebhook] → Processing APPROVE for requestId:', requestId, 'by user:', actingUser.name);
        const updated = await salesRequestService.approveSalesRequest(requestId, actingUser.user_id);
        const confirmedCard = buildConfirmedCard(
          updated as unknown as RequestForNotification,
          'approved',
          actingUser.name,
        );
        console.log('[TeamsWebhook] ✅ Approved → sending confirmed card back');
        res.status(200).json({ statusCode: 200, type: 'application/vnd.microsoft.card.adaptive', value: confirmedCard });

        console.log('[TeamsWebhook] → Triggering EQC channel notification (fire-and-forget)');
        notifyEqcTeamOfApproval(updated as unknown as RequestForNotification, actingUser.name)
          .catch(err => {
            console.error('[TeamsWebhook] ❌ EQC notification failed:', (err as Error).message);
            logger.error({ message: 'Teams EQC notification failed (card approve)', error: (err as Error).message });
          });
        return;
      }

      if (verb === 'reject') {
        const reason = body.value?.action?.inputs?.rejectionReason ?? 'Rejected via Microsoft Teams';
        console.log('[TeamsWebhook] → Processing REJECT for requestId:', requestId, '| reason:', reason);
        const updated = await salesRequestService.rejectSalesRequest(requestId, reason);
        const confirmedCard = buildConfirmedCard(
          updated as unknown as RequestForNotification,
          'rejected',
          actingUser.name,
          reason,
        );
        console.log('[TeamsWebhook] ✅ Rejected → sending confirmed card back');
        res.status(200).json({ statusCode: 200, type: 'application/vnd.microsoft.card.adaptive', value: confirmedCard });
        return;
      }

      if (verb === 'refresh') {
        console.log('[TeamsWebhook] → Processing REFRESH for requestId:', requestId);
        const request = await salesRequestService.findSalesRequest(requestId);
        const card = buildApprovalCard(request as unknown as RequestForNotification);
        res.status(200).json({ statusCode: 200, type: 'application/vnd.microsoft.card.adaptive', value: card });
        return;
      }

      console.warn('[TeamsWebhook] Unknown verb:', verb);
      res.status(200).json({ statusCode: 200, type: 'application/vnd.microsoft.activity.message', value: 'Unknown verb' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[TeamsWebhook] ❌ Handler error:', message);
      logger.error({ message: 'Teams invoke handler error', error: message });
      res.status(200).json({ statusCode: 500, type: 'application/vnd.microsoft.activity.message', value: message });
    }
    return;
  }

  console.log('[TeamsWebhook] Unhandled invoke name:', body.name, '— acknowledging');
  // Default: acknowledge other invoke types
  res.status(200).json({});
}
