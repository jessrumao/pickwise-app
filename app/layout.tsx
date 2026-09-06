import type { Metadata } from "next";
import { Inter, Geist_Mono, Syne } from "next/font/google";
import { AI_DESCRIPTION, BROWSER_TAB_TITLE } from "@/config";
import "./globals.css";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the Pickwise product surfaces (landing, about, intake,
// results) -- headings, nav, labels, buttons. Not used by /chat or /terms,
// which keep the original myAI6 look untouched.
const syne = Syne({
  variable: "--font-syne",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: BROWSER_TAB_TITLE,
  description: AI_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} ${syne.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
