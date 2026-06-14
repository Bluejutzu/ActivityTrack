import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { t, getLang, setLang, type Lang } from "./i18n.js";
import type { AgentStatus, AgentSample, AgentError, VerifyResult, EnrollResult } from "./types.js";

/**
 * Tray UI controller. The window is hidden on startup (tray-only); when shown
 * it presents a password gate, then a read-only status/debug panel. Unlocking
 * is per-window-session — closing/hiding re-locks. Tracking itself runs in the
 * Rust process regardless of whether this UI is open or unlocked.
 */
const app = document.getElementById("app")!;
let unlocked = false;
let pollTimer: number | undefined;
let needsFullRender = true;

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

/** Escape text destined for innerHTML — error messages are arbitrary strings. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function wireLangSwitcher(onchange: () => void): void {
  const sel = document.getElementById("lang") as HTMLSelectElement | null;
  sel?.addEventListener("change", () => {
    setLang(sel.value as Lang);
    onchange();
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
        const status = await invoke<AgentStatus>("get_status");
        if (status.enrolled) {
          await startStatus();
        } else {
          renderEnroll();
        }
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

function renderEnroll(error?: string): void {
  app.innerHTML = `
    <div class="card panel">
      <header><h1>${t("app.title")}</h1>${langSwitcher()}</header>
      <h2>${t("enroll.heading")}</h2>
      <p class="hint">${t("enroll.hint")}</p>
      <form id="enroll-form">
        <input id="code" type="text" placeholder="${t("enroll.code")}"
               autocomplete="off" spellcheck="false" autofocus
               style="text-transform:uppercase;letter-spacing:0.05em" maxlength="9" />
        <button type="submit" id="submit">${t("enroll.submit")}</button>
      </form>
      ${error ? `<p class="error fade-up" id="error">${error}</p>` : `<p class="error" id="error"></p>`}
      <p class="hint" style="margin-top:1rem">
        <a href="#" id="skip" style="color:var(--color-muted);font-size:.8rem">${t("enroll.skip")}</a>
      </p>
    </div>`;
  wireLangSwitcher(() => renderEnroll(error));

  document.getElementById("skip")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await startStatus();
  });

  const form = document.getElementById("enroll-form") as HTMLFormElement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = (document.getElementById("code") as HTMLInputElement).value
      .trim()
      .toUpperCase();
    const btn = document.getElementById("submit") as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${t("enroll.checking")}`;
    try {
      const result = await invoke<EnrollResult>("enroll", { code });
      if (result === "ok") {
        await startStatus();
        return;
      }
      const key =
        result === "invalid_code" ? "enroll.error.invalid" : "enroll.error.network";
      renderEnroll(t(key));
    } catch {
      renderEnroll(t("enroll.error.network"));
    }
  });
}

async function startStatus(): Promise<void> {
  needsFullRender = true;
  await renderStatus();
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(renderStatus, 3000);
}

function renderSampleRows(samples: AgentSample[]): string {
  return samples
    .map(
      (sm) =>
        `<tr><td>${fmtTime(sm.capturedAt)}</td><td>${
          sm.active ? t("status.active") : t("status.idle")
        }</td><td>${fmtDuration(sm.idleMs)}</td></tr>`,
    )
    .join("");
}

function renderErrorsSection(errors: AgentError[]): string {
  const errorLabel = (code: string): string => {
    const key = `error.code.${code}`;
    const label = t(key);
    return label === key ? code : label;
  };

  if (errors.length === 0) {
    return `<p class="hint">${t("status.noErrors")}</p>`;
  }
  return `<table class="samples errors">
    <thead><tr><th>${t("errors.time")}</th><th>${t("errors.what")}</th><th>${t("errors.detail")}</th></tr></thead>
    <tbody>${errors
      .map(
        (e) =>
          `<tr><td>${fmtTime(e.at)}</td><td>${escapeHtml(errorLabel(e.code))}</td><td class="err-detail">${escapeHtml(e.message)}</td></tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function renderStatusFull(s: AgentStatus): void {
  const rows: Array<[string, string, string?]> = [
    [t("status.host"), escapeHtml(s.hostname)],
    [t("status.user"), escapeHtml(s.windowsUser)],
    [t("status.device"), escapeHtml(s.deviceId)],
    [t("status.idleFor"), fmtDuration(s.idleMs), "kv-idle"],
    [t("status.queue"), String(s.queueLength), "kv-queue"],
    [t("status.lastSent"), fmtTime(s.lastSentAt), "kv-last-sent"],
    [t("status.lastError"), escapeHtml(s.lastError ?? t("status.none")), "kv-last-error"],
    [t("status.convexUrl"), escapeHtml(s.convexUrl || t("status.notConfigured"))],
    [t("status.version"), escapeHtml(s.agentVersion)],
  ];

  app.innerHTML = `
    <div id="status-panel" class="card panel">
      <header><h1>${t("app.title")}</h1>${langSwitcher()}</header>
      <div class="badges">
        <span id="badge-active" class="badge ${s.active ? "ok" : "muted"}">${
          s.active ? t("status.active") : t("status.idle")
        }</span>
        <span id="badge-online" class="badge ${s.online ? "ok" : "warn"}">${
          s.online ? t("status.online") : t("status.offline")
        }</span>
        <span id="badge-enrolled" class="badge ${s.enrolled ? "ok" : "warn"}">${
          s.enrolled ? t("status.enrolled") : t("status.notEnrolled")
        }</span>
      </div>
      <p class="error" id="poll-error"></p>
      <table class="kv">${rows
        .map(([k, val, id]) => `<tr><th>${k}</th><td${id ? ` id="${id}"` : ""}>${val}</td></tr>`)
        .join("")}</table>
      <h2>${t("status.recent")}</h2>
      <table class="samples">
        <thead><tr><th>${t("samples.time")}</th><th>${t(
          "samples.state",
        )}</th><th>${t("samples.idle")}</th></tr></thead>
        <tbody id="samples-tbody">${renderSampleRows(s.lastSamples)}</tbody>
      </table>
      <h2>${t("status.errors")}</h2>
      <div id="errors-section">${renderErrorsSection(s.recentErrors)}</div>
      <div class="actions">
        <button id="refresh">${t("status.refresh")}</button>
        <button id="lock">${t("status.lock")}</button>
      </div>
    </div>`;

  wireLangSwitcher(() => {
    needsFullRender = true;
    renderStatus();
  });
  document.getElementById("refresh")?.addEventListener("click", renderStatus);
  document.getElementById("lock")?.addEventListener("click", async () => {
    unlocked = false;
    window.clearInterval(pollTimer);
    await getCurrentWindow().hide();
    renderLogin();
  });
}

/** Update only the values that change on each poll tick — no DOM rebuild. */
function patchStatus(s: AgentStatus): void {
  const setText = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  const setBadge = (
    id: string,
    ok: boolean,
    okLabel: string,
    warnLabel: string,
    warnClass = "warn",
  ) => {
    const el = document.getElementById(id);
    if (!el) return;
    const cls = `badge ${ok ? "ok" : warnClass}`;
    const text = ok ? okLabel : warnLabel;
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== text) el.textContent = text;
  };

  setBadge("badge-active", s.active, t("status.active"), t("status.idle"), "muted");
  setBadge("badge-online", s.online, t("status.online"), t("status.offline"));
  setBadge("badge-enrolled", s.enrolled, t("status.enrolled"), t("status.notEnrolled"));

  setText("kv-idle", fmtDuration(s.idleMs));
  setText("kv-queue", String(s.queueLength));
  setText("kv-last-sent", fmtTime(s.lastSentAt));
  setText("kv-last-error", s.lastError ?? t("status.none"));

  const samplesTbody = document.getElementById("samples-tbody");
  if (samplesTbody) {
    const html = renderSampleRows(s.lastSamples);
    if (samplesTbody.innerHTML !== html) samplesTbody.innerHTML = html;
  }

  const errorsSection = document.getElementById("errors-section");
  if (errorsSection) {
    const html = renderErrorsSection(s.recentErrors);
    if (errorsSection.innerHTML !== html) errorsSection.innerHTML = html;
  }
}

async function renderStatus(): Promise<void> {
  if (!unlocked) return;
  let s: AgentStatus;
  try {
    s = await invoke<AgentStatus>("get_status");
  } catch {
    const note = document.getElementById("poll-error");
    if (note) note.textContent = t("status.pollError");
    return;
  }

  if (!needsFullRender && document.getElementById("status-panel")) {
    patchStatus(s);
  } else {
    renderStatusFull(s);
    needsFullRender = false;
  }
}

setLang(getLang());
renderLogin();
