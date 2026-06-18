import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { App } from "./App.js";
import "./styles.css";

const container = document.getElementById("app");
if (!container) throw new Error("missing #app root element");

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkKey) return children;
  return <ClerkProvider publishableKey={clerkKey}>{children}</ClerkProvider>;
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
