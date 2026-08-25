import type { Metadata } from "next";
import { Literata, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Literata (variable) is the reading face; IBM Plex Mono carries the technical meta.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wind",
  description: "Current weather conditions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${literata.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
