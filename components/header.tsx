import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { app, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface UserData {
  nombre: string;
  apellidoPaterno: string;
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
      setUser(usuario);
      if (usuario) {
        const userDoc = await getDoc(doc(db, "usuarios", usuario.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          setUserData(data);
        }
      } else {
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setUserData(null);
  };

  return (
    <header className="w-full bg-white shadow p-4 flex justify-between items-center sticky top-0 z-50">
      <Link href="/">
        <span className="text-xl font-bold cursor-pointer">DHTime</span>
      </Link>
      <div className="space-x-4">
        {user && userData ? (
          <>
            <Link href="/perfil">
              <span className="text-green-700 hover:underline cursor-pointer">
                {userData.nombre} {userData.apellidoPaterno}
              </span>
            </Link>
            <button onClick={handleLogout} className="text-red-600 hover:underline">
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <Link href="/login">
              <span className="text-blue-600 hover:underline">Iniciar sesión</span>
            </Link>
            <Link href="/signup">
              <span className="text-purple-600 hover:underline">Registrarse</span>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
