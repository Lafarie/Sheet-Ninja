import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sheet Ninja v2 - Advanced GitLab & Google Sheets Sync',
  description: 'Professional GitLab and Google Sheets synchronization tool with advanced features, user authentication, and configuration management.',
  keywords: ['GitLab', 'Google Sheets', 'Synchronization', 'Project Management', 'Task Tracking'],
  authors: [{ name: 'Sheet Ninja Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'Sheet Ninja v2',
    description: 'Advanced GitLab and Google Sheets synchronization tool',
    type: 'website',
    locale: 'en_US',
  },
};

export default function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster 
            position="top-right"
            expand={true}
            richColors={true}
            closeButton={true}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
