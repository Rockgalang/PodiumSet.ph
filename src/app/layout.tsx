import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/seed";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PodiumSet.ph — Unlimited Designs, Unlimited Opportunities",
    template: "%s · PodiumSet.ph",
  },
  description:
    "Unlimited design, video and marketing on a fixed monthly subscription. Pause or cancel anytime. Built for Filipino businesses.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-paper">
        {children}
      </body>
    </html>
  );
}
