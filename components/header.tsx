import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/outline";
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
        setNombre("");
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
    setMenuOpen(false);
    router.push("/");
  };

  const scrollToProximas = () => {
    setMenuOpen(false);
    document.getElementById("proximas-carreras")?.scrollIntoView({ behavior: "smooth" });
  };

  const isHome = router.pathname === "/";

  const linkBase =
    "px-2 py-1 rounded-lg transition text-white/90 hover:text-white hover:bg-white/10";

  return (
    <header className="sticky top-0 z-50">
      {/* barra */}
      <div className="relative bg-dh-dark/90 backdrop-blur border-b border-white/10 shadow-dh">
        <div className="max-w-6xl mx-auto flex items-center px-6 py-3">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="inline-flex items-center">
              <Image src="/mi-logo.png" alt="Logo" width={120} height={120} priority />
            </Link>
          </div>

          {/* Nav desktop */}
          <nav className="flex-1 justify-center hidden md:flex items-center gap-2">
            <Link href="/" className={linkBase}>
              Home
            </Link>

            {user && emailVerified && (
              <>
                <Link href="/mis-inscripciones" className={linkBase}>
                  Mis Inscripciones
                </Link>
                <Link href="/perfil" className={linkBase}>
                  Perfil
                </Link>
              </>
            )}

            {esAdmin && (
              <Link href="/admin" className={linkBase}>
                Admin
              </Link>
            )}

            {user ? (
              <button onClick={handleLogout} className={`${linkBase} hover:text-red-200`}>
                Cerrar sesión
              </button>
            ) : (
              <>
                <Link href="/login" className={linkBase}>
                  Iniciar sesión
                </Link>
                <Link
                  href="/signup"
                  className="px-3 py-1.5 rounded-lg bg-dh-green text-dh-dark font-semibold hover:bg-dh-green/90 transition"
                >
                  Regístrate
                </Link>
              </>
            )}
          </nav>

          {/* CTA desktop */}
          {isHome && (
            <div className="hidden md:block">
              <button
                onClick={scrollToProximas}
                className="bg-dh-green text-dh-dark font-semibold px-4 py-2 rounded-full hover:bg-dh-green/90 transition shadow"
              >
                Inscribirme
              </button>
            </div>
          )}

          {/* Menú móvil */}
          <div className="ml-auto md:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 rounded-lg hover:bg-white/10 transition text-white"
              aria-label="Abrir menú"
            >
              {menuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* glow suave DH */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-dh-purple/0 via-dh-purple/60 to-dh-green/60" />
      </div>

      {/* Drawer móvil */}
      {menuOpen && (
        <div ref={menuRef} className="md:hidden bg-dh-dark/95 backdrop-blur border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            <Link href="/" className={linkBase} onClick={() => setMenuOpen(false)}>
              Home
            </Link>

            {user && emailVerified && (
              <>
                <Link
                  href="/mis-inscripciones"
                  className={linkBase}
                  onClick={() => setMenuOpen(false)}
                >
                  Mis Inscripciones
                </Link>
                <Link href="/perfil" className={linkBase} onClick={() => setMenuOpen(false)}>
                  Perfil
                </Link>
              </>
            )}

            {esAdmin && (
              <Link href="/admin" className={linkBase} onClick={() => setMenuOpen(false)}>
                Admin
              </Link>
            )}

            {!user ? (
              <>
                <Link href="/login" className={linkBase} onClick={() => setMenuOpen(false)}>
                  Iniciar sesión
                </Link>
                <Link
                  href="/signup"
                  className="mt-1 px-3 py-2 rounded-xl bg-dh-green text-dh-dark font-semibold text-center hover:bg-dh-green/90 transition"
                  onClick={() => setMenuOpen(false)}
                >
                  Regístrate
                </Link>
              </>
            ) : (
              <button
                onClick={handleLogout}
                className="mt-1 w-full text-left px-2 py-2 rounded-lg text-red-200 hover:bg-white/10 transition"
              >
                Cerrar sesión
              </button>
            )}

            {/* CTA móvil (ya NO absolute) */}
            {isHome && (
              <button
                onClick={scrollToProximas}
                className="mt-2 w-full bg-dh-green text-dh-dark font-semibold px-4 py-2 rounded-xl hover:bg-dh-green/90 transition shadow"
              >
                Inscribirme
              </button>
            )}

            {/* mini saludo opcional */}
            {user && nombre ? (
              <p className="mt-2 text-xs text-white/60 px-2">
                Sesión: <span className="text-white/80">{nombre}</span>
              </p>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
