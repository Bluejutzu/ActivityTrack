"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Lightweight i18n for the dashboard. German is the default (German
 * workspace); English is selectable from the header. The choice persists in
 * localStorage. Keys are flat strings; missing keys fall back to English then
 * the key itself, so a partial translation never renders blank.
 */
export type Lang = "de" | "en";

type Dict = Record<string, string>;

const de: Dict = {
  "app.name": "ActivityTrack",
  "app.tagline": "Aktivitätsübersicht für das Team",
  "nav.overview": "Übersicht",
  "nav.devices": "Geräte",
  "nav.people": "Mitarbeiter",
  "nav.users": "Benutzer & Rollen",
  "nav.audit": "Protokoll",
  "nav.settings": "Einstellungen",
  "nav.signout": "Abmelden",
  "lang.label": "Sprache",
  "role.it_admin": "IT-Administrator",
  "role.manager": "Manager",
  "role.viewer": "Betrachter",

  "login.heading": "Anmelden",
  "login.signupHeading": "Konto erstellen",
  "login.email": "E-Mail",
  "login.password": "Passwort",
  "login.submit": "Anmelden",
  "login.signupSubmit": "Registrieren",
  "login.toSignup": "Noch kein Konto? Registrieren",
  "login.toSignin": "Bereits ein Konto? Anmelden",
  "login.error": "Anmeldung fehlgeschlagen. Bitte Daten prüfen.",
  "login.firstUserNote":
    "Das erste registrierte Konto wird automatisch IT-Administrator.",
  "login.passwordHint": "Mindestens 8 Zeichen.",
  "login.feature.insights":
    "Aktivitätsmuster auf einen Blick — Diagramme statt endloser Listen.",
  "login.feature.privacy":
    "Nur Aktiv-/Inaktivzeiten — keine Screenshots, keine Tastatureingaben.",

  "overview.heading": "Team-Übersicht",
  "overview.empty":
    "Noch keine genehmigten Geräte. Genehmigen Sie ein Gerät unter „Geräte“.",
  "overview.working": "Arbeitet",
  "overview.idleNow": "Inaktiv",
  "overview.offline": "Offline",
  "overview.todayActive": "heute aktiv",
  "overview.unassigned": "Nicht zugewiesen",
  "overview.lastSeen": "Zuletzt gesehen",
  "overview.total": "Geräte gesamt",

  "devices.heading": "Geräte",
  "devices.pending": "Wartet auf Genehmigung",
  "devices.all": "Alle Geräte",
  "devices.host": "Computer",
  "devices.user": "Benutzer",
  "devices.status": "Status",
  "devices.person": "Mitarbeiter",
  "devices.lastSeen": "Zuletzt gesehen",
  "devices.actions": "Aktionen",
  "devices.approve": "Genehmigen",
  "devices.disable": "Deaktivieren",
  "devices.link": "Zuordnen",
  "devices.none": "—",
  "status.pending": "Ausstehend",
  "status.active": "Aktiv",
  "status.disabled": "Deaktiviert",

  "people.heading": "Mitarbeiter",
  "people.add": "Mitarbeiter hinzufügen",
  "people.name": "Name",
  "people.email": "E-Mail",
  "people.active": "Aktiv",
  "people.save": "Speichern",
  "people.delete": "Löschen",
  "people.cancel": "Abbrechen",
  "people.confirmDelete": "Diesen Mitarbeiter wirklich löschen?",

  "users.heading": "Benutzer & Rollen",
  "users.email": "E-Mail",
  "users.name": "Name",
  "users.role": "Rolle",

  "audit.heading": "Audit-Protokoll",
  "audit.when": "Zeitpunkt",
  "audit.actor": "Benutzer",
  "audit.action": "Aktion",
  "audit.target": "Ziel",
  "audit.empty": "Noch keine Einträge.",

  "settings.heading": "Einstellungen",
  "settings.debugPw.heading": "Passwort für Tracker-Debug",
  "settings.debugPw.hint":
    "Legt das Passwort fest, mit dem die Tracker-Oberfläche auf den PCs entsperrt wird.",
  "settings.debugPw.set": "Passwort ist gesetzt.",
  "settings.debugPw.unset": "Noch kein Passwort gesetzt.",
  "settings.debugPw.new": "Neues Passwort",
  "settings.debugPw.save": "Passwort speichern",
  "settings.debugPw.saved": "Passwort gespeichert.",
  "settings.debugPw.tooShort": "Mindestens 6 Zeichen.",

  "timeline.heading": "Verlauf",
  "timeline.back": "Zurück zur Übersicht",
  "timeline.time": "Zeit",
  "timeline.state": "Zustand",
  "timeline.idle": "Untätigkeit",
  "timeline.empty": "Keine Stichproben vorhanden.",
  "timeline.kpi.activeToday": "Heute aktiv",
  "timeline.kpi.idleToday": "Heute inaktiv",
  "timeline.kpi.status": "Status",
  "timeline.kpi.lastSeen": "Zuletzt gesehen",
  "timeline.trend.heading": "Aktivität der letzten 14 Tage",
  "timeline.trend.sub": "Aktive vs. inaktive Stunden pro Tag.",
  "timeline.intraday.heading": "Tagesverlauf",
  "timeline.intraday.sub": "Anteil aktiver Stichproben im Zeitverlauf.",
  "timeline.intraday.series": "Aktiv %",
  "timeline.heatmap.heading": "Aktivität nach Tageszeit",
  "timeline.heatmap.sub": "Wann diese Person typischerweise aktiv ist.",
  "timeline.tabs.charts": "Übersicht",
  "timeline.tabs.raw": "Rohdaten",
  "timeline.online": "Online",
  "timeline.offline": "Offline",

  "common.loading": "Wird geladen …",
  "common.active": "Aktiv",
  "common.idle": "Inaktiv",
  "common.forbidden": "Keine Berechtigung für diese Ansicht.",
  "footer.privacy":
    "Datenschutz: ActivityTrack erfasst nur Aktivitätszeiten (aktiv/inaktiv) auf firmeneigenen Geräten — keine Screenshots, keine Tastatureingaben. Mitarbeiter sind informiert.",

  "devices.slots.heading": "Einschreibungs-Codes",
  "devices.slots.create": "Neuer Code",
  "devices.slots.label": "Bezeichnung (optional)",
  "devices.slots.labelPlaceholder": "z. B. „Für Johann Smith“",
  "devices.slots.expiry": "Gültig für",
  "devices.slots.expiry24": "24 Stunden",
  "devices.slots.expiry48": "48 Stunden",
  "devices.slots.expiry7d": "7 Tage",
  "devices.slots.cancel": "Abbrechen",
  "devices.slots.copy": "Kopieren",
  "devices.slots.copied": "Kopiert!",
  "devices.slots.revoke": "Widerrufen",
  "devices.slots.status.active": "Aktiv",
  "devices.slots.status.used": "Eingelöst",
  "devices.slots.status.expired": "Abgelaufen",
  "devices.slots.status.revoked": "Widerrufen",
  "devices.slots.expires": "Läuft ab",
  "devices.slots.usedAt": "Eingelöst",
  "devices.slots.empty": "Noch keine Codes. Erstellen Sie einen, um ein neues Gerät einzuschreiben.",
  "devices.slots.note": "Tragen Sie diesen Code in die config.json des Trackers ein — er wird beim ersten Start automatisch verwendet.",
  "devices.slots.heading.devices": "Alle Geräte",

  "users.roleUpdated": "Rolle aktualisiert.",
  "people.updated": "Gespeichert.",
  "people.deleted": "Mitarbeiter gelöscht.",
  "devices.approved": "Gerät genehmigt.",
  "devices.disabled": "Gerät deaktiviert.",
  "devices.linked": "Mitarbeiter zugeordnet.",
  "devices.slotRevoked": "Code widerrufen.",

  "nav.health": "Systemstatus",

  // Error toasts — shown when an action fails. Keyed by the backend error code.
  "error.generic": "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
  "error.network": "Keine Verbindung zum Server. Bitte später erneut versuchen.",
  "error.auth.required": "Bitte erneut anmelden.",
  "error.auth.forbidden": "Dafür fehlt Ihnen die Berechtigung.",
  "error.notFound.device": "Das Gerät wurde nicht gefunden (evtl. bereits gelöscht).",
  "error.notFound.person": "Der Mitarbeiter wurde nicht gefunden.",
  "error.notFound.user": "Der Benutzer wurde nicht gefunden.",
  "error.notFound.slot": "Der Code wurde nicht gefunden.",
  "error.notFound.event": "Der Eintrag wurde nicht gefunden.",
  "error.validation.password_short": "Das Passwort muss mindestens 6 Zeichen haben.",
  "error.user.cannot_demote_self":
    "Sie können sich nicht selbst die IT-Administratorrolle entziehen.",

  // System health page.
  "health.heading": "Systemstatus",
  "health.subtitle": "Verbindung der Geräte und gemeldete Störungen auf einen Blick.",
  "health.allGood.title": "Alles in Ordnung",
  "health.allGood.body": "Alle Geräte melden sich und es liegen keine offenen Störungen vor.",
  "health.attention.title": "{count} Sache(n) brauchen Aufmerksamkeit",
  "health.attention.body": "Eine Übersicht finden Sie unten.",
  "health.offline.heading": "Geräte, die sich nicht melden",
  "health.offline.lastSeen": "Zuletzt gesehen {time}",
  "health.offline.for": "seit {duration} offline",
  "health.offline.unassigned": "Nicht zugewiesenes Gerät",
  "health.issues.heading": "Gemeldete Störungen",
  "health.issues.none": "Keine offenen Störungen.",
  "health.issues.occurrences": "{count}×",
  "health.issues.lastAt": "zuletzt {time}",
  "health.resolve": "Erledigt",
  "health.resolved": "Als erledigt markiert.",
  "health.detail.heading": "Technische Details (nur IT)",
  "health.detail.toggleOpen": "Nur offene anzeigen",
  "health.detail.toggleAll": "Alle anzeigen",
  "health.detail.severity": "Schwere",
  "health.detail.event": "Ereignis",
  "health.detail.message": "Meldung",
  "health.detail.source": "Quelle",
  "health.detail.device": "Gerät",
  "health.detail.count": "Anzahl",
  "health.detail.lastAt": "Zuletzt",
  "health.detail.status": "Status",
  "health.detail.empty": "Keine Ereignisse protokolliert.",
  "health.detail.statusOpen": "Offen",
  "health.detail.statusResolved": "Erledigt",
  "health.sev.info": "Info",
  "health.sev.warning": "Warnung",
  "health.sev.error": "Fehler",
  "health.sev.critical": "Kritisch",
  "health.src.backend": "Server",
  "health.src.tracker": "Gerät",
  "health.src.dashboard": "Dashboard",

  // Plain-language descriptions per event code (for non-technical viewers).
  "health.friendly.ingest.unauthorized":
    "Ein unbekanntes oder gesperrtes Gerät hat versucht, Daten zu senden.",
  "health.friendly.ingest.bad_payload":
    "Ein Gerät hat fehlerhafte Daten gesendet.",
  "health.friendly.enroll.unauthorized":
    "Eine nicht autorisierte Installation hat versucht, sich zu registrieren.",
  "health.friendly.enroll.code_invalid":
    "Ein ungültiger oder abgelaufener Einschreibungs-Code wurde verwendet.",
  "health.friendly.tracker.send_failed":
    "Ein Computer kann den Server nicht erreichen, um Daten zu senden.",
  "health.friendly.tracker.enroll_failed":
    "Die Ersteinrichtung eines Computers ist fehlgeschlagen.",
  "health.friendly.tracker.queue_io":
    "Ein Computer kann seine Daten lokal nicht zwischenspeichern.",
  "health.friendly.dashboard.crash":
    "Im Dashboard ist ein unerwarteter Fehler aufgetreten.",
  "health.friendly.unknown": "Ein Problem wurde gemeldet.",

  // ErrorBoundary fallback.
  "errorBoundary.title": "Etwas ist schiefgelaufen",
  "errorBoundary.body":
    "Dieser Bereich konnte nicht geladen werden. Das Problem wurde automatisch an die IT gemeldet.",
  "errorBoundary.retry": "Erneut versuchen",

  // Auth provisioning gate (user row could not be created/loaded).
  "auth.error.title": "Anmeldung konnte nicht abgeschlossen werden",
  "auth.error.body":
    "Ihr Konto konnte nicht geladen werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
  "auth.error.retry": "Erneut versuchen",
};

