import { useEffect, useState } from "react";
import TempAuthGuard from "@/components/TempAuthGuard";
import Layout from "@/components/Layout";
import { registrarInscripcionManual } from "@/lib/Inscripciones";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TempUsuario } from "@/types/tempusuario";

export default function InscripcionesManualesPage() {
  const [tempUser, setTempUser] = useState<TempUsuario | null>(null);
  const [usedNumbers, setUsedNumbers] = useState<number[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [perfilData, setPerfilData] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    email: "",
    celular: "",
    ciudad: "",
    estado: "",
    pais: "",
    club: ""
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar usuario temporal
  useEffect(() => {
    const json = localStorage.getItem("tempUser");
    if (json) {
      const user = JSON.parse(json) as TempUsuario;
      setTempUser(user);
    }
  }, []);

  // Cargar números ya usados
  useEffect(() => {
    const loadUsed = async () => {
      if (!tempUser) return;
      const carreraId = tempUser.carreraId!;
      const q = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carreraId)
      );
      const snap = await getDocs(q);
      const nums = snap.docs
        .map(d => (d.data().competitorNumber as number) || null)
        .filter((n): n is number => n !== null);
      setUsedNumbers(nums);
    };
    loadUsed();
  }, [tempUser]);

  // Calcular números disponibles
  useEffect(() => {
    if (!tempUser) return;
    const { startNumber, endNumber } = tempUser;
    const all: number[] = [];
    for (let i = startNumber; i <= endNumber; i++) {
      if (!usedNumbers.includes(i)) all.push(i);
    }
    setAvailableNumbers(all);
    if (all.length) setSelectedNumber(all[0]);
  }, [tempUser, usedNumbers]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedNumber(parseInt(e.target.value, 10));
  };

  const handlePerfil = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPerfilData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser || selectedNumber === null) return;
    setLoading(true);
    setMessage(null);
    try {
      const carreraId = tempUser.carreraId!;
      // Usar non-null assertion para id
      await registrarInscripcionManual(
        tempUser.id!,
        carreraId,
        selectedNumber,
        perfilData
      );
      setMessage("Inscripción manual creada.");
      setUsedNumbers(prev => [...prev, selectedNumber]);
      const updated = { ...tempUser, remainingSlots: tempUser.remainingSlots - 1 };
      localStorage.setItem("tempUser", JSON.stringify(updated));
      setTempUser(updated);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!tempUser) {
    return null;
  }

  return (
    <TempAuthGuard>
      <Layout title="Inscripciones Manuales">
        <div className="max-w-lg mx-auto mt-8 bg-white p-6 rounded shadow">
          <h1 className="text-2xl font-semibold mb-4">Inscripción Manual</h1>
          <p className="mb-2">
            <strong>Carrera:</strong> {tempUser.carreraId}
          </p>
          <p className="mb-4">
            <strong>Slots restantes:</strong> {tempUser.remainingSlots}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-medium">Número de competidor</label>
              <select
                value={selectedNumber ?? ""}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                {availableNumbers.map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium">Nombre</label>
              <input
                name="nombre"
                value={perfilData.nombre}
                onChange={handlePerfil}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium">Apellido Paterno</label>
                <input
                  name="apellidoPaterno"
                  value={perfilData.apellidoPaterno}
                  onChange={handlePerfil}
                  required
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Apellido Materno</label>
                <input
                  name="apellidoMaterno"
                  value={perfilData.apellidoMaterno}
                  onChange={handlePerfil}
                  required
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium">Email</label>
              <input
                name="email"
                type="email"
                value={perfilData.email}
                onChange={handlePerfil}
                required
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium">Celular</label>
                <input
                  name="celular"
                  value={perfilData.celular}
                  onChange={handlePerfil}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Club (opcional)</label>
                <input
                  name="club"
                  value={perfilData.club}
                  onChange={handlePerfil}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-medium">Ciudad</label>
                <input
                  name="ciudad"
                  value={perfilData.ciudad}
                  onChange={handlePerfil}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">Estado</label>
                <input
                  name="estado"
                  value={perfilData.estado}
                  onChange={handlePerfil}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block font-medium">País</label>
                <input
                  name="pais"
                  value={perfilData.pais}
                  onChange={handlePerfil}
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar Inscripción'}
            </button>
          </form>

          {message && (
            <p className="mt-4 text-center text-lg text-red-600">{message}</p>
          )}
        </div>
      </Layout>
    </TempAuthGuard>
  );
}
