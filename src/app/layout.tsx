import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eder CRM",
  description: "CRM comercial de EderCreaWebs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
