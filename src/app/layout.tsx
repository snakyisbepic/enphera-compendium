import type { Metadata } from "next";
import { Crimson_Text, Cinzel, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const crimson = Crimson_Text({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Enphera Compendium",
  description:
    "A living reference document for the Enphera worldbuilding project. Browsable compendium of cosmology, geography, species, languages, and history.",
  keywords: [
    "Enphera",
    "worldbuilding",
    "compendium",
    "lore",
    "speculative fiction",
  ],
  authors: [{ name: "Enphera Project" }],
  openGraph: {
    title: "Enphera Compendium",
    description:
      "A living reference document for the Enphera worldbuilding project.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${crimson.variable} ${cinzel.variable} ${geistSans.variable} ${geistMono.variable} antialiased enphera-body`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
