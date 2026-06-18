import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { setLang } from "./i18n.js";
import type { AgentStatus } from "./types.js";
import { useLang } from "./useLang.js";
import { LoginGate } from "./components/LoginGate.js";
import { EnrollScreen } from "./components/EnrollScreen.js";
import { StatusPanel } from "./components/StatusPanel.js";

type Screen = "login" | "enroll" | "status";

const POLL_INTERVAL_MS = 3000;

export function App({
  clerkAuthAvailable = true,
}: {
  clerkAuthAvailable?: boolean;
}) {
  const { lang, changeLang } = useLang();
  // Keep the document `lang` attribute in sync on first mount, mirroring the
  // old `setLang(getLang())` boot call.
  useEffect(() => {
    setLang(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unlock is per-window-session — see hide-on-lock below.
  const [unlocked, setUnlocked] = useState(false);
  const [screen, setScreen] = useState<Screen>("login");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [pollError, setPollError] = useState(false);

  // Track the live unlocked flag inside the poll callback without re-arming it.
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  const fetchStatus = useCallback(async () => {
    if (!unlockedRef.current) return;
    try {
      const s = await invoke<AgentStatus>("get_status");
      setStatus(s);
      setPollError(false);
    } catch {
      setPollError(true);
    }
  }, []);

  // After the password is verified: decide enroll vs. status from live status.
  const onUnlocked = useCallback(async () => {
    setUnlocked(true);
    unlockedRef.current = true;
    const s = await invoke<AgentStatus>("get_status");
    if (s.enrolled) {
      setStatus(s);
      setPollError(false);
      setScreen("status");
    } else {
      setScreen("enroll");
    }
  }, []);

  // Enroll success or skip → status panel; fetch an initial snapshot.
  const goToStatus = useCallback(async () => {
    await fetchStatus();
    setScreen("status");
  }, [fetchStatus]);

  const onLock = useCallback(async () => {
    setUnlocked(false);
    unlockedRef.current = false;
    setScreen("login");
    setStatus(null);
    setPollError(false);
    await getCurrentWindow().hide();
  }, []);

  // Poll only while unlocked and on the status screen; clean up on leave.
  useEffect(() => {
    if (!unlocked || screen !== "status") return;
    const timer = window.setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [unlocked, screen, fetchStatus]);

  if (screen === "login") {
    return (
      <LoginGate
        lang={lang}
        onLangChange={changeLang}
        onUnlocked={onUnlocked}
        clerkAuthAvailable={clerkAuthAvailable}
      />
    );
  }

  if (screen === "enroll") {
    return (
      <EnrollScreen lang={lang} onLangChange={changeLang} onDone={goToStatus} />
    );
  }

  // Status screen. Render nothing until the first snapshot lands.
  if (!status) return null;
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
