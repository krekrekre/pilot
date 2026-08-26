import type { Metadata } from 'next';
import { Open_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Pilot Prep – Aptitude Training',
  description: 'Practice pilot aptitude tests: number memory, pattern recognition, and more. Trusted by pilot candidates worldwide.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${openSans.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-slate-800 antialiased font-[family-name:var(--font-open-sans)]">
        {children}
      </body>
    </html>
  );
}
