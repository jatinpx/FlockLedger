import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/Providers";
import "./globals.css";

const themeInit = `
(function(){
  try {
    var k = 'flockledger-theme';
    var v = localStorage.getItem(k);
    var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (v === 'dark' || ((v === 'system' || v === null) && d)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FlockLedger",
  description: "Poultry farm management dashboard",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="flockledger-theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
