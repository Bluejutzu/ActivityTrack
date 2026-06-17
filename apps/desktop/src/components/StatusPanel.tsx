import { t, type Lang } from "../i18n.js";
import type { AgentStatus } from "../types.js";
import { PanelHeader } from "./PanelHeader.js";
import { StatusBadge } from "./StatusBadge.js";
import { KeyValueTable } from "./KeyValueTable.js";
import { SamplesTable } from "./SamplesTable.js";
import { ErrorsSection } from "./ErrorsSection.js";
import { UpdateStatus } from "./UpdateStatus.js";

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  status: AgentStatus;
  pollError: boolean;
  onRefresh: () => void | Promise<void>;
  onLock: () => void | Promise<void>;
}

export function StatusPanel({
  lang,
  onLangChange,
  status: s,
  pollError,
  onRefresh,
  onLock,
}: Props) {
  return (
    <div id="status-panel" className="card panel">
      <UpdateStatus />
      <PanelHeader lang={lang} onLangChange={onLangChange} />
      <div className="badges">
        <StatusBadge
          id="badge-active"
          ok={s.active}
          okLabel={t("status.active")}
          altLabel={t("status.idle")}
          altClass="muted"
        />
        <StatusBadge
          id="badge-online"
          ok={s.online}
          okLabel={t("status.online")}
          altLabel={t("status.offline")}
        />
        <StatusBadge
          id="badge-enrolled"
          ok={s.enrolled}
          okLabel={t("status.enrolled")}
          altLabel={t("status.notEnrolled")}
        />
      </div>
      <p className="error" id="poll-error">
        {pollError ? t("status.pollError") : ""}
      </p>
      <KeyValueTable status={s} />
      <h2>{t("status.recent")}</h2>
      <SamplesTable samples={s.lastSamples} />
      <h2>{t("status.errors")}</h2>
      <div id="errors-section">
        <ErrorsSection errors={s.recentErrors} />
      </div>
      <div className="actions">
        <button id="refresh" onClick={() => onRefresh()}>
          {t("status.refresh")}
        </button>
        <button id="lock" onClick={() => onLock()}>
          {t("status.lock")}
        </button>
      </div>
    </div>
  );
}
