import type { Metadata } from "next";
import { Geist_Mono, Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  subsets: ["latin", "thai"],
  variable: "--font-kanit",
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://goldaisig.com'),
  title: {
    default: 'Gold Signal | สัญญาณเทรดทองคำ เทรดทอง Forex เทรดทองออนไลน์ XAUUSD',
    template: '%s | Gold Signal สัญญาณเทรดทองคำ Forex',
  },
  description: 'Gold Signal ระบบช่วยวางแผนและสัญญาณเทรดทองคำ XAUUSD สำหรับสายเทรดทอง Forex และเทรดทองออนไลน์ วิเคราะห์โซนแนวรับแนวต้าน คัดสรรแผนเทรดคุณภาพสูง พร้อมเป้าหมาย Entry, Stop Loss, Take Profit',
  keywords: [
    'Gold Signal',
    'เทรดทองคำ',
    'เทรดทอง forex',
    'เทรดทองออนไลน์',
    'สัญญาณเทรดทองคำ',
    'วิเคราะห์ทองคำ',
    'XAUUSD',
    'ระบบเทรดทองคำ',
    'แนวรับแนวต้านทองคำ',
    'สัญญาณทองคำ',
    'EA เทรดทองคำ',
    'Gold AI Signal',
  ],
  authors: [{ name: 'Gold AI Signal Lab', url: 'https://goldaisig.com' }],
  creator: 'Gold AI Signal Lab',
  publisher: 'Gold AI Signal Lab',
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://goldaisig.com',
  },
  verification: {
    google: 'wdB0sLLPD7hb7VAuPUAs2vsQBbdmucYxIqyFZxXpR-I',
  },
  openGraph: {
    title: 'Gold Signal | สัญญาณเทรดทองคำ XAUUSD แม่นยำ วิเคราะห์แนวรับแนวต้าน',
    description: 'Gold Signal ระบบสัญญาณเทรดทองคำ XAUUSD แม่นยำ วิเคราะห์โซนแนวรับแนวต้าน คัดสรรแผนเทรดทองคำคุณภาพสูง',
    url: 'https://goldaisig.com',
    siteName: 'Gold Signal - สัญญาณเทรดทองคำ',
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gold Signal | สัญญาณเทรดทองคำ XAUUSD',
    description: 'Gold Signal ระบบสัญญาณเทรดทองคำ XAUUSD แม่นยำ วิเคราะห์โซนแนวรับแนวต้าน',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Gold Signal - ระบบสัญญาณเทรดทองคำ XAUUSD',
    url: 'https://goldaisig.com',
    description: 'Gold Signal ระบบสัญญาณเทรดทองคำ XAUUSD แม่นยำ วิเคราะห์โซนแนวรับแนวต้านแบบ Real-time',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, Windows (MT5)',
    offers: {
      '@type': 'Offer',
      price: '990',
      priceCurrency: 'THB',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <html
      lang="th"
      className={`${kanit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans overflow-x-hidden w-full">{children}</body>
    </html>
  );
}
