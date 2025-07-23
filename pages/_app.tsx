import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Rutas públicas: login temporal y página de inscripción manual
  const openRoutes = [
    "/temp-login",
    "/inscripcion-manual/" // Next.js no hace match exacto con dinámicas, así que comprobamos startsWith
  ];
  const isOpen = openRoutes.some((route) =>
    route.endsWith("/")
      ? pathname.startsWith(route)
      : pathname === route
  );

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