import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { setLang } from "./i18n.js";
import type { AgentStatus } from "./types.js";
import { useLang } from "./useLang.js";
import { LoginGate } from "./components/LoginGate.js";
import { PairingScreen } from "./components/PairingScreen.js";
import { StatusPanel } from "./components/StatusPanel.js";

const POLL_INTERVAL_MS = 3000;

export function App() {
  const { lang, changeLang } = useLang();
  // Keep the document `lang` attribute in sync on first mount.
  useEffect(() => {
    setLang(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unlock is per-window-session — see hide-on-lock below.
  const [unlocked, setUnlocked] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [pollError, setPollError] = useState(false);

  // Poll the local tracker snapshot continuously: it's a cheap in-process read,
  // and it drives both the pairing screen (waiting for approval) and the live
  // status panel. The tracker pairs autonomously in the background — the UI just
  // reflects where it's at.
  const fetchStatus = useCallback(async () => {
    try {
      const s = await invoke<AgentStatus>("get_status");
      setStatus(s);
      setPollError(false);
    } catch {
      setPollError(true);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const timer = window.setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [fetchStatus]);

  const onLock = useCallback(async () => {
    setUnlocked(false);
    await getCurrentWindow().hide();
  }, []);

  // Render nothing until the first snapshot lands.
  if (!status) return null;

  // Not paired yet → pairing screen. No password here: verifying it needs the
  // device token, which we don't have until pairing completes.
  if (!status.enrolled) {
    return (
      <PairingScreen lang={lang} onLangChange={changeLang} status={status} />
    );
  }

  // Paired but locked → the dashboard-set password gate.
  if (!unlocked) {
    return (
      <LoginGate
        lang={lang}
        onLangChange={changeLang}
        onUnlocked={() => setUnlocked(true)}
      />
    );
  }

  return (
    <StatusPanel
      lang={lang}
      onLangChange={changeLang}
      status={status}
      pollError={pollError}
      onRefresh={fetchStatus}
      onLock={onLock}
    />
  );
}
