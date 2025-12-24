import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      // si estás en login, no redirijas al login otra vez
      if (!user) {
        if (router.pathname === "/login") {
          setLoading(false);
          return;
        }
        const next = encodeURIComponent(router.asPath);
        router.replace(`/login?next=${next}`);
        return;
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [auth, router.pathname, router.asPath]);

  if (loading) return <p className="text-center mt-10">Cargando…</p>;
  return <>{children}</>;
}