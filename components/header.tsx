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

  // Escucha Firebase Auth
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

  // Cierra menú al clicar fuera
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
    <header className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/mi-logo.png" alt="Logo" width={120} height={120} />
          <span className="text-xl font-extrabold tracking-tight"></span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/" className="hover:text-green-400 transition">Home</Link>
          <Link href="/mis-inscripciones" className="hover:text-green-400 transition">Mis Inscripciones</Link>
          <Link href="/perfil" className="hover:text-green-400 transition">Perfil</Link>
          {esAdmin && (
            <Link href="/admin" className="hover:text-green-400 transition">Admin</Link>
          )}
        </nav>

        {/* Call-to-action */}
        <div className="hidden md:block">
          <Link
            href="/inscribirse"
            className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-full transition"
          >
            Inscribirme
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="block md:hidden p-2 rounded-md hover:bg-gray-800 transition"
        >
          {menuOpen ? (
            <XMarkIcon className="w-6 h-6" />
          ) : (
            <Bars3Icon className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div ref={menuRef} className="md:hidden bg-gray-800">
          <div className="flex flex-col space-y-1 px-4 py-3">
            <Link href="/" className="block px-2 py-1 rounded hover:bg-gray-700">Home</Link>
            {user && emailVerified ? (
              <>
                <Link href="/mis-inscripciones" className="block px-2 py-1 rounded hover:bg-gray-700">Mis Inscripciones</Link>
                <Link href="/perfil" className="block px-2 py-1 rounded hover:bg-gray-700">Perfil</Link>
              </>
            ) : (
              <p className="px-2 py-1 text-gray-400 text-sm">Confirma tu correo</p>
            )}
            {esAdmin && (
              <Link href="/admin" className="block px-2 py-1 rounded hover:bg-gray-700">Admin</Link>
            )}
            {!user ? (
              <>
                <Link href="/login" className="block px-2 py-1 rounded hover:bg-gray-700">Iniciar sesión</Link>
                <Link href="/signup" className="block px-2 py-1 rounded bg-green-500 text-black text-center hover:bg-green-400">Regístrate</Link>
              </>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full text-left px-2 py-1 rounded text-red-400 hover:bg-gray-700"
              >
                Cerrar sesión
              </button>
            )}
            {/* CTA móvil */}
            <Link
              href="/inscribirse"
              className="mt-2 block text-center bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-full transition"
            >
              Inscribirme
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}