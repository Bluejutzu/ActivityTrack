import { t } from "../i18n.js";
import { fmtDuration, fmtTime } from "../format.js";
import type { AgentSample } from "../types.js";

export function SamplesTable({ samples }: { samples: AgentSample[] }) {
  return (
    <table className="samples">
      <thead>
        <tr>
          <th>{t("samples.time")}</th>
          <th>{t("samples.state")}</th>
          <th>{t("samples.idle")}</th>
        </tr>
      </thead>
      <tbody id="samples-tbody">
        {samples.map((sm, i) => (
          <tr key={`${sm.capturedAt}-${i}`}>
            <td>{fmtTime(sm.capturedAt)}</td>
            <td>{sm.active ? t("status.active") : t("status.idle")}</td>
            <td>{fmtDuration(sm.idleMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
