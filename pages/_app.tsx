import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Estas rutas deben quedar *completamente abiertas*:
  const PUBLIC_PATHS = [
    "/temp-login",                 // login temporal
    "/inscripcion-manual",         // listado (no dinámico)
  ];

  // abrimos también cualquier /inscripcion-manual/[id]
  const isPublic = PUBLIC_PATHS.includes(pathname) 
    || pathname.startsWith("/inscripcion-manual/");

  return (
    <AuthProvider>
      <Layout>
        {isPublic ? (
          // sin AuthGuard
          <Component {...pageProps} />
        ) : (
          // con AuthGuard para toda la app normal
          <AuthGuard>
            <Component {...pageProps} />
          </AuthGuard>
        )}
      </Layout>
    </AuthProvider>
  );
}