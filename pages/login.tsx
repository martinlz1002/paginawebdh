import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/router";
import { app } from "@/lib/firebase";

export default function LoginForm() {
  const auth = getAuth(app);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");  // Redirige al inicio tras iniciar sesión
    } catch (err: any) {
      const errorCode = err.code;
      if (errorCode === "auth/user-not-found") {
        setError("Usuario no registrado. ¿Deseas registrarte?");
      } else if (errorCode === "auth/wrong-password") {
        setError("Correo o contraseña incorrecta.");
      } else {
        setError("Error al iniciar sesión. Intenta nuevamente.");
      }
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Iniciar sesión</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />
        <button
          type="submit"
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 w-full"
        >
          Iniciar sesión
        </button>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  );
}