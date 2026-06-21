import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../i18n.js";
import type { Diagnostics } from "../types.js";

/**
 * Always-available config/connectivity readout, shown on the pairing and login
 * screens. Lets a technician see *why* the tool can't reach the backend (missing
 * Convex URL, missing dashboard API URL, not paired, config file path) without
 * first getting past the password gate — the whole point of a debug tool.
 *
 * Defaults to open when something essential is missing, collapsed otherwise.
 */
export function DiagnosticsPanel() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  useEffect(() => {
    invoke<Diagnostics>("get_diagnostics")
      .then(setDiag)
      .catch(() => {
        /* command unavailable (dev/web preview); just render nothing */
      });
  }, []);

  if (!diag) return null;

  const healthy = diag.hasConvexUrl && diag.hasApiUrl;

  return (
    <details className="diag" open={!healthy}>
      <summary>{t("diag.heading")}</summary>
      <table className="kv">
        <tbody>
          <tr>
            <th>{t("status.convexUrl")}</th>
            <td>{diag.convexUrl || t("diag.notSet")}</td>
          </tr>
          <tr>
            <th>{t("diag.apiUrl")}</th>
            <td>{diag.apiUrl || t("diag.notSet")}</td>
          </tr>
          <tr>
            <th>{t("diag.configFile")}</th>
            <td>
              {diag.configFile} —{" "}
              {diag.configPresent ? t("diag.present") : t("diag.missing")}
            </td>
          </tr>
          <tr>
            <th>{t("diag.enrollment")}</th>
            <td>
              {diag.enrolled ? t("status.enrolled") : t("status.notEnrolled")}
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}
