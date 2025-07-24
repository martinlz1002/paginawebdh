import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Rutas completamente públicas (no requieren sesión)
  const PUBLIC_PATHS = [
    "/login",                // login de la app principal
    "/temp-login",           // login temporal
    "/inscripcion-manual/",  // inscripción manual
  ];
  const isPublic = PUBLIC_PATHS.some(path =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path
  );

  if (isPublic) {
    // Rutas públicas: renderiza directamente
    return <Component {...pageProps} />;
  } else {
    // Rutas protegidas: envuelve en Layout + AuthGuard
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