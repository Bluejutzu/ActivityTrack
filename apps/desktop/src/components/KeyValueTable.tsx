import { t } from "../i18n.js";
import { fmtDuration, fmtTime } from "../format.js";
import type { AgentStatus } from "../types.js";

interface Row {
  label: string;
  value: string;
  id?: string;
}

export function KeyValueTable({ status: s }: { status: AgentStatus }) {
  const rows: Row[] = [
    { label: t("status.host"), value: s.hostname },
    { label: t("status.user"), value: s.windowsUser },
    { label: t("status.device"), value: s.deviceId },
    { label: t("status.idleFor"), value: fmtDuration(s.idleMs), id: "kv-idle" },
    { label: t("status.queue"), value: String(s.queueLength), id: "kv-queue" },
    { label: t("status.lastSent"), value: fmtTime(s.lastSentAt), id: "kv-last-sent" },
    {
      label: t("status.lastError"),
      value: s.lastError ?? t("status.none"),
      id: "kv-last-error",
    },
    {
      label: t("status.convexUrl"),
      value: s.convexUrl || t("status.notConfigured"),
    },
    { label: t("status.version"), value: s.agentVersion },
  ];

  return (
    <table className="kv">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th>{row.label}</th>
            <td id={row.id}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
