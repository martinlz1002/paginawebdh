import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { asPath } = useRouter();

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
      {/* ✅ Fondo global CLARO + texto base oscuro */}
      <div className="min-h-screen bg-dh-bg text-dh-ink antialiased selection:bg-dh-green/30 selection:text-dh-ink">
        <Layout>
          {isProtected ? (
            <AuthGuard>
              <Component {...pageProps} />
            </AuthGuard>
          ) : (
            <Component {...pageProps} />
          )}
        </Layout>
      </div>
    </AuthProvider>
  );
}