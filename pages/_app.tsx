import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Rutas públicas: login temporal y formulario de inscripción manual
  const isPublic =
    pathname === "/temp-login" ||
    pathname.startsWith("/inscripcion‑manual");

  return (
    <AuthProvider>
      <Layout>
        {isPublic ? (
          <Component {...pageProps} />
        ) : (
          <AuthGuard>
            <Component {...pageProps} />
          </AuthGuard>
        )}
      </Layout>
    </AuthProvider>
  );
}