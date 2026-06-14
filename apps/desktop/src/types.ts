/** Shapes returned by the Rust `get_status` command. Mirror of tracker state. */
export interface AgentSample {
  active: boolean;
  idleMs: number;
  capturedAt: number;
}

export interface AgentError {
  at: number;
  code: string;
  message: string;
}

export interface AgentStatus {
  deviceId: string;
  hostname: string;
  windowsUser: string;
  active: boolean;
  idleMs: number;
  online: boolean;
  queueLength: number;
  lastSentAt: number | null;
  lastError: string | null;
  convexUrl: string;
  configured: boolean;
  enrolled: boolean;
  agentVersion: string;
  lastSamples: AgentSample[];
  recentErrors: AgentError[];
}

export type VerifyResult = "ok" | "wrong" | "unset" | "network";
export type EnrollResult = "ok" | "invalid_code" | "network";
