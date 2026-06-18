import { useEffect, useRef } from "react";
import { SignIn, useUser } from "@clerk/clerk-react";
import { t, type Lang } from "../i18n.js";
import { getTheme } from "../theme.js";
import { PanelHeader } from "./PanelHeader.js";
import { DiagnosticsPanel } from "./DiagnosticsPanel.js";

// Clerk can't read our CSS variables, so hand it the resolved palette per theme.
// Kept in step with the tray's styles.css tokens.
const CLERK_VARS = {
  light: {
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorText: "#1b2027",
    colorTextSecondary: "#5b6573",
    colorInputText: "#1b2027",
    colorPrimary: "#2e6cf6",
  },
  dark: {
    colorBackground: "#161c24",
    colorInputBackground: "#1e252f",
    colorText: "#e6eaf0",
    colorTextSecondary: "#8e9aa9",
    colorInputText: "#e6eaf0",
    colorPrimary: "#588eff",
  },
} as const;

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
  const { isLoaded, isSignedIn } = useUser();
  const calledRef = useRef(false);

  // As soon as Clerk confirms the session is active, hand off to the app.
  // calledRef prevents firing twice if the component re-renders before the
  // parent has had a chance to unmount this gate.
  useEffect(() => {
    if (isLoaded && isSignedIn && !calledRef.current) {
      calledRef.current = true;
      void onUnlocked();
    }
  }, [isLoaded, isSignedIn, onUnlocked]);

  // Already signed in — onUnlocked() is in flight; show nothing while the
  // parent transitions away from this gate.
  if (isLoaded && isSignedIn) return null;

  return (
    <div className="card panel">
      <PanelHeader lang={lang} onLangChange={onLangChange} />
      <SignIn
        routing="virtual"
        appearance={{
          variables: { ...CLERK_VARS[getTheme()], borderRadius: "0.5rem" },
          elements: {
            // This is an internal tool — self-registration isn't available.
            footerAction: { display: "none" },
          },
        }}
      />
      <DiagnosticsPanel />
    </div>
  );
}
