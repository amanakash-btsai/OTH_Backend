export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface TeamsAlertJobData {
  channel: string;
  cardJson: string;
}

export interface AiAgentJobData {
  agentType: string;
  payload: Record<string, unknown>;
}
