import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// One clean, highly legible face for the whole interface. Inter reads as modern
// and friendly without the "instrument panel" feel of a display + mono pairing,
// and its tabular figures keep every metric aligned.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActivityTrack",
  description: "A simple view of your team's activity",
};

export const viewport = {
  themeColor: "#F7F8FA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `lang` is updated client-side by the i18n provider; default to German.
  return (
    <html lang="de" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
