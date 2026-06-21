import { t, type Lang } from "../i18n.js";
import type { AgentStatus, PairingState } from "../types.js";
import { PanelHeader } from "./PanelHeader.js";
import { DiagnosticsPanel } from "./DiagnosticsPanel.js";

// Pairing sub-state → explanatory hint. The agent registers and polls in the
// background; this screen just narrates progress until an admin approves it,
// after which `App` flips to the password gate automatically.
const PAIRING_HINT: Record<PairingState, string> = {
  unconfigured: "pairing.unconfigured",
  registering: "pairing.registering",
  pending: "pairing.pending",
  disabled: "pairing.disabled",
  denied: "pairing.denied",
  error: "pairing.error",
  paired: "pairing.pending",
};

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  status: AgentStatus;
}

export function PairingScreen({ lang, onLangChange, status }: Props) {
  const hintKey = PAIRING_HINT[status.pairing] ?? "pairing.registering";
  const waiting =
    status.pairing === "pending" || status.pairing === "registering";

  return (
    <div className="card panel">
      <PanelHeader lang={lang} onLangChange={onLangChange} />
      <h2>{t("pairing.heading")}</h2>
      <p className="hint">{t(hintKey)}</p>
      <table className="kv">
        <tbody>
          <tr>
            <th>{t("status.host")}</th>
            <td>{status.hostname}</td>
          </tr>
          <tr>
            <th>{t("status.device")}</th>
            <td>{status.deviceId}</td>
          </tr>
        </tbody>
      </table>
      {waiting ? (
        <p className="hint">
          <span className="spinner" /> {t("pairing.waiting")}
        </p>
      ) : null}
      {status.lastError ? (
        <div className="error" id="error">
          <p className="error-msg">{status.lastError}</p>
        </div>
      ) : null}
      <DiagnosticsPanel />
    </div>
  );
}
