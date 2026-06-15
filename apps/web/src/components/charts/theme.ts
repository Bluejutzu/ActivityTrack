/** Shared chart colours, kept in sync with the "Signal" Tailwind tokens. */
export const CHART = {
  active: "#C8F05A", // signal lime (= active/ok)
  idle: "#F5B544", // amber (= idle/warn)
  accent: "#C8F05A", // signal
  info: "#5CD0DE", // secondary cool series
  grid: "#1F2630", // border
  axis: "#838D9B", // muted
  panel: "#10141A",
  fg: "#E9EDF3",
} as const;

/** Common tooltip styling props for Recharts <Tooltip />. */
export const tooltipStyle = {
  contentStyle: {
    background: "#161C24",
    border: "1px solid #1F2630",
    borderRadius: "0.5rem",
    color: "#E9EDF3",
    fontSize: "0.75rem",
    fontFamily: "var(--font-mono)",
    boxShadow: "0 18px 44px -22px rgba(0,0,0,0.85)",
  },
  labelStyle: { color: "#838D9B" },
  cursor: { fill: "rgba(200,240,90,0.08)" },
} as const;
