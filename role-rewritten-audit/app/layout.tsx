import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Free AI Resume Audit: Role Rewritten",
  description:
    "Upload your resume and get an instant, honest audit scored like a hiring manager grades it. Then get it professionally rebuilt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F6F9FE] text-[#0D2A4C]">{children}<Analytics /></body>
    </html>
  );
}
