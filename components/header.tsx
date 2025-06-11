import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nombre, setNombre] = useState<string>("");
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
      setUser(usuario);
      if (usuario) {
        const userDoc = await getDoc(doc(db, "usuarios", usuario.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setNombre(data.nombre);
        }
      } else {
        setNombre("");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setNombre("");
    router.push("/");
  };

  const isActive = (path: string) => router.pathname === path;

  const linkStyle = (path: string) =>
    isActive(path)
      ? "text-green-700 font-semibold underline"
      : "text-gray-700 hover:text-green-700";

  return (
    <header className="flex justify-between items-center px-4 py-3 shadow bg-white sticky top-0 z-50">
      <Link href="/" className="text-xl font-bold text-green-800">
        DHTime
      </Link>

      <nav className="flex items-center space-x-4">
        {user ? (
          <>
            <Link href="/mis-inscripciones" className={linkStyle("/mis-inscripciones")}>
              Mis inscripciones
            </Link>
            <Link href="/perfil" className={linkStyle("/perfil")}>
              {nombre || "Mi perfil"}
            </Link>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:underline"
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className={linkStyle("/login")}>
              Iniciar sesión
            </Link>
            <Link href="/signup" className={linkStyle("/signup")}>
              Registrarse
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
