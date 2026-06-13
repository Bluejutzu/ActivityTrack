/** Shapes returned by the Rust `get_status` command. Mirror of tracker state. */
export interface AgentSample {
  active: boolean;
  idleMs: number;
  capturedAt: number;
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
  agentVersion: string;
  lastSamples: AgentSample[];
}

export type VerifyResult = "ok" | "wrong" | "unset" | "network";
