'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

export function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'font-sans border-phino-border-strong bg-phino-surface-raised text-phino-text',
            description: 'text-phino-text-muted',
          },
        }}
      />
    </ThemeProvider>
  );
}
