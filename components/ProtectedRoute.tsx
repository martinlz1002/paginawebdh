import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
      try {
        if (!user) {
          const next = encodeURIComponent(router.asPath);
          router.replace(`/login?next=${next}`);
          return;
        }

        const userRef = doc(db, "usuarios", user.uid);
        const userDoc = await getDoc(userRef);

        const adminFlag = userDoc.exists() && userDoc.data()?.admin === true;
        if (!adminFlag) {
          router.replace("/");
          return;
        }

        setIsAdmin(true);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, router.asPath]);

  if (loading) return <p className="text-center mt-10">Cargando…</p>;
  return isAdmin ? <>{children}</> : null;
};

export default ProtectedRoute;