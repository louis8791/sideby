import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sideby｜兩個人一起決定約會',
  description: '在各自保有私密需求的前提下，一起選出可執行的約會行程。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
