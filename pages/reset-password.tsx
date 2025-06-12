import { useState } from "react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { app } from "@/lib/firebase";

export default function ResetPasswordPage() {
  const auth = getAuth(app);
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    setEnviando(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMensaje("Te hemos enviado un enlace para restablecer tu contraseña.");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No se encontró una cuenta con ese correo.");
      } else {
        setError("Error al enviar el correo. Intenta más tarde.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Restablecer contraseña</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Tu correo registrado"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />
        <button
          type="submit"
          disabled={enviando}
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 w-full disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>

      {mensaje && <p className="mt-4 text-green-700">{mensaje}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  );
}