import { useState } from "react";
import { useSignIn, useUser } from "@clerk/clerk-react";
import { t, type Lang } from "../i18n.js";
import { PanelHeader } from "./PanelHeader.js";
import { DiagnosticsPanel } from "./DiagnosticsPanel.js";

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Called once Clerk has authenticated the desktop technician session. */
  onUnlocked: () => void | Promise<void>;
  clerkAuthAvailable: boolean;
}

export function LoginGate(props: Props) {
  if (!props.clerkAuthAvailable) return <MissingClerkConfig {...props} />;
  return <ClerkLoginGate {...props} />;
}

function MissingClerkConfig({ lang, onLangChange }: Props) {
  return (
    <div className="card panel">
      <PanelHeader lang={lang} onLangChange={onLangChange} />
      <h2>{t("login.heading")}</h2>
      <p className="hint">{t("login.error.notConfigured")}</p>
      <div className="error fade-up" id="error">
        <p className="error-msg">{t("login.error.missingClerkKey")}</p>
      </div>
      <DiagnosticsPanel />
    </div>
  );
}

function ClerkLoginGate({ lang, onLangChange, onUnlocked }: Props) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [checking, setChecking] = useState(false);

  async function unlockSignedIn() {
    setError(undefined);
    await onUnlocked();
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    try {
      if (isSignedIn) {
        await unlockSignedIn();
        return;
      }
      if (!isLoaded || !signIn || !setActive) return;
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        await unlockSignedIn();
      } else {
        setError(t("login.error.server"));
      }
    } catch (err) {
      const clerkError = err as {
        errors?: Array<{ longMessage?: string; message?: string }>;
      };
      setError(
        clerkError.errors?.[0]?.longMessage ??
          clerkError.errors?.[0]?.message ??
          String(err),
      );
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
        {!isSignedIn ? (
          <input
            id="email"
            type="email"
            placeholder={t("login.email")}
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : null}
        {!isSignedIn ? (
          <input
            id="pw"
            type="password"
            placeholder={t("login.password")}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        ) : null}
        <button type="submit" id="submit" disabled={checking || !isLoaded}>
          {checking ? (
            <>
              <span className="spinner" /> {t("login.checking")}
            </>
          ) : isSignedIn ? (
            t("login.unlock")
          ) : (
            t("login.submit")
          )}
        </button>
      </form>
      {error ? (
        <div className="error fade-up" id="error">
          <p className="error-msg">{error}</p>
        </div>
      ) : (
        <p className="error" id="error" />
      )}
      <DiagnosticsPanel />
    </div>
  );
}
