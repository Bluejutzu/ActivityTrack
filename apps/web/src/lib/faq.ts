/**
 * Structure of the in-app Help / FAQ. Content is not stored here — each entry id
 * maps to localized strings `faq.q.<id>` (question) and `faq.a.<id>` (answer),
 * and each section to `faq.section.<id>`, in lib/locales/{de,en}.ts. Keeping the
 * structure data-driven means adding a Q&A is just two translation keys.
 */
export interface FaqSection {
  id: string;
  /** Entry ids, in display order. */
  entries: string[];
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "access",
    entries: ["signin_denied", "domain", "roles", "add_admin"],
  },
  {
    id: "tracker",
    entries: ["not_reporting", "offline", "enroll_failed", "debug_password"],
  },
  {
    id: "integrations",
    entries: ["integration_down", "clockodo_setup"],
  },
  {
    id: "general",
    entries: ["privacy", "retention", "add_person", "approve_device"],
  },
];

/** All entry ids flattened — handy for search/iteration. */
export const FAQ_ENTRY_IDS: string[] = FAQ_SECTIONS.flatMap((s) => s.entries);
