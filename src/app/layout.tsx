import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PTE",
  description: "Free-first PTE Academic study and practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
