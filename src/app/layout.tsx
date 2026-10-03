import type { Metadata } from 'next';
import { Inter, Literata } from 'next/font/google';
import { ThemedToaster } from '@/components/ui/themed-toaster';
import { AmbientBackground } from '@/components/ambient-background';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const literata = Literata({ subsets: ['latin'], variable: '--font-literata', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Inkwell', template: '%s · Inkwell' },
  description: 'A private writing workspace where approved canon is truth.',
};

// Applies the theme before paint to avoid a flash. Dark (Midnight Ink) is the default; 'light' is opt-in.
const themeScript = `try{var t=localStorage.getItem('wn:theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${literata.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <AmbientBackground />
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
