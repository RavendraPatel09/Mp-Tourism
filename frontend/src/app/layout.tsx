import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/api/config";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "YatraGo — discover where nobody else goes",
    template: "%s · YatraGo",
  },
  description:
    "Find what to explore anywhere in India, filtered by what you actually care about — and earn the most points for the places almost nobody visits.",
  applicationName: "YatraGo",
  openGraph: {
    type: "website",
    siteName: "YatraGo",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
