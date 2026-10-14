import type { Metadata } from "next";
import type { ReactNode } from "react";

import { QueryProvider } from "@/providers/query-provider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "PTE Study",
  description: "PTE Study application foundation.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
