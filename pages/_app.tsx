import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Estas rutas son completamente públicas, sin Layout ni AuthGuard
  const PUBLIC_PATHS = ["/temp-login", "/inscripcion-manual/"];
  const isPublic = PUBLIC_PATHS.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p
  );

  // Si es pública, render el componente **directo**.
  // Si no, metemos Layout+AuthGuard
  if (isPublic) {
    return <Component {...pageProps} />;
  } else {
    return (
      <AuthProvider>
        <Layout>
          <AuthGuard>
            <Component {...pageProps} />
          </AuthGuard>
        </Layout>
      </AuthProvider>
    );
  }
}