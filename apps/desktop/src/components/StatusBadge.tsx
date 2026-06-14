interface Props {
  id?: string;
  ok: boolean;
  okLabel: string;
  altLabel: string;
  /** Class used when not `ok`. Active badge uses "muted"; others use "warn". */
  altClass?: "warn" | "muted";
}

export function StatusBadge({ id, ok, okLabel, altLabel, altClass = "warn" }: Props) {
  return (
    <span id={id} className={`badge ${ok ? "ok" : altClass}`}>
      {ok ? okLabel : altLabel}
    </span>
  );
}
