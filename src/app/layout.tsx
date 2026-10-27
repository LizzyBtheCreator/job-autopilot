import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Autopilot",
  description: "Remote job search and tailored resumes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-stone-200 bg-white print:hidden dark:border-stone-800 dark:bg-stone-900">
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">Job Autopilot</Link>
            <Link href="/" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white">Jobs</Link>
            <Link href="/tracking" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white">Tracking</Link>
            <Link href="/settings" className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white">Settings</Link>
            <form action="/auth/signout" method="post" className="ml-auto">
              <button className="text-stone-500 hover:text-stone-900 dark:hover:text-white">Sign out</button>
            </form>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
      </body>
    </html>
  );
}
