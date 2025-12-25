import { useState } from "react";
import { useRouter } from "next/router";

interface TempUser {
  id: string;
  username: string;
  carreraId: string;
  range: { start: number; end: number };
  expiresAt: string;
  expiresAtMs: number; // ✅ IMPORTANTÍSIMO
}

export default function TempLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/temp-login?t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Error de autenticación");
      }

      const user = data.user as TempUser;

      if (!user?.id || typeof user.expiresAtMs !== "number") {
        throw new Error("Respuesta inválida del servidor (faltan datos).");
      }

      // Guardamos TODO (incluye expiresAtMs) + password
      localStorage.setItem("tempUser", JSON.stringify({ ...user, password }));

      // ✅ GUION NORMAL (IMPORTANTÍSIMO)
      router.push(`/inscripcion-manual/${user.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Login Temporal</h1>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium">Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block font-medium">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}