import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Estas son las rutas que NO exigen autenticación
  const openRoutes = [
    "/temp-login",
    "/inscripcion-manual/[id]"  // Next.js coloca el patrón dinámico aquí
  ];
  const isOpen = openRoutes.includes(pathname);

  const content = isOpen ? (
    <Component {...pageProps} />
  ) : (
    <AuthGuard>
      <Component {...pageProps} />
    </AuthGuard>
  );

  return (
    <AuthProvider>
      <Layout>{content}</Layout>
    </AuthProvider>
  );
}