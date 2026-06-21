import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

const container = document.getElementById("app");
if (!container) throw new Error("missing #app root element");

// No cloud sign-in on the desktop: the agent authenticates to the backend with
// its own per-device token (earned at approval), and the tray window is gated by
// the dashboard-set debug password. See App.tsx for the pairing → unlock flow.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
