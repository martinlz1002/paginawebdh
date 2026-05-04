import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import { app } from "@/lib/firebase";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function LoginPage() {
  const auth = getAuth(app);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const emailOk = useMemo(() => isValidEmail(email), [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();

    if (!emailOk) {
      setError("Escribe un correo válido.");
      return;
    }

    if (!password.trim()) {
      setError("Escribe tu contraseña.");
      return;
    }

    setCargando(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);

      await cred.user.reload();
      if (!cred.user.emailVerified) {
        setError("Aún no has verificado tu correo.");
        await auth.signOut();
        return;
      }

      router.push("/");
    } catch (err: any) {
      const code = err?.code;

      if (code === "auth/user-not-found") {
        setError("No existe una cuenta con ese correo.");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Correo o contraseña incorrecta.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Espera un momento.");
      } else {
        setError("Error al iniciar sesión.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0c0c0f] flex items-center justify-center overflow-hidden px-6">

      {/* Fondo dinámico */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-purpleDark/20 blur-3xl opacity-40" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-10 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

          <h1 className="text-4xl font-black text-white text-center">
            Iniciar sesión
          </h1>

          <p className="mt-3 text-center text-white/70 text-sm">
            Accede a tu panel y gestiona tus carreras.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">

            {/* EMAIL */}
            <div className="relative">
              <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-purple/50 transition"
              />
            </div>

            {/* PASSWORD */}
            <div className="relative">
              <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-purple/50 transition"
              />
            </div>

            {/* LINKS */}
            <div className="flex justify-between text-sm text-white/70">
              <Link href="/reset-password" className="hover:text-dh-purple transition">
                ¿Olvidaste tu contraseña?
              </Link>
              <Link href="/signup" className="hover:text-dh-purple transition">
                Crear cuenta
              </Link>
            </div>

            {/* BOTÓN */}
            <button
              type="submit"
              disabled={cargando || !emailOk}
              className={`w-full py-3 rounded-2xl font-bold transition-all duration-300 ${
                cargando || !emailOk
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-dh-purple text-black hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,255,120,0.4)]"
              }`}
            >
              {cargando ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {error && (
            <div className="mt-6 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <p className="mt-10 text-center text-xs text-white/40">
            DHTime · Cronometraje & Eventos
          </p>
        </div>
      </motion.div>
    </div>
  );
}
