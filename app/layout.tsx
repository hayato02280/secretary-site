import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GFS AI秘書",
  description: "GFS社内AI秘書システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
