import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Sheet Ninja",
  description: "Configure synchronization between GitLab issues and Google Sheets",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <div className="flex-1">
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </div>
        <footer className="w-full bg-[#1F2023] text-gray-300">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h4 className="text-white font-semibold">Sheet Ninja</h4>
                <p className="text-sm text-gray-400 max-w-xl mt-1">An admin UI to configure synchronization between GitLab issues and Google Sheets. Use the setup page to connect services and the contributors page to meet the team.</p>
              </div>
              <nav className="flex flex-wrap items-center gap-4">
                <Link href="/" className="text-sm hover:text-white">Home</Link>
                <Link href="/setup" className="text-sm hover:text-white">Setup</Link>
                <Link href="/contributors" className="text-sm hover:text-white">Contributors</Link>
                <Link href="https://github.com/" target="_blank" rel="noreferrer" className="text-sm hover:text-white">GitHub</Link>
              </nav>
            </div>
            <div className="mt-6 text-xs text-gray-500">© {new Date().getFullYear()} Sheet Ninja. All rights reserved.</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
