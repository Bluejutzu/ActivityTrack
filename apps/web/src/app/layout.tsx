import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { themeBootScript } from "@/lib/theme";

// Body / UI face: Inter is modern, highly legible, and its tabular figures keep
// every metric aligned — so all data and chrome stays crisp.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Display face: Fraunces, a warm "old-style" serif, carries the editorial
// character of the brand on big headings and hero figures. Optical sizing on;
// only used where the design reaches for character (page H1s, hero numbers).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActivityTrack",
  description: "A simple view of your team's activity",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F2EC" },
    { media: "(prefers-color-scheme: dark)", color: "#171614" },
  ],
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
      className={`${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved/system theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
