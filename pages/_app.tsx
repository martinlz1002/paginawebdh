import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { AuthProvider } from "@/context/authContext";
import Layout from "@/components/Layout";
import AuthGuard from "@/components/AuthGuard";
import { AnimatePresence, motion } from "framer-motion";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const protectedPaths = [
    "/pago",
    "/checkout",
    "/mis-inscripciones",
    "/perfil",
    "/admin",
  ];

  const isProtected = protectedPaths.some((path) =>
    router.asPath.startsWith(path)
  );

  return (
    <AuthProvider>
      <div className="relative min-h-screen bg-[#0c0c0f] text-white antialiased overflow-x-hidden selection:bg-dh-purple/30 selection:text-black">

        {/* Glow global DH */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] bg-dh-purple/20 blur-3xl rounded-full opacity-40" />
          <div className="absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] bg-dh-purple/20 blur-3xl rounded-full opacity-40" />
        </div>

        <Layout>
          <AnimatePresence mode="wait">
            <motion.div
              key={router.asPath}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              {isProtected ? (
                <AuthGuard>
                  <Component {...pageProps} />
                </AuthGuard>
              ) : (
                <Component {...pageProps} />
              )}
            </motion.div>
          </AnimatePresence>
        </Layout>
      </div>
    </AuthProvider>
  );
}
