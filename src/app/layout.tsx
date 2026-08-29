import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "부표",
  description: "매일 쓴다. 가끔 들킨다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
