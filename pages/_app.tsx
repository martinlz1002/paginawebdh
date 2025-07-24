import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();
  const isPublic = pathname === "/temp-login" || pathname.startsWith("/inscripcion-manual/");
  const Content = isPublic ? (
    <Component {...pageProps} />
  ) : (
    <AuthGuard>
      <Component {...pageProps} />
    </AuthGuard>
  );
  return (
    <AuthProvider>
      <Layout>{Content}</Layout>
    </AuthProvider>
  );
}