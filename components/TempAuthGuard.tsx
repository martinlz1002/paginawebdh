import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { TempUsuario } from '@/types/tempusuario';

interface TempAuthGuardProps {
  children: ReactNode;
}

export default function TempAuthGuard({ children }: TempAuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Leer usuario temporal de localStorage
    const json = localStorage.getItem('tempUser');
    if (!json) {
      router.replace('/temp-login');
      return;
    }
    try {
      const user = JSON.parse(json) as TempUsuario;
      // Validar expiración
      if (new Date(user.expiresAt).getTime() < Date.now()) {
        localStorage.removeItem('tempUser');
        router.replace('/temp-login');
        return;
      }
      // Todo válido
      setLoading(false);
    } catch {
      localStorage.removeItem('tempUser');
      router.replace('/temp-login');
    }
  }, [router]);

  if (loading) {
    return <p className="text-center mt-10">Validando acceso…</p>;
  }

  return <>{children}</>;
}
