import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t, type Lang } from "../i18n.js";
import type { VerifyResult } from "../types.js";
import { PanelHeader } from "./PanelHeader.js";

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Called with the verified result once the password is correct ("ok"). */
  onUnlocked: () => void | Promise<void>;
}

export function LoginGate({ lang, onLangChange, onUnlocked }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [errorKey, setErrorKey] = useState(0);
  const [checking, setChecking] = useState(false);

  const showError = (message: string) => {
    setError(message);
    setErrorKey((k) => k + 1);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    try {
      const result = await invoke<VerifyResult>("verify_password", {
        password,
      });
      if (result === "ok") {
        await onUnlocked();
        return;
      }
      const key =
        result === "unset"
          ? "login.error.unset"
          : result === "network"
            ? "login.error.network"
            : "login.error.wrong";
      showError(t(key));
    } catch {
      showError(t("login.error.network"));
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
          id="pw"
          type="password"
          placeholder={t("login.password")}
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
        <p className="error fade-up" id="error" key={errorKey}>
          {error}
        </p>
      ) : (
        <p className="error" id="error" />
      )}
    </div>
  );
}
