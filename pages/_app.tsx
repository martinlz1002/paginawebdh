import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { asPath } = useRouter();

  // Rutas públicas (sin AuthGuard)
  const publicPaths = [
    "/temp-login",
    "/login",
    "/register",
    "/signup",
    "/registro",
    "/inscribir",            // página de registro de carrera pública
    "/inscripcion-manual"
  ];

  const isPublic = publicPaths.some((path) => asPath.startsWith(path));

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