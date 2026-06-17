import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { t } from "../i18n.js";

type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "installing"
  | "installed"
  | "uptodate"
  | "error";

export function UpdateStatus() {
  const [state, setState] = useState<UpdateState>("idle");
  const [version, setVersion] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const listeners = Promise.all([
      listen("update:checking", () => {
        setState("checking");
        setError("");
      }),
      listen("update:available", (event: { payload: string }) => {
        setState("available");
        setVersion(event.payload);
      }),
      listen("update:installing", () => {
        setState("installing");
      }),
      listen("update:installed", () => {
        setState("installed");
        setTimeout(() => setState("idle"), 5000);
      }),
      listen("update:uptodate", () => {
        setState("uptodate");
        setTimeout(() => setState("idle"), 3000);
      }),
      listen("update:error", (event: { payload: string }) => {
        setState("error");
        setError(event.payload);
        setTimeout(() => setState("idle"), 5000);
      }),
    ]);

    return () => {
      listeners.then((unlisten) => unlisten.forEach((fn) => fn()));
    };
  }, []);

  if (state === "idle") return null;

  const messages: Record<UpdateState, string> = {
    idle: "",
    checking: "Checking for updates...",
    available: `Update available: v${version}`,
    installing: "Installing update...",
    installed: "Update installed! Restarting app...",
    uptodate: "App is up to date",
    error: `Update failed: ${error}`,
  };

  const colors: Record<UpdateState, string> = {
    idle: "",
    checking: "info",
    available: "warning",
    installing: "info",
    installed: "success",
    uptodate: "success",
    error: "error",
  };

  return (
    <div id="update-status" className={`notification ${colors[state]}`}>
      {messages[state]}
    </div>
  );
}
