import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";

interface TempAuthGuardProps {
  children: ReactNode;
}

export default function TempAuthGuard({ children }: TempAuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const json = localStorage.getItem("tempUser");
    if (!json) {
      const next = encodeURIComponent(router.asPath);
      router.replace(`/temp-login?next=${next}`);
      return;
    }

    try {
      const u = JSON.parse(json);

      const expMs =
        typeof u.expiresAtMs === "number"
          ? u.expiresAtMs
          : typeof u.expiresAt === "string"
          ? new Date(u.expiresAt).getTime()
          : NaN;

      if (!Number.isFinite(expMs) || expMs < Date.now()) {
        localStorage.removeItem("tempUser");
        const next = encodeURIComponent(router.asPath);
        router.replace(`/temp-login?next=${next}`);
        return;
      }

      setLoading(false);
    } catch {
      localStorage.removeItem("tempUser");
      const next = encodeURIComponent(router.asPath);
      router.replace(`/temp-login?next=${next}`);
    }
  }, [router]);

  if (loading) return <p className="text-center mt-10">Validando acceso…</p>;
  return <>{children}</>;
}