import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "LonghorNet",
  description: "Marketplace and automation workspace for UT Austin students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
