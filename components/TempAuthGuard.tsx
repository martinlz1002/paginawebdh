import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, signInAnonymously } from "firebase/auth";

interface TempAuthGuardProps {
  children: ReactNode;
}

export default function TempAuthGuard({ children }: TempAuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    // 1) Sign in anonymously so that request.auth != null
    signInAnonymously(auth)
      .catch(console.error)
      .finally(() => {
        // 2) Then verify we have a valid tempUser in localStorage
        const json = localStorage.getItem("tempUser");
        if (!json) {
          return router.replace("/temp-login");
        }
        try {
          const u = JSON.parse(json);
          if (new Date(u.expiresAt).getTime() < Date.now()) {
            localStorage.removeItem("tempUser");
            return router.replace("/temp-login");
          }
          setLoading(false);
        } catch {
          localStorage.removeItem("tempUser");
          router.replace("/temp-login");
        }
      });
  }, [router]);

  if (loading) {
    return <p className="text-center mt-10">Validando acceso…</p>;
  }
  return <>{children}</>;
}