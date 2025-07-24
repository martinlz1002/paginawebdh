import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { asPath } = useRouter();

  // Rutas completamente públicas:
  const isPublic =
    asPath === "/temp-login" ||
    asPath.startsWith("/inscripcion-manual");

  return (
    <AuthProvider>
      <Layout>
        {isPublic ? (
          // Sin AuthGuard
          <Component {...pageProps} />
        ) : (
          // Con AuthGuard para la app principal
          <AuthGuard>
            <Component {...pageProps} />
          </AuthGuard>
        )}
      </Layout>
    </AuthProvider>
  );
}