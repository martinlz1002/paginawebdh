import Head from 'next/head';
import { ReactNode } from 'react';
import Header from './header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'DH Cronometraje' }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        {/* Favicon actualizado al logo personalizado */}
        <link rel="icon" href="public/mi-logo.png" />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div>
        <Header />
        {/* reduce pt-16 a pt-8 para menos espacio bajo el header */}
        <main className="pt-6 px-4">
          {children}
        </main>
        <Footer />
      </div>
    </>
  );
}