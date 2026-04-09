import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "OpenZorg",
  description: "Open source modulair zorgplatform voor Nederlandse zorginstellingen",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
