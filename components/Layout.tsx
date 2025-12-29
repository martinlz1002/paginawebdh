import Head from "next/head";
import { ReactNode } from "react";
import Header from "./header";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title = "DH Time" }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <link rel="icon" href="/logo-pestañas.png" type="image/png" />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* ✅ Fondo global CLARO */}
      <main className="bg-dh-bg text-dh-ink min-h-screen">
        <Header />

        {/* ✅ Contenido consistente */}
        <div className="pt-4">
          {children}
        </div>

        <Footer />
      </main>
    </>
  );
}
