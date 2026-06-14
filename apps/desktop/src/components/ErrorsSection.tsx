import { t } from "../i18n.js";
import { fmtTime, errorLabel } from "../format.js";
import type { AgentError } from "../types.js";

export function ErrorsSection({ errors }: { errors: AgentError[] }) {
  if (errors.length === 0) {
    return <p className="hint">{t("status.noErrors")}</p>;
  }
  return (
    <table className="samples errors">
      <thead>
        <tr>
          <th>{t("errors.time")}</th>
          <th>{t("errors.what")}</th>
          <th>{t("errors.detail")}</th>
        </tr>
      </thead>
      <tbody>
        {errors.map((e, i) => (
          <tr key={`${e.at}-${i}`}>
            <td>{fmtTime(e.at)}</td>
            <td>{errorLabel(e.code)}</td>
            <td className="err-detail">{e.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
