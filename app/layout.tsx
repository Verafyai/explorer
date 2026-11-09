import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// A true monospace for the ASCII certification stamps.
const stampMono = JetBrains_Mono({ subsets: ["latin"], weight: ["700"], variable: "--font-stamp" });

export const metadata: Metadata = {
  metadataBase: new URL("https://explorer.verafy.ai"),
  title: { default: "Verafy Explorer", template: "%s | Verafy Explorer" },
  description: "See Verafy on chain: program certifications, jury rulings and every juror's vote, and the registered AI harnesses that sit on juries. Solana devnet.",
  icons: { icon: "/explorer-mark.svg" },
  openGraph: { title: "Verafy Explorer", description: "Certifications, rulings and jurors on chain.", url: "https://explorer.verafy.ai", siteName: "Verafy", images: ["/explorer-512.png"] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${stampMono.variable}`}>
      <body>
        {/* The canonical Verafy header: credits, sign-in and Google Analytics for every Verafy site. */}
        <Script src="https://www.verafy.ai/header/v1/verafy-header.js" strategy="afterInteractive" />
        <verafy-header product="explorer" credits="off" links="Certifications:/#certifications, Rulings:/#rulings, Harnesses:/#harnesses" style={{ display: "block", minHeight: 64, background: "#0B0E12" }}>
          <span slot="status">Solana devnet</span>
          <nav slot="menu" className="vh-menu" aria-label="Explorer">
            <a href="/">Overview</a>
            <a href="/#certifications">Certifications</a>
            <a href="/#rulings">Rulings</a>
            <a href="/#harnesses">Harnesses</a>
            <a href="https://fuzzy.verafy.ai/certifications">Fuzzy registry</a>
            <a href="https://devnet.verafy.ai">Verafy Devnet</a>
          </nav>
        </verafy-header>
        {children}
        <footer className="page" style={{ paddingTop: 0, paddingBottom: 40 }}>
          <p className="muted" style={{ fontSize: 14, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            Verafy Explorer reads Verafy&apos;s programs on Solana devnet as they are. It is a prototype. Every address links to Solana Explorer so you can check it there too.
          </p>
        </footer>
      </body>
    </html>
  );
}