const en: Dict = {
  "app.name": "ActivityTrack",
  "app.tagline": "Team activity at a glance",
  "nav.overview": "Overview",
  "nav.devices": "Devices",
  "nav.people": "People",
  "nav.users": "Users & roles",
  "nav.audit": "Audit log",
  "nav.settings": "Settings",
  "nav.signout": "Sign out",
  "lang.label": "Language",
  "role.it_admin": "IT admin",
  "role.manager": "Manager",
  "role.viewer": "Viewer",

  "login.heading": "Sign in",
  "login.signupHeading": "Create account",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.signupSubmit": "Register",
  "login.toSignup": "No account yet? Register",
  "login.toSignin": "Already have an account? Sign in",
  "login.error": "Sign-in failed. Please check your details.",
  "login.firstUserNote":
    "The first account to register automatically becomes IT admin.",
  "login.passwordHint": "Minimum 8 characters.",
  "login.feature.insights":
    "Activity patterns at a glance — charts instead of endless lists.",
  "login.feature.privacy":
    "Active/idle timing only — no screenshots, no keystrokes.",

  "overview.heading": "Team overview",
  "overview.empty": "No approved devices yet. Approve one under “Devices”.",
  "overview.working": "Working",
  "overview.idleNow": "Idle",
  "overview.offline": "Offline",
  "overview.todayActive": "active today",
  "overview.unassigned": "Unassigned",
  "overview.lastSeen": "Last seen",
  "overview.total": "Devices total",

  "devices.heading": "Devices",
  "devices.pending": "Pending approval",
  "devices.all": "All devices",
  "devices.host": "Computer",
  "devices.user": "User",
  "devices.status": "Status",
  "devices.person": "Person",
  "devices.lastSeen": "Last seen",
  "devices.actions": "Actions",
  "devices.approve": "Approve",
  "devices.disable": "Disable",
  "devices.link": "Link",
  "devices.none": "—",
  "status.pending": "Pending",
  "status.active": "Active",
  "status.disabled": "Disabled",

  "people.heading": "People",
  "people.add": "Add person",
  "people.name": "Name",
  "people.email": "Email",
  "people.active": "Active",
  "people.save": "Save",
  "people.delete": "Delete",
  "people.cancel": "Cancel",
  "people.confirmDelete": "Really delete this person?",

  "users.heading": "Users & roles",
  "users.email": "Email",
  "users.name": "Name",
  "users.role": "Role",

  "audit.heading": "Audit log",
  "audit.when": "When",
  "audit.actor": "User",
  "audit.action": "Action",
  "audit.target": "Target",
  "audit.empty": "No entries yet.",

  "settings.heading": "Settings",
  "settings.debugPw.heading": "Tracker debug password",
  "settings.debugPw.hint":
    "Sets the password that unlocks the tracker UI on the PCs.",
  "settings.debugPw.set": "Password is set.",
  "settings.debugPw.unset": "No password set yet.",
  "settings.debugPw.new": "New password",
  "settings.debugPw.save": "Save password",
  "settings.debugPw.saved": "Password saved.",
  "settings.debugPw.tooShort": "At least 6 characters.",

  "timeline.heading": "Timeline",
  "timeline.back": "Back to overview",
  "timeline.time": "Time",
  "timeline.state": "State",
  "timeline.idle": "Idle",
  "timeline.empty": "No samples available.",
  "timeline.kpi.activeToday": "Active today",
  "timeline.kpi.idleToday": "Idle today",
  "timeline.kpi.status": "Status",
  "timeline.kpi.lastSeen": "Last seen",
  "timeline.trend.heading": "Last 14 days",
  "timeline.trend.sub": "Active vs idle hours per day.",
  "timeline.intraday.heading": "Across the day",
  "timeline.intraday.sub": "Share of active samples over time.",
  "timeline.intraday.series": "Active %",
  "timeline.heatmap.heading": "Activity by time of day",
  "timeline.heatmap.sub": "When this person is typically active.",
  "timeline.tabs.charts": "Overview",
  "timeline.tabs.raw": "Raw data",
  "timeline.online": "Online",
  "timeline.offline": "Offline",

  "common.loading": "Loading …",
  "common.active": "Active",
  "common.idle": "Idle",
  "common.forbidden": "You do not have permission to view this.",
  "footer.privacy":
    "Privacy: ActivityTrack records activity timing only (active/idle) on company-owned devices — no screenshots, no keystrokes. Staff are informed.",

  "devices.slots.heading": "Enrollment Codes",
  "devices.slots.create": "New Code",
  "devices.slots.label": "Label (optional)",
  "devices.slots.labelPlaceholder": "e.g. “For John Smith’s PC”",
  "devices.slots.expiry": "Valid for",
  "devices.slots.expiry24": "24 hours",
  "devices.slots.expiry48": "48 hours",
  "devices.slots.expiry7d": "7 days",
  "devices.slots.cancel": "Cancel",
  "devices.slots.copy": "Copy",
  "devices.slots.copied": "Copied!",
  "devices.slots.revoke": "Revoke",
  "devices.slots.status.active": "Active",
  "devices.slots.status.used": "Used",
  "devices.slots.status.expired": "Expired",
  "devices.slots.status.revoked": "Revoked",
  "devices.slots.expires": "Expires",
  "devices.slots.usedAt": "Used",
  "devices.slots.empty": "No codes yet. Create one to enroll a new device.",
  "devices.slots.note": "Add this code to the tracker’s config.json — it will be used automatically on first launch.",
  "devices.slots.heading.devices": "All Devices",

  "users.roleUpdated": "Role updated.",
  "people.updated": "Saved.",
  "people.deleted": "Person deleted.",
  "devices.approved": "Device approved.",
  "devices.disabled": "Device disabled.",
  "devices.linked": "Person linked.",
  "devices.slotRevoked": "Code revoked.",

  "nav.health": "System health",

  // Error toasts — shown when an action fails. Keyed by the backend error code.
  "error.generic": "Something went wrong. Please try again.",
  "error.network": "Can't reach the server. Please try again shortly.",
  "error.auth.required": "Please sign in again.",
  "error.auth.forbidden": "You don't have permission to do that.",
  "error.notFound.device": "That device was not found (it may have been removed).",
  "error.notFound.person": "That person was not found.",
  "error.notFound.user": "That user was not found.",
  "error.notFound.slot": "That code was not found.",
  "error.notFound.event": "That entry was not found.",
  "error.validation.password_short": "The password must be at least 6 characters.",
  "error.user.cannot_demote_self":
    "You can't remove your own IT admin role.",

  // System health page.
  "health.heading": "System health",
  "health.subtitle": "Device connectivity and reported issues at a glance.",
  "health.allGood.title": "All systems normal",
  "health.allGood.body": "Every device is reporting and there are no open issues.",
  "health.attention.title": "{count} thing(s) need attention",
  "health.attention.body": "See the breakdown below.",
  "health.offline.heading": "Devices that have gone quiet",
  "health.offline.lastSeen": "Last seen {time}",
  "health.offline.for": "offline for {duration}",
  "health.offline.unassigned": "Unassigned device",
  "health.issues.heading": "Reported issues",
  "health.issues.none": "No open issues.",
  "health.issues.occurrences": "{count}×",
  "health.issues.lastAt": "last {time}",
  "health.resolve": "Resolve",
  "health.resolved": "Marked as resolved.",
  "health.detail.heading": "Technical detail (IT only)",
  "health.detail.toggleOpen": "Open only",
  "health.detail.toggleAll": "Show all",
  "health.detail.severity": "Severity",
  "health.detail.event": "Event",
  "health.detail.message": "Message",
  "health.detail.source": "Source",
  "health.detail.device": "Device",
  "health.detail.count": "Count",
  "health.detail.lastAt": "Last",
  "health.detail.status": "Status",
  "health.detail.empty": "No events logged.",
  "health.detail.statusOpen": "Open",
  "health.detail.statusResolved": "Resolved",
  "health.sev.info": "Info",
  "health.sev.warning": "Warning",
  "health.sev.error": "Error",
  "health.sev.critical": "Critical",
  "health.src.backend": "Server",
  "health.src.tracker": "Device",
  "health.src.dashboard": "Dashboard",

  // Plain-language descriptions per event code (for non-technical viewers).
  "health.friendly.ingest.unauthorized":
    "An unknown or blocked device tried to send data.",
  "health.friendly.ingest.bad_payload": "A device sent malformed data.",
  "health.friendly.enroll.unauthorized":
    "An unauthorized install tried to register.",
  "health.friendly.enroll.code_invalid":
    "An invalid or expired enrollment code was used.",
  "health.friendly.tracker.send_failed":
    "A computer can't reach the server to send data.",
  "health.friendly.tracker.enroll_failed":
    "A computer's initial setup failed.",
  "health.friendly.tracker.queue_io":
    "A computer can't buffer its data locally.",
  "health.friendly.dashboard.crash":
    "The dashboard hit an unexpected error.",
  "health.friendly.unknown": "An issue was reported.",

  // ErrorBoundary fallback.
  "errorBoundary.title": "Something went wrong",
  "errorBoundary.body":
    "This area couldn't be loaded. The problem was automatically reported to IT.",
  "errorBoundary.retry": "Try again",

  // Auth provisioning gate (user row could not be created/loaded).
  "auth.error.title": "Couldn't finish signing you in",
  "auth.error.body":
    "We couldn't load your account. Please check your connection and try again.",
  "auth.error.retry": "Try again",
};

const DICTS: Record<Lang, Dict> = { de, en };
const STORAGE_KEY = "activitytrack.lang";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate `key`, interpolating `{name}`-style placeholders from `vars`. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "de" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
        name in vars ? String(vars[name]) : `{${name}}`,
      );
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
