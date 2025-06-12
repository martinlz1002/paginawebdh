import { useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/router";
import Link from "next/link";
import { app } from "@/lib/firebase";

export default function LoginForm() {
  const auth = getAuth(app);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<React.ReactNode>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

   try {
  await signInWithEmailAndPassword(auth, email, password);
  router.push("/");
} catch (err: any) {
  if (err.code === "auth/user-not-found") {
    setError(
      <>
        Usuario no registrado. ¿Deseas{" "}
        <span
          onClick={() => router.push("/signup")}
          className="text-blue-600 underline cursor-pointer"
        >
          registrarte
        </span>
        ?
      </>
    );
  } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-login-credentials") {
    setError("Correo o contraseña incorrecta.");
  } else {
    setError("Error al iniciar sesión. Intenta nuevamente.");
  }
}
  };

  // 🧼 Limpiar error después de 5 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
        <div className="mt-2 text-sm text-center">
  <span>¿Olvidaste tu contraseña? </span>
  <Link href="/reset-password" className="text-blue-600 underline">
    Restablecer
  </Link>
</div>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  );
}