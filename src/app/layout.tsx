import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["600", "700", "800", "900"],
});

import { Omnibar } from "@/components/navigation/Omnibar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { ToasterProvider } from "@/components/providers/ToasterProvider";

export const metadata: Metadata = {
  title: "Elohim Import ERP | Perfumería & Decants Bimonetario",
  description: "Sistema web de gestión de stock, POS, fraccionamiento JIT y analítica financiera.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`dark ${plusJakarta.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col md:flex-row bg-[#08130E] text-zinc-50 selection:bg-[#D0A96B]/30 selection:text-[#D0A96B]">
        <ToasterProvider />
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          {children}
        </div>
        <Omnibar />
      </body>
    </html>
  );
}
