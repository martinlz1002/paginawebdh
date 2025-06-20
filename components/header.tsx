import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

export default function Header() {
  const router = useRouter();
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [nombre, setNombre] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Escuchar cambios de auth y cargar datos de usuario
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        const data = snap.data();
        setNombre(data?.nombre || "");
        setEsAdmin(data?.admin === true);
      } else {
        setUser(null);
        setNombre("");
        setEsAdmin(false);
      }
    });
    return unsub;
  }, [auth]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <header className="flex justify-between items-center p-4 bg-white shadow sticky top-0 z-50">
      {/* Logo + título */}
      <Link href="/">
        <a className="flex items-center">
          <Image src="/mi-logo.png" alt="Logo" width={40} height={40} />
          <span className="ml-2 text-2xl font-bold text-green-800">DHTime</span>
        </a>
      </Link>

      {/* Área de navegación */}
      {user ? (
        <div className="relative" ref={menuRef}>
          {/* Botón que abre/cierra el menú */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
          >
            <span>{nombre}</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Menú desplegable */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-md py-2">
              <Link href="/mis-inscripciones">
                <a className="block px-4 py-2 hover:bg-gray-100">Mis inscripciones</a>
              </Link>
              <Link href="/perfil">
                <a className="block px-4 py-2 hover:bg-gray-100">Perfil</a>
              </Link>
              {esAdmin && (
                <Link href="/admin">
                  <a className="block px-4 py-2 hover:bg-gray-100">Admin</a>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link href="/login">
          <a className="text-gray-700 hover:text-green-700">Iniciar sesión</a>
        </Link>
      )}
    </header>
  );
}