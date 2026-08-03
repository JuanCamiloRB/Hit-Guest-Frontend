import type { Metadata } from "next";
import { Gabarito, Poppins } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  weight: ["700", "800"], // Bold focused
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "HitGuest",
    template: "%s · HitGuest",
  },
  description:
    "Check-in digital y automatizaciones para property managers: verificación de huéspedes, contratos firmados y reportes SIRE y TRA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `lang` es el valor de SSR: el producto es español-first. useLanguageStore
  // reescribe document.documentElement.lang al montar, según la preferencia
  // guardada o el idioma del navegador.
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${gabarito.variable} ${poppins.variable} antialiased font-secondary`}
      >
        <LanguageProvider>
          {children}
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
