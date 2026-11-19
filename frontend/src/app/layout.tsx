import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// One friendly geometric font for the whole CMS: Plus Jakarta Sans (SIL Open Font License, see fonts/OFL-LICENSE.txt).
// Stored in the project, so it works offline and needs no request to Google.
const sans = localFont({ src: "./fonts/PlusJakartaSans.woff2", weight: "200 800", variable: "--font-sans", display: "swap" });

export const metadata: Metadata = { title: "Elanster CMS", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={sans.variable}><body>{children}</body></html>);
}
