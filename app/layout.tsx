import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Sphere Slicer',
  description: 'Gere modelos em camadas de esferas com encaixe para corte a laser.',
  openGraph: {
    title: 'Sphere Slicer',
    description: 'Gere modelos em camadas de esferas com encaixe para corte a laser.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sphere Slicer',
    description: 'Gere modelos em camadas de esferas com encaixe para corte a laser.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
