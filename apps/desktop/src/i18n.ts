/**
 * Tiny i18n for the tray UI. German is the default (German workspace); English
 * is selectable. The choice persists in localStorage so it survives reopening
 * the window. Keep this dependency-free — the UI is intentionally minimal.
 */
export type Lang = "de" | "en";

type Dict = Record<string, string>;

const de: Dict = {
  "app.title": "ActivityTrack",
  "login.heading": "Anmeldung erforderlich",
  "login.hint": "Bitte das von der IT festgelegte Passwort eingeben.",
  "login.password": "Passwort",
  "login.submit": "Entsperren",
  "login.error.wrong": "Falsches Passwort.",
  "login.error.unset": "Es wurde noch kein Passwort in der Verwaltung festgelegt.",
  "login.error.network": "Server nicht erreichbar.",
  "login.checking": "Wird geprüft …",
  "status.heading": "Status",
  "status.active": "Aktiv",
  "status.idle": "Inaktiv",
  "status.online": "Verbunden",
  "status.offline": "Nicht verbunden",
  "status.device": "Geräte-ID",
  "status.host": "Computer",
  "status.user": "Windows-Benutzer",
  "status.idleFor": "Untätig seit",
  "status.queue": "Warteschlange",
  "status.lastSent": "Zuletzt gesendet",
  "status.never": "nie",
  "status.lastError": "Letzter Fehler",
  "status.none": "keiner",
  "status.convexUrl": "Convex-URL",
  "status.notConfigured": "Nicht konfiguriert (config.json fehlt)",
  "status.version": "Agent-Version",
  "status.recent": "Zuletzt gesendete Stichproben",
  "status.lock": "Sperren",
  "status.refresh": "Aktualisieren",
  "samples.time": "Zeit",
  "samples.state": "Zustand",
  "samples.idle": "Untätigkeit",
  "lang.label": "Sprache",
  "units.seconds": "Sek.",
  "units.minutes": "Min.",
  "units.hours": "Std.",
};

const en: Dict = {
  "app.title": "ActivityTrack",
  "login.heading": "Login required",
  "login.hint": "Enter the password set by IT.",
  "login.password": "Password",
  "login.submit": "Unlock",
  "login.error.wrong": "Wrong password.",
  "login.error.unset": "No password has been set in the dashboard yet.",
  "login.error.network": "Cannot reach the server.",
  "login.checking": "Checking …",
  "status.heading": "Status",
  "status.active": "Active",
  "status.idle": "Idle",
  "status.online": "Connected",
  "status.offline": "Disconnected",
  "status.device": "Device ID",
  "status.host": "Computer",
  "status.user": "Windows user",
  "status.idleFor": "Idle for",
  "status.queue": "Queue",
  "status.lastSent": "Last sent",
  "status.never": "never",
  "status.lastError": "Last error",
  "status.none": "none",
  "status.convexUrl": "Convex URL",
  "status.notConfigured": "Not configured (config.json missing)",
  "status.version": "Agent version",
  "status.recent": "Recently sent samples",
  "status.lock": "Lock",
  "status.refresh": "Refresh",
  "samples.time": "Time",
  "samples.state": "State",
  "samples.idle": "Idle",
  "lang.label": "Language",
  "units.seconds": "s",
  "units.minutes": "m",
  "units.hours": "h",
};

const DICTS: Record<Lang, Dict> = { de, en };
const STORAGE_KEY = "activitytrack.lang";

let current: Lang = loadLang();

function loadLang(): Lang {
  const saved = (typeof localStorage !== "undefined" &&
    localStorage.getItem(STORAGE_KEY)) as Lang | null;
  return saved === "en" || saved === "de" ? saved : "de";
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang;
}

export function t(key: string): string {
  return DICTS[current][key] ?? DICTS.en[key] ?? key;
}
