import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  ChevronDownIcon,
  XMarkIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { app, db } from "@/lib/firebase";

export default function Header() {
  const router = useRouter();
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [nombre, setNombre] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setEmailVerified(u.emailVerified);
        const snap = await getDoc(doc(db, "usuarios", u.uid));
        const data = snap.data();
        setNombre(data?.nombre || "");
        setEsAdmin(data?.admin === true);
      } else {
        setUser(null);
        setNombre("");
        setEsAdmin(false);
        setEmailVerified(false);
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
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center space-x-2">
        <Image src="/mi-logo.png" alt="Logo" width={150} height={150} />
        <span className="text-2xl font-bold text-green-800"></span>
      </Link>

      {/* Tagline */}
      <div className="hidden md:block">
        <span className="text-gray-600 italic">Medimos lo que te apasiona</span>
      </div>

      {/* User Menu */}
      <div className="relative" ref={menuRef}>
        {user ? (
          <>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition"
            >
              <UserCircleIcon className="w-6 h-6 text-green-700" />
              <span className="text-gray-700 font-medium">{nombre}</span>
              {menuOpen ? (
                <XMarkIcon className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-600" />
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg py-2">
                {emailVerified ? (
                  <>
                    <Link href="/mis-inscripciones" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                      Mis inscripciones
                    </Link>
                    <Link href="/perfil" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                      Perfil
                    </Link>
                  </>
                ) : (
                  <p className="px-4 py-2 text-sm text-gray-500">
                    Confirma tu correo para más opciones
                  </p>
                )}
                {esAdmin && (
                  <Link href="/admin" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                    Panel Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-gray-700 hover:text-green-700">
              Iniciar sesión
            </Link>
            <Link
              href="/signup"
              className="bg-green-700 text-white px-4 py-1 rounded-full hover:bg-green-800 transition"
            >
              Regístrate
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}