import Head from 'next/head';
import { ReactNode } from 'react';
import Header from './header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'DH Time' }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        {/* Favicon: asegúrate de que esté en public/mi-logo.png */}
        <link rel="icon" href="/logo-pestañas.png" type="image/png" />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main className="pt-6 px-4">{children}</main>
      <Footer />
    </>
  );
}