import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";

interface TempAuthGuardProps {
  children: ReactNode;
}

export default function TempAuthGuard({ children }: TempAuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const json = typeof window !== 'undefined' && localStorage.getItem("tempUser");
    if (!json) {
      router.replace("/temp-login");
      return;
    }
    try {
      const u = JSON.parse(json);
      if (new Date(u.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem("tempUser");
        router.replace("/temp-login");
      } else {
        setLoading(false);
      }
    } catch {
      localStorage.removeItem("tempUser");
      router.replace("/temp-login");
    }
  }, [router]);

  if (loading) return <p className="text-center mt-10">Validando acceso…</p>;
  return <>{children}</>;
}