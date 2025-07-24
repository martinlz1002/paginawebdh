import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Estas rutas NO necesitan login
  const PUBLIC_PATHS = [
    "/",               // homepage
    "/temp-login",
    "/inscripcion-manual/", // dinámica
  ];
  const isPublic = PUBLIC_PATHS.some(p =>
    p.endsWith("/") ? pathname.startsWith(p) : pathname === p
  );

  if (isPublic) {
    // renderizas sin AuthGuard
    return <Component {...pageProps} />;
  } else {
    // el resto con tu Layout + AuthGuard
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