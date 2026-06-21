import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t, type Lang } from "../i18n.js";
import type { VerifyOutcome, VerifyStatus } from "../types.js";
import { PanelHeader } from "./PanelHeader.js";
import { DiagnosticsPanel } from "./DiagnosticsPanel.js";

// "ok" and "unset" both unlock (an unset password means IT hasn't locked the
// tray yet — open freely for this internal tool); the rest are real failures.
const ERROR_KEYS: Record<Exclude<VerifyStatus, "ok" | "unset">, string> = {
  wrong: "login.error.wrong",
  not_configured: "login.error.notConfigured",
  server: "login.error.server",
  network: "login.error.network",
};

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Called once the password is accepted (or no password is configured). */
  onUnlocked: () => void | Promise<void>;
}

export function LoginGate({ lang, onLangChange, onUnlocked }: Props) {
  const [password, setPassword] = useState("");
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
      const result = await invoke<VerifyOutcome>("verify_password", {
        password,
      });
      if (result.status === "ok" || result.status === "unset") {
        await onUnlocked();
        return;
      }
      showError(t(ERROR_KEYS[result.status]), result.detail ?? undefined);
    } catch (e) {
      showError(t("login.error.network"), String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="card panel">
      <PanelHeader lang={lang} onLangChange={onLangChange} />
      <h2>{t("login.heading")}</h2>
      <p className="hint">{t("login.hint")}</p>
      <form id="login-form" onSubmit={onSubmit}>
        <input
          id="password"
          type="password"
          placeholder={t("login.password")}
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" id="submit" disabled={checking}>
          {checking ? (
            <>
              <span className="spinner" /> {t("login.checking")}
            </>
          ) : (
            t("login.submit")
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
    </div>
  );
}
