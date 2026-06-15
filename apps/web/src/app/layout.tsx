import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Display — Bricolage Grotesque is a variable font; let next/font expose the
// full weight axis so headings can run heavy without extra requests.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Body + data layer — the IBM Plex pair gives the dashboard a cohesive
// instrument feel (Sans for prose, Mono for every numeral/id/timestamp).
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActivityTrack — Signal",
  description: "Lightweight team activity dashboard",
};

export const viewport = {
  themeColor: "#0A0C0F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `lang` is updated client-side by the i18n provider; default to German.
  return (
    <html
      lang="de"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
