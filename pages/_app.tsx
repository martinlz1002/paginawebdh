import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";

const PUBLIC_PATHS = [
  "/",
  "/temp-login",
  "/inscripcion-manual/", // dynamic prefix
];

export default function App({ Component, pageProps }: AppProps) {
  const { pathname } = useRouter();

  // Check if this path is public
  const isPublic = PUBLIC_PATHS.some(path =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path
  );

  // Wrap protected pages in AuthGuard, but always inside Layout
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