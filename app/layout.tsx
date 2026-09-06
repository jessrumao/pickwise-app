import type { Metadata } from "next";
import { Inter, Geist_Mono, Syne } from "next/font/google";
import { BROWSER_TAB_TITLE, SITE_DESCRIPTION } from "@/config";
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

// metadataBase resolves the relative /logo.png below into an absolute URL —
// required for Open Graph/Twitter card images to render on link-preview
// scrapers (WhatsApp, Slack, iMessage, Twitter/X), which fetch the image
// directly rather than loading it in a browser context.
const SITE_URL = "https://pickwise-app-wine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: BROWSER_TAB_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: BROWSER_TAB_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: BROWSER_TAB_TITLE,
    images: ["/logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: BROWSER_TAB_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
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
