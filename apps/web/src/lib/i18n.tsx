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

  "overview.heading": "Team-Übersicht",
  "overview.empty":
    "Noch keine genehmigten Geräte. Genehmigen Sie ein Gerät unter „Geräte“.",
  "overview.working": "Arbeitet",
  "overview.idleNow": "Inaktiv",
  "overview.offline": "Offline",
  "overview.todayActive": "heute aktiv",
  "overview.unassigned": "Nicht zugewiesen",
  "overview.lastSeen": "Zuletzt gesehen",

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

  "overview.heading": "Team overview",
  "overview.empty": "No approved devices yet. Approve one under “Devices”.",
  "overview.working": "Working",
  "overview.idleNow": "Idle",
  "overview.offline": "Offline",
  "overview.todayActive": "active today",
  "overview.unassigned": "Unassigned",
  "overview.lastSeen": "Last seen",

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
};

const DICTS: Record<Lang, Dict> = { de, en };
const STORAGE_KEY = "activitytrack.lang";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
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
    (key: string) => DICTS[lang][key] ?? DICTS.en[key] ?? key,
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
