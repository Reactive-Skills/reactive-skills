import { DM_Sans, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

// next/font downloads these at build time and serves them from the site, so browsers never call Google.
const display = Space_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-display' });
const sans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono' });

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
