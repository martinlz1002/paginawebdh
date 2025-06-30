import React, { useState } from "react";
import { useRouter } from "next/router";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { app } from "@/lib/firebase";

export default function LoginPage() {
  const auth = getAuth(app);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        setError("Aún no has verificado tu correo.");
        await cred.user.reload();
        await auth.signOut();
        return;
      }
      router.push("/");
    } catch (err: any) {
      switch (err.code) {
        case "auth/user-not-found":
          setError("Usuario no registrado. ¿Deseas registrarte?");
          break;
        case "auth/wrong-password":
          setError("Correo o contraseña incorrecta.");
          break;
        default:
          setError("Error al iniciar sesión. Intenta nuevamente.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg transform transition-transform hover:scale-105">
        <h1 className="text-3xl font-bold text-green-700 text-center mb-6">Bienvenido</h1>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="relative">
            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} required className="w-full pl-11 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 transition" />
          </div>
          <div className="relative">
            <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required className="w-full pl-11 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 transition" />
          </div>
          <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-xl hover:bg-green-700 transition">Iniciar sesión</button>
        </form>
        {error && <p className="mt-4 text-center text-red-600">{error}</p>}
        <p className="mt-6 text-center text-sm text-gray-500">¿No tienes cuenta? <a href="/signup" className="text-green-600 hover:underline">Regístrate aquí</a></p>
      </div>
    </div>
  );
}