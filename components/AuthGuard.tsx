
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;

    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          const next = encodeURIComponent(router.asPath);
          await router.replace(`/login?next=${next}`);
          return;
        }

        // Consultar el estado actualizado del correo
        await user.reload();

        const updatedUser = auth.currentUser;

        if (!updatedUser) {
          const next = encodeURIComponent(router.asPath);
          await router.replace(`/login?next=${next}`);
          return;
        }

        if (!updatedUser.emailVerified) {
          const next = encodeURIComponent(router.asPath);

          await router.replace(
            `/verificar-correo?next=${next}`
          );
          return;
        }

        if (active) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error);

        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router.isReady, router.asPath, router]);

  if (loading) {
    return (
      <p className="text-center mt-10">
        Comprobando tu cuenta...
      </p>
    );
  }

  return <>{children}</>;
}
