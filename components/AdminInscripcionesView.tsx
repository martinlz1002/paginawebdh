import { useEffect, useState } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Carrera {
  id: string;
  titulo: string;
}

interface Inscripcion {
  id: string;
  perfilNombre: string;
  categoria: string;
  timestamp: Timestamp;
}

export default function AdminInscripcionesView() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState<string>("");
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);

  // 1) Cargo todas las carreras
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));
      setCarreras(
        snap.docs.map((d) => ({ id: d.id, titulo: d.data().titulo }))
      );
    })();
  }, []);

  // 2) Cada que cambie carreraSeleccionada, cargo sus inscripciones
  useEffect(() => {
    if (!carreraSeleccionada) {
      setInscripciones([]);
      return;
    }
    (async () => {
      const q = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carreraSeleccionada)
      );
      const snap = await getDocs(q);
      const list: Inscripcion[] = [];
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        // recuperar nombre del perfil en línea (podrías optimizar con subconsulta o embed)
        const perfilDoc = await getDocs(
          collection(db, "usuarios", data.perfilId, "perfiles")
        );
        const perfilData = perfilDoc.docs.find(
          (p) => p.id === data.perfilId
        )?.data() as any;
        list.push({
          id: docSnap.id,
          perfilNombre: perfilData
            ? `${perfilData.nombre} ${perfilData.apellidoPaterno}`
            : data.perfilId,
          categoria: data.categoria,
          timestamp: data.timestamp,
        });
      }
      setInscripciones(list);
    })();
  }, [carreraSeleccionada]);

  // 3) Generar y descargar CSV
  const descargarCSV = () => {
    const header = ["Perfil", "Categoría", "Fecha Inscripción"];
    const rows = inscripciones.map((i) => [
      `"${i.perfilNombre}"`,
      `"${i.categoria}"`,
      `"${i.timestamp.toDate().toLocaleString()}"`,
    ]);
    const csvContent =
      [header, ...rows].map((r) => r.join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscripciones_${carreraSeleccionada}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Ver Inscripciones</h2>

      {/* Selector de carrera */}
      <div className="mb-4">
        <label className="block font-medium">Elige carrera:</label>
        <select
          className="mt-1 w-full border p-2 rounded"
          value={carreraSeleccionada}
          onChange={(e) => setCarreraSeleccionada(e.target.value)}
        >
          <option value="">-- Selecciona --</option>
          {carreras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla de inscripciones */}
      {inscripciones.length > 0 && (
        <>
          <table className="w-full table-auto border-collapse mb-4">
            <thead>
              <tr>
                <th className="border p-2">Perfil</th>
                <th className="border p-2">Categoría</th>
                <th className="border p-2">Fecha Inscripción</th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map((i) => (
                <tr key={i.id}>
                  <td className="border p-2">{i.perfilNombre}</td>
                  <td className="border p-2">{i.categoria}</td>
                  <td className="border p-2">
                    {i.timestamp.toDate().toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={descargarCSV}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Descargar CSV
          </button>
        </>
      )}

      {carreraSeleccionada && inscripciones.length === 0 && (
        <p>No hay inscripciones aún para esta carrera.</p>
      )}
    </div>
  );
}