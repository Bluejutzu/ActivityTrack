import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { themeBootScript } from "@/lib/theme";

// One clean, highly legible face for the whole interface. Inter reads as modern
// and crisp; its tabular figures keep every metric aligned, and large tight
// sizes carry the heading hierarchy without a separate display/serif face.
// Exposed as `--font-inter`; the theme maps sans/display/mono onto it.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
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
    <html lang="de" className={inter.variable} suppressHydrationWarning>
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
