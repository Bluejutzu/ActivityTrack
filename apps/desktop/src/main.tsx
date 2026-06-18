import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { ClerkProvider } from "@clerk/clerk-react";
import { App } from "./App.js";
import "./styles.css";

interface AuthConfig {
  clerkPublishableKey: string;
}

const container = document.getElementById("app");
if (!container) throw new Error("missing #app root element");

function AuthProvider({ children }: { children: ReactNode }) {
  const [clerkKey, setClerkKey] = useState<string | null>(null);

  useEffect(() => {
    invoke<AuthConfig>("get_auth_config")
      .then((config) => setClerkKey(config.clerkPublishableKey || ""))
      .catch(() => setClerkKey(""));
  }, []);

  if (clerkKey === null) return null;
  if (!clerkKey) return <App clerkAuthAvailable={false} />;
  return <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider>;
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
