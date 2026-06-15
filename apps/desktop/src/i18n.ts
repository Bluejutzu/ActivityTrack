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
  "login.error.network": "Server nicht erreichbar. Netzwerk-/Verbindungsfehler.",
  "login.error.notConfigured":
    "Dieser Computer ist nicht konfiguriert. Siehe Diagnose unten.",
  "login.error.server": "Serverfehler. Technische Details unten.",
  "login.checking": "Wird geprüft …",
  "enroll.heading": "Geräteregistrierung",
  "enroll.hint": "Registrierungscode aus dem IT-Dashboard eingeben.",
  "enroll.code": "Code (z. B. AT-ABC123)",
  "enroll.submit": "Registrieren",
  "enroll.checking": "Wird registriert …",
  "enroll.error.invalid": "Ungültiger, bereits verwendeter oder abgelaufener Code.",
  "enroll.error.network": "Server nicht erreichbar. Netzwerk-/Verbindungsfehler.",
  "enroll.error.notConfigured":
    "Dieser Computer ist nicht konfiguriert. Siehe Diagnose unten.",
  "enroll.error.server": "Serverfehler. Technische Details unten.",
  "enroll.skip": "Überspringen (nur Status ansehen)",
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
  "status.enrolled": "Registriert",
  "status.notEnrolled": "Nicht registriert",
  "status.errors": "Letzte Fehler",
  "status.noErrors": "Keine Fehler aufgetreten.",
  "status.pollError": "Status konnte nicht geladen werden. Erneuter Versuch …",
  "status.lock": "Sperren",
  "status.refresh": "Aktualisieren",
  "samples.time": "Zeit",
  "samples.state": "Zustand",
  "samples.idle": "Untätigkeit",
  "errors.time": "Zeit",
  "errors.what": "Problem",
  "errors.detail": "Details",
  "error.code.tracker.send_failed": "Senden fehlgeschlagen",
  "error.code.tracker.queue_io": "Lokaler Speicher",
  "error.code.tracker.enroll_failed": "Einrichtung fehlgeschlagen",
  "error.details": "Technische Details",
  "diag.heading": "Diagnose",
  "diag.configFile": "Konfigurationsdatei",
  "diag.bootstrapKey": "Zugangsschlüssel",
  "diag.enrollment": "Registrierung",
  "diag.notSet": "nicht gesetzt",
  "diag.present": "vorhanden",
  "diag.missing": "fehlt",
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
  "login.error.network": "Cannot reach the server. Network/connection error.",
  "login.error.notConfigured":
    "This computer isn't configured. See diagnostics below.",
  "login.error.server": "Server error. Technical details below.",
  "login.checking": "Checking …",
  "enroll.heading": "Device Enrollment",
  "enroll.hint": "Enter the enrollment code from the IT dashboard.",
  "enroll.code": "Code (e.g. AT-ABC123)",
  "enroll.submit": "Enroll",
  "enroll.checking": "Enrolling …",
  "enroll.error.invalid": "Invalid, already used, or expired code.",
  "enroll.error.network": "Cannot reach the server. Network/connection error.",
  "enroll.error.notConfigured":
    "This computer isn't configured. See diagnostics below.",
  "enroll.error.server": "Server error. Technical details below.",
  "enroll.skip": "Skip (view status only)",
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
  "status.enrolled": "Enrolled",
  "status.notEnrolled": "Not enrolled",
  "status.errors": "Recent errors",
  "status.noErrors": "No errors recorded.",
  "status.pollError": "Couldn't load status. Retrying …",
  "status.lock": "Lock",
  "status.refresh": "Refresh",
  "samples.time": "Time",
  "samples.state": "State",
  "samples.idle": "Idle",
  "errors.time": "Time",
  "errors.what": "Problem",
  "errors.detail": "Detail",
  "error.code.tracker.send_failed": "Send failed",
  "error.code.tracker.queue_io": "Local storage",
  "error.code.tracker.enroll_failed": "Setup failed",
  "error.details": "Technical details",
  "diag.heading": "Diagnostics",
  "diag.configFile": "Config file",
  "diag.bootstrapKey": "Access key",
  "diag.enrollment": "Enrollment",
  "diag.notSet": "not set",
  "diag.present": "present",
  "diag.missing": "missing",
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
