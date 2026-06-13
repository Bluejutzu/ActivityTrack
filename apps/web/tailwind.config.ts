import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#141821",
        border: "#232a36",
        muted: "#8b93a7",
        accent: "#4c8dff",
        ok: "#2ecc71",
        warn: "#e67e22",
        danger: "#e74c3c",
      },
    },
  },
  plugins: [],
} satisfies Config;
