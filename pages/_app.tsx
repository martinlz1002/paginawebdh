import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { asPath } = useRouter();

  // Solo estas rutas requieren login
  const protectedPaths = [
    "/pago",
    "/checkout",
    "/mis-inscripciones",
    "/perfil",
    "/admin",
  ];

  const isProtected = protectedPaths.some((path) => asPath.startsWith(path));

  return (
    <AuthProvider>
      <Layout>
        {isProtected ? (
          <AuthGuard>
            <Component {...pageProps} />
          </AuthGuard>
        ) : (
          <Component {...pageProps} />
        )}
      </Layout>
    </AuthProvider>
  );
}