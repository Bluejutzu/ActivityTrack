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
  "login.hint": "Tray-Passwort eingeben, um dieses Gerät zu verwalten.",
  "login.email": "E-Mail",
  "login.password": "Passwort",
  "login.unlock": "Öffnen",
  "login.submit": "Entsperren",
  "login.error.wrong": "Falsches Passwort.",
  "login.error.unset":
    "Es wurde noch kein Passwort in der Verwaltung festgelegt.",
  "login.error.network":
    "Server nicht erreichbar. Netzwerk-/Verbindungsfehler.",
  "login.error.notConfigured":
    "Dieser Computer ist nicht konfiguriert. Siehe Diagnose unten.",
  "login.error.server": "Serverfehler. Technische Details unten.",
  "login.checking": "Wird geprüft …",
  "enroll.heading": "Geräteregistrierung",
  "enroll.hint": "Registrierungscode aus dem IT-Dashboard eingeben.",
  "enroll.code": "Code (z. B. AT-ABC123)",
  "enroll.submit": "Registrieren",
  "enroll.checking": "Wird registriert …",
  "enroll.error.invalid":
    "Ungültiger, bereits verwendeter oder abgelaufener Code.",
  "enroll.error.network":
    "Server nicht erreichbar. Netzwerk-/Verbindungsfehler.",
  "enroll.error.notConfigured":
    "Dieser Computer ist nicht konfiguriert. Siehe Diagnose unten.",
  "enroll.error.server": "Serverfehler. Technische Details unten.",
  "enroll.skip": "Überspringen (nur Status ansehen)",
  "pairing.heading": "Gerät wird gekoppelt",
  "pairing.unconfigured":
    "Dieser Computer ist nicht konfiguriert (Dashboard-API-URL fehlt). Siehe Diagnose unten.",
  "pairing.registering": "Gerät wird beim Dashboard angemeldet …",
  "pairing.pending":
    "Warten auf Freigabe durch die IT. Sobald das Gerät im Dashboard freigegeben ist, geht es automatisch weiter.",
  "pairing.disabled":
    "Dieses Gerät wurde von der IT deaktiviert. Bitte an die IT wenden.",
  "pairing.denied":
    "Kopplung abgelehnt (Konflikt mit der Geräte-ID). Wird automatisch neu versucht …",
  "pairing.error":
    "Kopplung derzeit nicht möglich. Details unten; wird automatisch erneut versucht.",
  "pairing.waiting": "Warten auf Freigabe …",
  "status.heading": "Status",
  "status.active": "Aktiv",
  "status.idle": "Inaktiv",
  "status.online": "Verbunden",
  "status.offline": "Nicht verbunden",
  "status.device": "Geräte-ID",
  "status.processId": "Prozess-ID",
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
  "error.code.tracker.pair_failed": "Kopplung fehlgeschlagen",
  "error.details": "Technische Details",
  "diag.heading": "Diagnose",
  "diag.configFile": "Konfigurationsdatei",
  "diag.apiUrl": "Dashboard-API-URL",
  "diag.enrollment": "Registrierung",
  "diag.notSet": "nicht gesetzt",
  "diag.present": "vorhanden",
  "diag.missing": "fehlt",
  "lang.label": "Sprache",
  "theme.toDark": "Dunkles Design",
  "theme.toLight": "Helles Design",
  "update.checking": "Suche nach Updates …",
  "update.available": "Update verfügbar: v{version}",
  "update.installing": "Update wird installiert …",
  "update.installed": "Update installiert! App wird neu gestartet …",
  "update.uptodate": "App ist auf dem neuesten Stand",
  "update.error": "Update fehlgeschlagen: {error}",
  "units.seconds": "Sek.",
  "units.minutes": "Min.",
  "units.hours": "Std.",
};

const en: Dict = {
  "app.title": "ActivityTrack",
  "login.heading": "Login required",
  "login.hint": "Enter the tray password to manage this device.",
  "login.email": "Email",
  "login.password": "Password",
  "login.unlock": "Open",
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
  "pairing.heading": "Pairing device",
  "pairing.unconfigured":
    "This computer isn't configured (dashboard API URL missing). See diagnostics below.",
  "pairing.registering": "Registering this device with the dashboard …",
  "pairing.pending":
    "Waiting for IT to approve this device. It continues automatically once approved in the dashboard.",
  "pairing.disabled":
    "This device has been disabled by IT. Please contact your administrator.",
  "pairing.denied":
    "Pairing was denied (device-id conflict). Retrying automatically …",
  "pairing.error":
    "Can't pair right now. Details below; it will keep retrying automatically.",
  "pairing.waiting": "Waiting for approval …",
  "status.heading": "Status",
  "status.active": "Active",
  "status.idle": "Idle",
  "status.online": "Connected",
  "status.offline": "Disconnected",
  "status.device": "Device ID",
  "status.processId": "Process ID",
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
  "error.code.tracker.pair_failed": "Pairing failed",
  "error.details": "Technical details",
  "diag.heading": "Diagnostics",
  "diag.configFile": "Config file",
  "diag.apiUrl": "Dashboard API URL",
  "diag.enrollment": "Enrollment",
  "diag.notSet": "not set",
  "diag.present": "present",
  "diag.missing": "missing",
  "lang.label": "Language",
  "theme.toDark": "Dark mode",
  "theme.toLight": "Light mode",
  "update.checking": "Checking for updates …",
  "update.available": "Update available: v{version}",
  "update.installing": "Installing update …",
  "update.installed": "Update installed! Restarting app …",
  "update.uptodate": "App is up to date",
  "update.error": "Update failed: {error}",
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

export function t(key: string, params?: Record<string, string>): string {
  const template = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (s, [name, value]) => s.replaceAll(`{${name}}`, value),
    template,
  );
}
