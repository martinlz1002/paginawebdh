import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { app } from "@/lib/firebase";

const cardBase = "bg-white rounded-2xl border border-dh-purple/10 shadow-dh";
const inputBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-3 py-2.5 pl-11 text-dh-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const btnBase =
  "w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-extrabold transition";

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

      // ✅ Si no está verificado, corta sesión y avisa
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        setError("Aún no has verificado tu correo. Revisa tu bandeja y spam.");
        await auth.signOut();
        return;
      }

      router.push("/");
    } catch (err: any) {
      const code = err?.code;

      if (code === "auth/user-not-found") {
        setError("No existe una cuenta con ese correo. ¿Quieres registrarte?");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Correo o contraseña incorrecta.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Espera un momento y vuelve a intentar.");
      } else if (code === "auth/invalid-email") {
        setError("Correo inválido.");
      } else {
        setError("Error al iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-dh-soft px-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className={`${cardBase} p-8`}>
          <h1 className="text-3xl font-extrabold text-dh-ink text-center">
            Bienvenido
          </h1>
          <p className="mt-2 text-sm text-gray-600 text-center">
            Inicia sesión para inscribirte y gestionar tus carreras.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputBase}
              />
            </div>

            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputBase}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link
                href="/reset-password"
                className="font-semibold text-dh-purple hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>

              <Link
                href="/signup"
                className="font-semibold text-dh-green hover:underline"
              >
                Crear cuenta
              </Link>
            </div>

            <button
              type="submit"
              disabled={cargando || !emailOk}
              className={`${btnBase} ${
                cargando || !emailOk
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-dh-purple text-white hover:opacity-95"
              }`}
            >
              {cargando ? "Entrando..." : "Iniciar sesión"}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 text-center">
              {error}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            ¿No tienes cuenta?{" "}
            <Link href="/signup" className="font-semibold text-dh-green hover:underline">
              Regístrate aquí
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          DHTime · Cronometraje & Eventos
        </p>
      </div>
    </div>
  );
}
