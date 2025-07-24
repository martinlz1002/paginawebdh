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
    // Si ya estamos en la página de login, omitimos la redirección
    if (router.pathname === '/login') {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (!user) {
        // Si no hay usuario y no estamos en /login, redirigimos
        if (router.pathname !== '/login') {
          router.replace('/login');
        }
      } else {
        // Usuario autenticado, terminamos el loader
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [auth, router]);

  if (loading) {
    return <p className="text-center mt-10">Cargando…</p>;
  }

  return <>{children}</>;
}