import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import ClickableCursorProvider from "@/components/clickable-cursor-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "HedgeHomes Realty & Brokerage | RentTrack",
  description:
    "HedgeHomes Realty and Brokerage — powered by RentTrack. A comprehensive rental payment, receivables, and property monitoring system for house and condominium room rentals. Streamline your rental management with real-time tracking and automated notifications.",
  keywords: [
    "HedgeHomes",
    "realty",
    "brokerage",
    "rental management",
    "property management",
    "rent payment",
    "receivables",
    "landlord",
    "tenant",
    "Philippines",
    "condominium",
    "house rental",
  ],
  icons: {
    icon: "/images/favicon.ico",
    shortcut: "/images/favicon.ico",
    apple: "/images/landing/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
    <head>
      <link rel="icon" href="/images/favicon.ico" sizes="any" />
      <link rel="apple-touch-icon" href="/images/landing/logo.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <ClickableCursorProvider />
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            expand={true}
            toastOptions={{
              duration: 4000,
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
