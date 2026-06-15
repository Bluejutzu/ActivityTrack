/** Shared chart colours, kept in sync with the "Daylight" Tailwind tokens. */
export const CHART = {
  active: "#10A372", // green (= working/ok)
  idle: "#C2740C", // amber (= idle/warn)
  accent: "#2E6CF6", // brand blue
  info: "#0E92C9", // secondary cool series
  grid: "#E4E8EE", // border
  axis: "#5B6573", // muted
  panel: "#FFFFFF",
  fg: "#1B2027",
} as const;

/** Common tooltip styling props for Recharts <Tooltip />. */
export const tooltipStyle = {
  contentStyle: {
    background: "#FFFFFF",
    border: "1px solid #E4E8EE",
    borderRadius: "0.5rem",
    color: "#1B2027",
    fontSize: "0.75rem",
    fontFamily: "var(--font-sans)",
    boxShadow: "0 6px 16px -8px rgba(16,24,40,0.18)",
  },
  labelStyle: { color: "#5B6573" },
  cursor: { fill: "rgba(46,108,246,0.08)" },
} as const;
