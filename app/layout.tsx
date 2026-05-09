import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppToaster } from "./components/AppToaster";
import { FleetThemeScript } from "./components/FleetThemeScript";
import { FleetThemeProvider } from "./lib/theme";

config.autoAddCss = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hormuz fleet command",
  description: "Real-time fleet ops simulator — command & captain consoles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <FleetThemeScript />
        <FleetThemeProvider>
          {children}
          <AppToaster />
        </FleetThemeProvider>
      </body>
    </html>
  );
}
