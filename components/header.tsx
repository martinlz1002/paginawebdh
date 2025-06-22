import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { app, db } from "@/lib/firebase";

export default function Header() {
  const router = useRouter();
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [nombre, setNombre] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <header className="flex justify-between items-center p-4 bg-white shadow sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center">
        <Image src="/mi-logo.png" alt="Logo" width={120} height={120} />
        <span className="ml-2 text-2xl font-bold text-green-800">
          DHTime
        </span>
      </Link>

      {/* Menú usuario */}
      {user ? (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition"
          >
            <span className="font-medium">{nombre}</span>
            {menuOpen ? (
              <XMarkIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-md py-2">
              <Link href="/mis-inscripciones" className="block px-4 py-2 hover:bg-gray-100">
                Mis inscripciones
              </Link>
              <Link href="/perfil" className="block px-4 py-2 hover:bg-gray-100">
                Perfil
              </Link>
              {esAdmin && (
                <Link href="/admin" className="block px-4 py-2 hover:bg-gray-100">
                  Admin
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
        <div className="flex items-center space-x-6">
          <Link href="/login" className="text-gray-700 hover:text-green-700 transition">
            Iniciar sesión
          </Link>
          <Link href="/signup" className="text-green-700 font-medium hover:underline transition">
            Registrarse
          </Link>
        </div>
      )}
    </header>
  );
}