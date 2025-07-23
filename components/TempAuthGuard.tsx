import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getAuth, signInAnonymously } from 'firebase/auth';

interface TempAuthGuardProps { children: ReactNode; }

export default function TempAuthGuard({ children }: TempAuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    // 1️⃣ Autenticación anónima
    signInAnonymously(auth).catch(console.error).finally(() => {
      // 2️⃣ Validar tempUser en localStorage
      const json = localStorage.getItem('tempUser');
      if (!json) {
        router.replace('/temp-login');
      } else {
        try {
          const u = JSON.parse(json);
          if (new Date(u.expiresAt).getTime() < Date.now()) {
            localStorage.removeItem('tempUser');
            router.replace('/temp-login');
          } else {
            setLoading(false);
          }
        } catch {
          localStorage.removeItem('tempUser');
          router.replace('/temp-login');
        }
      }
    });
  }, [router]);

  if (loading) return <p className="text-center mt-10">Validando acceso…</p>;
  return <>{children}</>;
}