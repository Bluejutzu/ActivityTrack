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

/** Status codes returned by the `verify_password` command (see sender.rs). */
export type VerifyStatus =
  | "ok"
  | "wrong"
  | "unset"
  | "not_configured"
  | "server"
  | "network";

/** Status codes returned by the `enroll` command. */
export type EnrollStatus =
  | "ok"
  | "invalid_code"
  | "not_configured"
  | "server"
  | "network";

/**
 * Structured result of a backend-touching command. `detail` carries the real
 * underlying reason (HTTP status + body, transport error, or which config is
 * missing) so failures are debuggable instead of collapsing into one message.
 */
export interface Outcome<S extends string> {
  status: S;
  detail: string | null;
}

export type VerifyOutcome = Outcome<VerifyStatus>;
export type EnrollOutcome = Outcome<EnrollStatus>;

/** Connectivity/configuration snapshot from the `get_diagnostics` command. */
export interface Diagnostics {
  convexUrl: string;
  configFile: string;
  configPresent: boolean;
  hasConvexUrl: boolean;
  hasBootstrapKey: boolean;
  enrolled: boolean;
  configured: boolean;
}
