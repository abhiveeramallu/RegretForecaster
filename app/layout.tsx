import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Regret Forecaster",
  description:
    "Forecast regret risk before making a life decision by exposing the cognitive biases driving it.",
  metadataBase: process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL)
    : undefined,
  openGraph: {
    title: "Regret Forecaster",
    description: "AI-powered regret risk forecasting grounded in decision science.",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Regret Forecaster",
    description: "How likely are you to regret this decision?"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${lora.variable} bg-bg text-text-primary antialiased font-[family-name:var(--font-inter)]`}>
        {children}
      </body>
    </html>
  );
}
