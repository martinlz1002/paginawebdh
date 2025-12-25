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
  Bars3Icon,
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
        setEmailVerified(false);
        setEsAdmin(false);
      }
    });
    return unsub;
  }, [auth]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const scrollToProximas = () => {
    setMenuOpen(false);
    document.getElementById("proximas-carreras")?.scrollIntoView({ behavior: "smooth" });
  };

  const isHome = router.pathname === "/";

  return (
    <header className="relative bg-gradient-to-r from-dh-dark via-dh-purple to-dh-green text-white sticky top-0 z-50 shadow-dh">
      <div className="max-w-6xl mx-auto flex items-center px-6 py-3">
        {/* Logo (lado izq) */}
        <div className="flex-shrink-0">
          <Link href="/">
            <Image src="/mi-logo.png" alt="Logo" width={120} height={120} />
          </Link>
        </div>

        {/* Nav centrado */}
        <nav className="flex-1 text-center hidden md:flex space-x-6">
          <Link href="/" className="hover:text-dh-green/90 transition">Home</Link>
          {user && emailVerified && (
            <>
              <Link href="/mis-inscripciones" className="hover:text-dh-green/90 transition">Mis Inscripciones</Link>
              <Link href="/perfil" className="hover:text-dh-green/90 transition">Perfil</Link>
            </>
          )}
          {esAdmin && (
            <Link href="/admin" className="hover:text-dh-green/90 transition">Admin</Link>
          )}
          {user ? (
            <button onClick={handleLogout} className="hover:text-red-400 transition">
              Cerrar sesión
            </button>
          ) : (
            <>
              <Link href="/login" className="hover:text-dh-green/90 transition">Iniciar sesión</Link>
              <Link href="/signup" className="hover:text-dh-green/90 transition">Regístrate</Link>
            </>
          )}
        </nav>

        {/* Botón absoluto (lado derecho) */}
        {isHome && (
          <button
            onClick={scrollToProximas}
            className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-full transition hidden md:block"
          >
            Inscribirme
          </button>
        )}

        {/* Menú móvil */}
        <div className="ml-auto md:hidden">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-2 rounded-md hover:bg-gray-800 transition"
          >
            {menuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu items (igual que antes, sin “Confirma tu correo”) */}
      {menuOpen && (
        <div ref={menuRef} className="md:hidden bg-dh-dark/95 backdrop-blur">
          <div className="flex flex-col space-y-1 px-4 py-3">
            <Link href="/" className="block px-2 py-1 rounded hover:bg-gray-700">Home</Link>
            {user && emailVerified && (
              <>
                <Link href="/mis-inscripciones" className="block px-2 py-1 rounded hover:bg-gray-700">Mis Inscripciones</Link>
                <Link href="/perfil" className="block px-2 py-1 rounded hover:bg-gray-700">Perfil</Link>
              </>
            )}
            {esAdmin && (
              <Link href="/admin" className="block px-2 py-1 rounded hover:bg-gray-700">Admin</Link>
            )}
            {!user ? (
              <>
                <Link href="/login" className="block px-2 py-1 rounded hover:bg-gray-700">Iniciar sesión</Link>
                <Link href="/signup" className="block px-2 py-1 rounded bg-dh-green text-dh-dark text-center hover:bg-dh-green/90">Regístrate</Link>
              </>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full text-left px-2 py-1 rounded text-red-400 hover:bg-gray-700"
              >
                Cerrar sesión
              </button>
            )}

            {isHome && (
              <button
                onClick={scrollToProximas}
                className="absolute right-6 top-1/2 -translate-y-1/2 bg-dh-green hover:bg-dh-green/90 text-dh-dark font-semibold px-4 py-2 rounded-full transition shadow"
              >
                Inscribirme
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}