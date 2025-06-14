import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists() && userDoc.data()?.admin === true) {
          setIsAdmin(true);
        } else {
          router.push('/'); // Redirige si no es admin
        }
      } else {
        router.push('/login'); // Redirige si no está logueado
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  if (loading) return <p>Loading...</p>;

  return isAdmin ? <>{children}</> : null;
};

export default ProtectedRoute;