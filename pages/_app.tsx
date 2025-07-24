import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();
  // Rutas públicas:
  const PUBLIC = ["/temp-login", "/inscripcion-manual/"];
  const isPublic = PUBLIC.some(p => 
    p.endsWith("/") 
      ? pathname.startsWith(p) 
      : pathname === p
  );

  if (isPublic) {
    // Páginas públicas (no requieren usuario Firebase)
    return <Component {...pageProps} />;
  }

  // Todo lo demás va con Layout + AuthGuard
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