import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
        router.replace('/login');
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [auth, router]);

  if (loading) return <p className="text-center mt-10">Cargando…</p>;
  return <>{children}</>;
}