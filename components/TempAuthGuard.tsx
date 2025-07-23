import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { TempUsuario } from "@/types/tempusuario";

interface Props { children: ReactNode; }

export default function TempAuthGuard({ children }: Props) {
  const [ok, setOk] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const json = localStorage.getItem("tempUser");
    if (!json) {
      router.replace("/temp-login");
      return;
    }
    try {
      const u = JSON.parse(json) as TempUsuario & { id: string; expiresAt: string };
      if (new Date(u.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem("tempUser");
        router.replace("/temp-login");
        return;
      }
      setOk(true);
    } catch {
      localStorage.removeItem("tempUser");
      router.replace("/temp-login");
    }
  }, [router]);

  if (!ok) return <p className="text-center mt-10">Validando acceso…</p>;
  return <>{children}</>;
}