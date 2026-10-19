import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OmniClip — AI Second Brain & Web Clipper',
  description: 'AI-powered knowledge capture, vector search, and web clipper with companion browser extension.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090a0f] text-gray-100 antialiased min-h-screen selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
