import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc,
} from "firebase/firestore";
import Papa from "papaparse";
import { saveAs } from "file-saver";

interface Carrera {
  id: string;
  titulo: string;
}

interface Inscripcion {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  edad?: number;
  fechaNacimiento?: string;
  celular?: string;
  pais?: string;
  estado?: string;
  ciudad?: string;
  club?: string;
  categoriaId: string;
  creado: string;
}

export default function MisInscripcionesAdmin() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState<string>("");
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [filtro, setFiltro] = useState<string>("");

  // Cargar lista de carreras
  useEffect(() => {
    async function fetchCarreras() {
      const snap = await getDocs(collection(db, "carreras"));
      const lista = snap.docs.map(doc => ({
        id: doc.id,
        titulo: doc.data().titulo as string,
      }));
      setCarreras(lista);
    }
    fetchCarreras();
  }, []);

  // Cargar inscripciones cuando cambia la carrera seleccionada
  useEffect(() => {
    async function fetchInscripciones() {
      if (!carreraSeleccionada) {
        setInscripciones([]);
        return;
      }
      const q = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carreraSeleccionada)
      );
      const snap = await getDocs(q);
      const data: Inscripcion[] = [];
      for (const docSnap of snap.docs) {
        const d = docSnap.data() as any;
        // Formatear fecha de creado
        const creado = d.creado?.seconds
          ? new Date(d.creado.seconds * 1000).toLocaleString()
          : "";
        data.push({
          id: docSnap.id,
          nombre: d.nombre,
          apellidoPaterno: d.apellidoPaterno,
          apellidoMaterno: d.apellidoMaterno,
          edad: d.edad,
          fechaNacimiento: d.fechaNacimiento,
          celular: d.celular,
          pais: d.pais,
          estado: d.estado,
          ciudad: d.ciudad,
          club: d.club,
          categoriaId: d.categoriaId,
          creado,
        });
      }
      setInscripciones(data);
    }
    fetchInscripciones();
  }, [carreraSeleccionada]);

  // Exportar a CSV
  const exportCSV = () => {
    const csv = Papa.unparse(inscripciones);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "inscripciones.csv");
  };

  // Filtrar inscripciones para búsqueda
  const inscripcionesFiltradas = inscripciones.filter(insc => {
    const term = filtro.toLowerCase();
    return Object.values(insc).some(val =>
      val != null
        ? val.toString().toLowerCase().includes(term)
        : false
    );
  });

  return (
    <div className="bg-white p-6 rounded shadow">
      <div className="mb-4">
        <label className="block font-semibold mb-1">
          Selecciona una carrera:
        </label>
        <select
          className="w-full border p-2 rounded"
          value={carreraSeleccionada}
          onChange={e => setCarreraSeleccionada(e.target.value)}
        >
          <option value="">-- Elige una carrera --</option>
          {carreras.map(c => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </div>

      {carreraSeleccionada && (
        <>
          <div className="mb-4 flex justify-between items-center gap-4">
            <input
              type="text"
              placeholder="Buscar en inscripciones..."
              className="flex-1 border p-2 rounded"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
            <button
              onClick={exportCSV}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
          </div>

          {inscripcionesFiltradas.length === 0 ? (
            <p>No hay inscripciones para esta carrera.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2">Nombre</th>
                    <th className="border p-2">Apellido Paterno</th>
                    <th className="border p-2">Apellido Materno</th>
                    <th className="border p-2">Edad</th>
                    <th className="border p-2">Fecha Nac.</th>
                    <th className="border p-2">Celular</th>
                    <th className="border p-2">País</th>
                    <th className="border p-2">Estado</th>
                    <th className="border p-2">Ciudad</th>
                    <th className="border p-2">Club</th>
                    <th className="border p-2">Categoría ID</th>
                    <th className="border p-2">Registrado el</th>
                  </tr>
                </thead>
                <tbody>
                  {inscripcionesFiltradas.map(insc => (
                    <tr key={insc.id} className="hover:bg-gray-50">
                      <td className="border p-2">{insc.nombre}</td>
                      <td className="border p-2">{insc.apellidoPaterno}</td>
                      <td className="border p-2">{insc.apellidoMaterno}</td>
                      <td className="border p-2">{insc.edad}</td>
                      <td className="border p-2">{insc.fechaNacimiento}</td>
                      <td className="border p-2">{insc.celular}</td>
                      <td className="border p-2">{insc.pais}</td>
                      <td className="border p-2">{insc.estado}</td>
                      <td className="border p-2">{insc.ciudad}</td>
                      <td className="border p-2">{insc.club}</td>
                      <td className="border p-2">{insc.categoriaId}</td>
                      <td className="border p-2">{insc.creado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}