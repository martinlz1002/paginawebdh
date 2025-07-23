import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import TempAuthGuard from "@/components/TempAuthGuard";
import { registrarInscripcionManual } from "@/lib/Inscripciones";
import type { TempUsuario } from "@/types/tempusuario";

interface FormState {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  celular: string;
  ciudad: string;
  estado: string;
  pais: string;
  club: string;
  competitorNumber: number;
}

export default function ManualPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [tempUser, setTempUser] = useState<(TempUsuario & { id: string; expiresAt: string }) | null>(null);
  const [available, setAvailable] = useState<number[]>([]);
  const [form, setForm] = useState<FormState>({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    email: "",
    celular: "",
    ciudad: "",
    estado: "",
    pais: "",
    club: "",
    competitorNumber: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // 1️⃣ Cargamos tempUser y preparamos el rango
  useEffect(() => {
    if (!id) return;
    const json = localStorage.getItem("tempUser");
    if (!json) {
      router.replace("/temp-login");
      return;
    }
    const u = JSON.parse(json) as TempUsuario & { id: string; expiresAt: string };
    if (u.id !== id || new Date(u.expiresAt).getTime() < Date.now()) {
      router.replace("/temp-login");
      return;
    }
    setTempUser(u);
    // Generamos arreglo [start..end]
    const all = Array.from({ length: u.range.end - u.range.start + 1 }, (_, i) => u.range.start + i);
    setAvailable(all);
  }, [id, router]);

  const handleSubmit = async () => {
    if (!tempUser) return;
    try {
      await registrarInscripcionManual({
        carreraId: tempUser.carreraId,
        perfilNombre: form.nombre,
        perfilApPaterno: form.apellidoPaterno,
        perfilApMaterno: form.apellidoMaterno,
        email: form.email,
        celular: form.celular,
        ciudad: form.ciudad,
        estado: form.estado,
        pais: form.pais,
        club: form.club,
        competitorNumber: form.competitorNumber,
        paymentStatus: "manual",
      });
      alert("Competidor registrado correctamente");
      setAvailable((av) => av.filter((n) => n !== form.competitorNumber));
      setForm((f) => ({ ...f, competitorNumber: 0 }));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <TempAuthGuard>
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <h2 className="text-xl">Inscripción Manual</h2>
        {error && <p className="text-red-600">{error}</p>}

        <label>Número</label>
        <select
          className="w-full p-2 border"
          value={form.competitorNumber}
          onChange={(e) => setForm(f => ({ ...f, competitorNumber: +e.target.value }))}
        >
          <option value={0}>-- elige --</option>
          {available.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {["nombre","apellidoPaterno","apellidoMaterno","email","celular"].map(field => (
          <div key={field}>
            <label className="block font-medium">
              {field === "email" ? "Email" : field === "celular" ? "Celular" : field.replace(/([A-Z])/g, " $1")}
            </label>
            <input
              type={field==="email"?"email":"text"}
              className="w-full p-2 border"
              value={(form as any)[field]}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            />
          </div>
        ))}

        <label>Ciudad / Estado / País</label>
        <div className="grid grid-cols-3 gap-2">
          {["ciudad","estado","pais"].map(loc => (
            <input
              key={loc}
              placeholder={loc.charAt(0).toUpperCase()+loc.slice(1)}
              className="p-2 border"
              value={(form as any)[loc]}
              onChange={e => setForm(f => ({ ...f, [loc]: e.target.value }))}
            />
          ))}
        </div>

        <label>Club (opcional)</label>
        <input
          className="w-full p-2 border"
          value={form.club}
          onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
        />

        <button
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          onClick={handleSubmit}
        >
          Registrar Competidor
        </button>
      </div>
    </TempAuthGuard>
  );
}