/** Shared chart colours, kept in sync with the Tailwind palette tokens. */
export const CHART = {
  active: "#2ecc71", // ok
  idle: "#e67e22", // warn
  accent: "#4c8dff", // accent
  grid: "#232a36", // border
  axis: "#8b93a7", // muted
  panel: "#141821",
  fg: "#e6e9ef",
} as const;

/** Common tooltip styling props for Recharts <Tooltip />. */
export const tooltipStyle = {
  contentStyle: {
    background: "#1a1f2b",
    border: "1px solid #232a36",
    borderRadius: "0.5rem",
    color: "#e6e9ef",
    fontSize: "0.8rem",
  },
  labelStyle: { color: "#8b93a7" },
  cursor: { fill: "rgba(76,141,255,0.08)" },
} as const;
