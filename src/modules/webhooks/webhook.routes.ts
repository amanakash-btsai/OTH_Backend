import { Router } from 'express';
import { handleTeamsMessages } from './teams.controller';

const router = Router();

// Raw diagnostic log — fires before any JWT check or handler logic
router.use('/teams', (req, _res, next) => {
  console.log('[TeamsRoute] >>> RAW HIT <<<', req.method, req.path);
  console.log('[TeamsRoute] Content-Type:', req.headers['content-type']);
  console.log('[TeamsRoute] Authorization:', req.headers.authorization
    ? `Bearer ...${req.headers.authorization.slice(-20)}`
    : 'MISSING ❌');
  console.log('[TeamsRoute] User-Agent:', req.headers['user-agent']);
  console.log('[TeamsRoute] Origin:', req.headers.origin ?? '(none)');
  console.log('[TeamsRoute] Body (first 300):', JSON.stringify(req.body).slice(0, 300));
  next();
});

// Teams Bot Framework endpoint — receives card actions (Approve/Reject invokes)
// No JWT middleware here; bot token validation is done inside the handler
router.post('/teams', (req, res) => {
  void handleTeamsMessages(req, res);
});

export default router;
