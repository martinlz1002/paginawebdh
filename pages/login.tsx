import { useState } from "react";
import { useRouter } from "next/router";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [sugerirRegistro, setSugerirRegistro] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje("");
    setSugerirRegistro(false);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/perfil");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        setSugerirRegistro(true);
        setMensaje("Usuario no encontrado. ¿Deseas registrarte?");
      } else if (error.code === "auth/wrong-password") {
        setMensaje("Contraseña incorrecta.");
      } else {
        setMensaje("Error: " + error.message);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-4">Iniciar sesión</h1>
      <form onSubmit={handleLogin} className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium">Correo electrónico</label>
          <input
            type="email"
            className="w-full border p-2 rounded mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Contraseña</label>
          <input
            type="password"
            className="w-full border p-2 rounded mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          Iniciar sesión
        </button>
      </form>

      {mensaje && (
        <p className={`mt-4 ${sugerirRegistro ? "text-orange-600" : "text-red-600"}`}>
          {mensaje}
        </p>
      )}

      {sugerirRegistro && (
        <div className="mt-4 text-sm">
          <a
            href="/signup"
            className="text-green-600 hover:underline"
          >
            Crear una cuenta nueva →
          </a>
        </div>
      )}
    </div>
  );
}