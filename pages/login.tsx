
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";

import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";

import {
  EnvelopeIcon,
  LockClosedIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

import { motion, AnimatePresence } from "framer-motion";
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
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const emailOk = useMemo(
    () => isValidEmail(email),
    [email]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();

    if (!emailOk) {
      setError("Escribe un correo electrónico válido.");
      return;
    }

    if (password.length === 0) {
      setError("Escribe tu contraseña.");
      return;
    }

    setCargando(true);

    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      await cred.user.reload();

      if (!cred.user.emailVerified) {
        setError("Aún no has verificado tu correo.");

        await auth.signOut();
        return;
      }

      // Actualizar token
      await cred.user.getIdToken(true);

      // Regresar a la página solicitada, si existe
      const next =
        typeof router.query.next === "string"
          ? router.query.next
          : "/";

      await router.replace(next);

    } catch (err: any) {
      console.error("Error de inicio de sesión:", err.code, err);

      const code = err?.code;

      switch (code) {
        case "auth/user-not-found":
          setError("No existe una cuenta con ese correo.");
          break;

        case "auth/wrong-password":
          setError("Contraseña incorrecta.");
          break;

        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
          setError("Correo o contraseña incorrectos.");
          break;

        case "auth/invalid-email":
          setError("El correo electrónico no tiene un formato válido.");
          break;

        case "auth/user-disabled":
          setError("Esta cuenta ha sido deshabilitada.");
          break;

        case "auth/too-many-requests":
          setError("Demasiados intentos. Espera un momento e inténtalo nuevamente.");
          break;

        case "auth/network-request-failed":
          setError("No se pudo conectar. Revisa tu conexión a internet.");
          break;

        case "auth/operation-not-allowed":
          setError("El inicio de sesión con correo y contraseña no está habilitado.");
          break;

        default:
          setError("No se pudo iniciar sesión. Intenta nuevamente.");
          break;
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

          {/* TÍTULO */}
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                autoComplete="email"
                required
                className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-purple/50 transition"
              />
            </div>

            {/* PASSWORD */}
            <div className="relative">
              <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />

              <input
                type={mostrarPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                required
                className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-purple/50 transition"
              />

              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-dh-purple transition"
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* LINKS */}
            <div className="flex justify-between text-sm text-white/70">
              <Link
                href="/reset-password"
                className="hover:text-dh-purple transition"
              >
                ¿Olvidaste tu contraseña?
              </Link>

              <Link
                href="/signup"
                className="hover:text-dh-purple transition"
              >
                Crear cuenta
              </Link>
            </div>

            {/* BOTÓN */}
            <button
              type="submit"
              disabled={cargando || !emailOk || password.length === 0}
              className={`w-full py-3 rounded-2xl font-bold transition-all duration-300 ${
                cargando || !emailOk || password.length === 0
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-dh-purple text-black hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(123,47,247,0.4)]"
              }`}
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : (
                "Entrar"
              )}
            </button>

          </form>

          {/* MENSAJE DE ERROR */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={error}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                role="alert"
                aria-live="polite"
                className="mt-6 flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20"
              >
                <ExclamationCircleIcon className="w-6 h-6 text-red-400 shrink-0" />

                <p className="text-sm text-red-400 font-medium">
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FOOTER */}
          <p className="mt-10 text-center text-xs text-white/40">
            DHTime · Cronometraje & Eventos
          </p>

        </div>
      </motion.div>
    </div>
  );
}
