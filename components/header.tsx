import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { app, db } from "@/lib/firebase";

export default function Header() {
  const router = useRouter();
  const auth = getAuth(app);

  const [user, setUser] = useState<User | null>(null);
  const [nombre, setNombre] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  /* ============================= */
  /* AUTH STATE */
  /* ============================= */
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

  /* ============================= */
  /* SCROLL EFFECT */
  /* ============================= */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ============================= */
  /* OUTSIDE CLICK */
  /* ============================= */
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

  const isHome = router.pathname === "/";

  /* ============================= */
  /* RENDER */
  /* ============================= */

  return (
    <>
      {/* HEADER */}
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? "backdrop-blur-xl bg-black/60 border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

          {/* LOGO */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/mi-logo.png"
              alt="DHTime"
              width={90}
              height={90}
              priority
            />
          </Link>

          {/* NAV DESKTOP */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="/" className="hover:text-dh-green transition">
              Inicio
            </Link>

            {user && emailVerified && (
              <>
                <Link
                  href="/mis-inscripciones"
                  className="hover:text-dh-green transition"
                >
                  Mis Inscripciones
                </Link>
                <Link
                  href="/perfil"
                  className="hover:text-dh-green transition"
                >
                  Perfil
                </Link>
              </>
            )}

            {esAdmin && (
              <Link
                href="/admin"
                className="hover:text-dh-green transition"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* RIGHT SIDE */}
          <div className="hidden md:flex items-center gap-6">
            {!user ? (
              <>
                <Link href="/login" className="hover:text-dh-green transition">
                  Iniciar sesión
                </Link>
                <Link
                  href="/signup"
                  className="bg-dh-green text-black px-5 py-2 rounded-full font-semibold hover:scale-105 transition"
                >
                  Crear cuenta
                </Link>
              </>
            ) : (
              <>
                <span className="text-white/70 text-sm">
                  {nombre}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-red-400 hover:text-red-300 transition"
                >
                  Cerrar sesión
                </button>
              </>
            )}
          </div>

          {/* MOBILE BUTTON */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2"
          >
            <Bars3Icon className="w-7 h-7" />
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* BACKDROP */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/70 z-40"
            />

            {/* PANEL */}
            <motion.div
              ref={menuRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 25 }}
              className="fixed top-0 right-0 h-full w-72 bg-[#111116] border-l border-white/10 z-50 p-6 flex flex-col gap-6"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold">Menú</span>
                <button onClick={() => setMenuOpen(false)}>
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <Link href="/" onClick={() => setMenuOpen(false)}>
                Inicio
              </Link>

              {user && emailVerified && (
                <>
                  <Link
                    href="/mis-inscripciones"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mis Inscripciones
                  </Link>
                  <Link
                    href="/perfil"
                    onClick={() => setMenuOpen(false)}
                  >
                    Perfil
                  </Link>
                </>
              )}

              {esAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </Link>
              )}

              {!user ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMenuOpen(false)}
                    className="mt-4 bg-dh-green text-black text-center py-3 rounded-full font-semibold"
                  >
                    Crear cuenta
                  </Link>
                </>
              ) : (
                <button
                  onClick={handleLogout}
                  className="text-red-400 text-left"
                >
                  Cerrar sesión
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
