import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t, type Lang } from "../i18n.js";
import type { EnrollOutcome, EnrollStatus } from "../types.js";
import { PanelHeader } from "./PanelHeader.js";
import { DiagnosticsPanel } from "./DiagnosticsPanel.js";

const ERROR_KEYS: Record<Exclude<EnrollStatus, "ok">, string> = {
  invalid_code: "enroll.error.invalid",
  not_configured: "enroll.error.notConfigured",
  server: "enroll.error.server",
  network: "enroll.error.network",
};

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Go to the status panel (after a successful enroll or on skip). */
  onDone: () => void | Promise<void>;
}

export function EnrollScreen({ lang, onLangChange, onDone }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [detail, setDetail] = useState<string | undefined>(undefined);
  const [errorKey, setErrorKey] = useState(0);
  const [checking, setChecking] = useState(false);

  const showError = (message: string, detail?: string) => {
    setError(message);
    setDetail(detail);
    setErrorKey((k) => k + 1);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    try {
      const result = await invoke<EnrollOutcome>("enroll", {
        code: code.trim().toUpperCase(),
      });
      if (result.status === "ok") {
        await onDone();
        return;
      }
      showError(t(ERROR_KEYS[result.status]), result.detail ?? undefined);
    } catch (e) {
      showError(t("enroll.error.network"), String(e));
    } finally {
      setChecking(false);
    }
  };

  const onSkip = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onDone();
  };

  return (
    <div className="card panel">
      <PanelHeader lang={lang} onLangChange={onLangChange} />
      <h2>{t("enroll.heading")}</h2>
      <p className="hint">{t("enroll.hint")}</p>
      <form id="enroll-form" onSubmit={onSubmit}>
        <input
          id="code"
          type="text"
          placeholder={t("enroll.code")}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          maxLength={9}
          style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" id="submit" disabled={checking}>
          {checking ? (
            <>
              <span className="spinner" /> {t("enroll.checking")}
            </>
          ) : (
            t("enroll.submit")
          )}
        </button>
      </form>
      {error ? (
        <div className="error fade-up" id="error" key={errorKey}>
          <p className="error-msg">{error}</p>
          {detail ? (
            <details className="error-detail">
              <summary>{t("error.details")}</summary>
              <pre>{detail}</pre>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="error" id="error" />
      )}
      <DiagnosticsPanel />
      <p className="hint skip-row">
        <a
          href="#"
          id="skip"
          className="skip-link"
          onClick={onSkip}
        >
          {t("enroll.skip")}
        </a>
      </p>
    </div>
  );
}
