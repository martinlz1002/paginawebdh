import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
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

  const [eventosEnVivo, setEventosEnVivo] = useState<any[]>([]);
  const [openLive, setOpenLive] = useState(false);
  

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

  useEffect(() => {
  const q = query(collection(db, "eventos_vueltas"));

  const unsub = onSnapshot(q, (snap) => {
    const eventos = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setEventosEnVivo(eventos);
  });

  return () => unsub();
}, []);

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
          ? "bg-dh-bg/70 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      {/* 🌫️ Glow sutil */}
      <div className="absolute inset-0 -z-10 bg-dh-glow opacity-40" />

      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/mi-logo.png"
            alt="DHTime"
            width={110}
            height={110}
            priority
            className="transition duration-300 group-hover:scale-105"
          />
        </Link>

        {/* NAV DESKTOP */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">

          <Link href="/" className="relative group text-white/70 hover:text-white transition">
            Inicio
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-dh-purple transition-all group-hover:w-full" />
          </Link>

          {/* EN VIVO */}
          <div
            className="relative"
            onMouseEnter={() => setOpenLive(true)}
            onMouseLeave={() => setOpenLive(false)}
          >
            <span className="flex items-center gap-2 cursor-pointer text-white/70 hover:text-white transition">
              En vivo
              {eventosEnVivo.length > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </span>

            <AnimatePresence>
              {openLive && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-8 left-0 bg-dh-panel border border-white/5 backdrop-blur-xl rounded-xl shadow-dhSoft p-2 min-w-[220px] z-50"
                >
                  {eventosEnVivo.length === 0 ? (
                    <div className="px-4 py-2 text-xs text-white/40">
                      No hay eventos en vivo
                    </div>
                  ) : (
                    eventosEnVivo.map((ev) => (
                      <Link
                        key={ev.id}
                        href={`/vueltas/tv/${ev.id}`}
                        className="block px-4 py-2 text-sm hover:bg-white/10 rounded-lg transition"
                      >
                        {ev.nombreEvento || "Evento"}
                      </Link>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user && emailVerified && (
            <>
              <Link href="/mis-inscripciones" className="text-white/70 hover:text-white transition">
                Mis Inscripciones
              </Link>
              <Link href="/perfil" className="text-white/70 hover:text-white transition">
                Perfil
              </Link>
            </>
          )}

          {esAdmin && (
            <Link href="/admin" className="text-white/70 hover:text-white transition">
              Admin
            </Link>
          )}
        </nav>

        {/* RIGHT SIDE */}
        <div className="hidden md:flex items-center gap-6">
          {!user ? (
            <>
              <Link href="/login" className="text-white/70 hover:text-white transition">
                Iniciar sesión
              </Link>

              <Link
                href="/signup"
                className="px-5 py-2 rounded-full font-semibold text-white bg-gradient-to-r from-dh-purple to-dh-purpleLight hover:scale-105 transition shadow-[0_0_20px_rgba(123,47,247,0.35)]"
              >
                Crear cuenta
              </Link>
            </>
          ) : (
            <>
              <span className="text-white/80 text-sm font-medium">
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
          className="md:hidden p-2 rounded-lg hover:bg-white/10 transition"
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
            className="fixed top-0 right-0 h-full w-72 bg-dh-panel border-l border-white/5 backdrop-blur-xl z-50 p-6 flex flex-col gap-6"
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

            <span className="text-white/70">En vivo</span>

            {user && emailVerified && (
              <>
                <Link href="/mis-inscripciones" onClick={() => setMenuOpen(false)}>
                  Mis Inscripciones
                </Link>
                <Link href="/perfil" onClick={() => setMenuOpen(false)}>
                  Perfil
                </Link>
              </>
            )}

            {esAdmin && (
              <Link href="/admin" onClick={() => setMenuOpen(false)}>
                Admin
              </Link>
            )}

            {!user ? (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  Iniciar sesión
                </Link>

                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="mt-4 bg-gradient-to-r from-dh-purple to-dh-purpleLight text-white text-center py-3 rounded-full font-semibold"
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