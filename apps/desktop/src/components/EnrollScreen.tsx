import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t, type Lang } from "../i18n.js";
import type { EnrollResult } from "../types.js";
import { PanelHeader } from "./PanelHeader.js";

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Go to the status panel (after a successful enroll or on skip). */
  onDone: () => void | Promise<void>;
}

export function EnrollScreen({ lang, onLangChange, onDone }: Props) {
  const [code, setCode] = useState("");
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
      const result = await invoke<EnrollResult>("enroll", {
        code: code.trim().toUpperCase(),
      });
      if (result === "ok") {
        await onDone();
        return;
      }
      const key =
        result === "invalid_code"
          ? "enroll.error.invalid"
          : "enroll.error.network";
      showError(t(key));
    } catch {
      showError(t("enroll.error.network"));
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
        <p className="error fade-up" id="error" key={errorKey}>
          {error}
        </p>
      ) : (
        <p className="error" id="error" />
      )}
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
