import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { t, getLang, setLang, type Lang } from "./i18n.js";
import type { AgentStatus, VerifyResult } from "./types.js";

/**
 * Tray UI controller. The window is hidden on startup (tray-only); when shown
 * it presents a password gate, then a read-only status/debug panel. Unlocking
 * is per-window-session — closing/hiding re-locks. Tracking itself runs in the
 * Rust process regardless of whether this UI is open or unlocked.
 */
const app = document.getElementById("app")!;
let unlocked = false;
let pollTimer: number | undefined;

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} ${t("units.seconds")}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${t("units.minutes")}`;
  const h = Math.floor(m / 60);
  return `${h} ${t("units.hours")} ${m % 60} ${t("units.minutes")}`;
}

function fmtTime(ms: number | null): string {
  if (!ms) return t("status.never");
  return new Date(ms).toLocaleTimeString(getLang());
}

function langSwitcher(): string {
  const lang = getLang();
  return `
    <label class="lang">
      <span>${t("lang.label")}</span>
      <select id="lang">
        <option value="de" ${lang === "de" ? "selected" : ""}>Deutsch</option>
        <option value="en" ${lang === "en" ? "selected" : ""}>English</option>
      </select>
    </label>`;
}

function wireLangSwitcher(rerender: () => void): void {
  const sel = document.getElementById("lang") as HTMLSelectElement | null;
  sel?.addEventListener("change", () => {
    setLang(sel.value as Lang);
    rerender();
  });
}

function renderLogin(error?: string): void {
  app.innerHTML = `
    <div class="card panel">
      <header><h1>${t("app.title")}</h1>${langSwitcher()}</header>
      <h2>${t("login.heading")}</h2>
      <p class="hint">${t("login.hint")}</p>
      <form id="login-form">
        <input id="pw" type="password" placeholder="${t("login.password")}" autofocus />
        <button type="submit" id="submit">${t("login.submit")}</button>
      </form>
      ${error ? `<p class="error fade-up" id="error">${error}</p>` : `<p class="error" id="error"></p>`}
    </div>`;
  wireLangSwitcher(() => renderLogin(error));

  const form = document.getElementById("login-form") as HTMLFormElement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = (document.getElementById("pw") as HTMLInputElement).value;
    const btn = document.getElementById("submit") as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${t("login.checking")}`;
    try {
      const result = await invoke<VerifyResult>("verify_password", { password: pw });
      if (result === "ok") {
        unlocked = true;
        await startStatus();
        return;
      }
      const key =
        result === "unset"
          ? "login.error.unset"
          : result === "network"
            ? "login.error.network"
            : "login.error.wrong";
      renderLogin(t(key));
    } catch {
      renderLogin(t("login.error.network"));
    }
  });
}

async function startStatus(): Promise<void> {
  await renderStatus();
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(renderStatus, 3000);
}

async function renderStatus(): Promise<void> {
  if (!unlocked) return;
  let s: AgentStatus;
  try {
    s = await invoke<AgentStatus>("get_status");
  } catch {
    return;
  }

  const rows: Array<[string, string]> = [
    [t("status.host"), s.hostname],
    [t("status.user"), s.windowsUser],
    [t("status.device"), s.deviceId],
    [t("status.idleFor"), fmtDuration(s.idleMs)],
    [t("status.queue"), String(s.queueLength)],
    [t("status.lastSent"), fmtTime(s.lastSentAt)],
    [t("status.lastError"), s.lastError ?? t("status.none")],
    [
      t("status.convexUrl"),
      s.configured ? s.convexUrl : t("status.notConfigured"),
    ],
    [t("status.version"), s.agentVersion],
  ];

  const samplesRows = s.lastSamples
    .map(
      (sm) =>
        `<tr><td>${fmtTime(sm.capturedAt)}</td><td>${
          sm.active ? t("status.active") : t("status.idle")
        }</td><td>${fmtDuration(sm.idleMs)}</td></tr>`,
    )
    .join("");

  app.innerHTML = `
    <div class="card panel">
      <header><h1>${t("app.title")}</h1>${langSwitcher()}</header>
      <div class="badges">
        <span class="badge ${s.active ? "ok" : "muted"}">${
          s.active ? t("status.active") : t("status.idle")
        }</span>
        <span class="badge ${s.online ? "ok" : "warn"}">${
          s.online ? t("status.online") : t("status.offline")
        }</span>
      </div>
      <table class="kv">${rows
        .map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`)
        .join("")}</table>
      <h2>${t("status.recent")}</h2>
      <table class="samples">
        <thead><tr><th>${t("samples.time")}</th><th>${t(
          "samples.state",
        )}</th><th>${t("samples.idle")}</th></tr></thead>
        <tbody>${samplesRows}</tbody>
      </table>
      <div class="actions">
        <button id="refresh">${t("status.refresh")}</button>
        <button id="lock">${t("status.lock")}</button>
      </div>
    </div>`;

  wireLangSwitcher(renderStatus);
  document.getElementById("refresh")?.addEventListener("click", renderStatus);
  document.getElementById("lock")?.addEventListener("click", async () => {
    unlocked = false;
    window.clearInterval(pollTimer);
    // Hide back to the tray and re-lock.
    await getCurrentWindow().hide();
    renderLogin();
  });
}

setLang(getLang());
renderLogin();
