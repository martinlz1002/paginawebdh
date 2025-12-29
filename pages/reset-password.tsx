import Link from "next/link";
import { useMemo, useState } from "react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { app } from "@/lib/firebase";

const cardBase = "bg-white rounded-2xl border border-dh-purple/10 shadow-dh";
const inputBase =
  "w-full rounded-xl border border-dh-purple/15 bg-white px-3 py-2.5 pl-11 text-dh-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-dh-green/40";
const btnBase =
  "w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-extrabold transition";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function ResetPasswordPage() {
  const auth = getAuth(app);

  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const emailOk = useMemo(() => isValidEmail(email), [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    setError(null);

    const clean = email.trim();
    if (!emailOk) {
      setError("Escribe un correo válido.");
      return;
    }

    setEnviando(true);

    try {
      // ✅ Recomendado: fuerza que el link vuelva a tu dominio
      // Nota: tu app debe tener ese dominio autorizado en Firebase Auth.
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(auth, clean, actionCodeSettings);
      setMensaje(
        "Listo ✅ Te mandamos un enlace para restablecer tu contraseña. Revisa tu bandeja y spam."
      );
    } catch (err: any) {
      const code = err?.code;

      if (code === "auth/invalid-email") {
        setError("Ese correo no es válido.");
      } else if (code === "auth/user-not-found") {
        setError("No existe una cuenta con ese correo.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos. Espera un momento y vuelve a intentar.");
      } else {
        setError("Error al enviar el correo. Intenta más tarde.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-dh-soft px-4 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className={`${cardBase} p-7`}>
          <h1 className="text-2xl font-extrabold text-dh-ink">
            Restablecer contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Te enviaremos un enlace seguro para crear una nueva contraseña.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Tu correo registrado"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputBase}
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={enviando || !emailOk}
              className={`${btnBase} ${
                enviando || !emailOk
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-dh-green text-dh-dark hover:opacity-95"
              }`}
            >
              {enviando ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>

          {mensaje && (
            <div className="mt-4 rounded-xl border border-dh-green/30 bg-dh-green/10 px-3 py-2 text-sm text-dh-ink">
              {mensaje}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600 flex items-center justify-between">
            <Link href="/login" className="font-semibold text-dh-purple hover:underline">
              Volver a iniciar sesión
            </Link>
            <Link href="/signup" className="font-semibold text-dh-green hover:underline">
              Crear cuenta
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          Tip: Si no te llega, revisa “Spam” o “Promociones”.
        </p>
      </div>
    </div>
  );
}
