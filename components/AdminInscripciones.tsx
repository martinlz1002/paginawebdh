import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Papa from "papaparse";
import { saveAs } from "file-saver";

type CarreraOpt = { id: string; titulo: string };

function toDateStr(v: any) {
  if (!v) return "";
  if (v instanceof Date) return v.toLocaleString("es-MX");
  if (v instanceof Timestamp) return v.toDate().toLocaleString("es-MX");
  if (typeof v?.toDate === "function") return v.toDate().toLocaleString("es-MX");
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("es-MX") : "";
}

function fullName(nombre?: string, paterno?: string, materno?: string) {
  return `${(nombre || "").trim()} ${(paterno || "").trim()} ${(materno || "").trim()}`
    .replace(/\s+/g, " ")
    .trim();
}

function pickNumber(i: any): number | "" {
  const n =
    (typeof i.competitorNumber === "number" && i.competitorNumber > 0 && i.competitorNumber) ||
    (typeof i.ficha === "number" && i.ficha > 0 && i.ficha) ||
    (typeof i.bib === "number" && i.bib > 0 && i.bib) ||
    0;
  return n || "";
}

export default function AdminInscripciones() {
  const [carreras, setCarreras] = useState<CarreraOpt[]>([]);
  const [carreraId, setCarreraId] = useState("");
  const [insc, setInsc] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "pending" | "manual" | "expired" | "unpaid" | "failed"
  >("all");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "carreras"));
      setCarreras(
        snap.docs.map((d) => ({
          id: d.id,
          titulo: (d.data() as any)?.titulo || "(sin título)",
        }))
      );
    })();
  }, []);

  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const qy = query(collection(db, "inscripciones"), where("carreraId", "==", carreraId));
      const snap = await getDocs(qy);
      setInsc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, [carreraId]);

  // ✅ normaliza para tabla/export (sin objetos raros)
  const rows = useMemo(() => {
    const mapped = insc.map((i) => {
      const nombres =
        (i.nombres && String(i.nombres).trim()) ||
        fullName(i.nombre, i.paterno, i.materno) ||
        "";

      const distancia = (i.ruta || i.distancia || "").toString();

      const status = (i.paymentStatus || "desconocido").toString();

      return {
        id: i.id,
        competitorNumber: pickNumber(i),
        nombres,
        email: i.email || "",
        celular: i.celular || "",
        rama: i.rama || "",
        categoria: i.categoria || "",
        distancia,
        club: i.club || "",
        paymentStatus: status,
        sessionId: i.sessionId || "",
        createdAt: toDateStr(i.timestamp),
      };
    });

    const filtered =
      statusFilter === "all"
        ? mapped
        : mapped.filter((r) => (r.paymentStatus || "").toLowerCase() === statusFilter);

    // orden pro: # asc, vacíos al final
    filtered.sort((a, b) => {
      const na = typeof a.competitorNumber === "number" ? a.competitorNumber : 9999999;
      const nb = typeof b.competitorNumber === "number" ? b.competitorNumber : 9999999;
      return na - nb;
    });

    return filtered;
  }, [insc, statusFilter]);

  const exportCsv = () => {
    const csv = Papa.unparse(rows, { quotes: false });
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `inscripciones_${carreraId}.csv`);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Inscripciones</h2>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          className="border p-2 rounded"
          onChange={(e) => setCarreraId(e.target.value)}
          value={carreraId}
        >
          <option value="">-- Selecciona carrera --</option>
          {carreras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>

        <select
          className="border p-2 rounded"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          disabled={!carreraId}
          title="Filtrar por estado de pago"
        >
          <option value="all">Todos</option>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
          <option value="manual">Manual</option>
          <option value="expired">Expirado</option>
          <option value="unpaid">Unpaid</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {rows.length > 0 ? (
        <>
          <button onClick={exportCsv} className="bg-green-600 text-white px-4 py-2 rounded mb-4">
            Exportar CSV
          </button>

          <div className="overflow-auto">
            <table className="w-full border table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">Nombre</th>
                  <th className="p-2 border">Email</th>
                  <th className="p-2 border">Celular</th>
                  <th className="p-2 border">Rama</th>
                  <th className="p-2 border">Categoría</th>
                  <th className="p-2 border">Distancia</th>
                  <th className="p-2 border">Estado</th>
                  <th className="p-2 border">Creado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{r.competitorNumber || "—"}</td>
                    <td className="p-2 border">{r.nombres || "—"}</td>
                    <td className="p-2 border">{r.email || "—"}</td>
                    <td className="p-2 border">{r.celular || "—"}</td>
                    <td className="p-2 border">{r.rama || "—"}</td>
                    <td className="p-2 border">{r.categoria || "—"}</td>
                    <td className="p-2 border">{r.distancia || "—"}</td>
                    <td className="p-2 border">{r.paymentStatus || "—"}</td>
                    <td className="p-2 border">{r.createdAt || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : carreraId ? (
        <p className="text-sm text-gray-500">No hay inscripciones para esta carrera (con ese filtro).</p>
      ) : (
        <p className="text-sm text-gray-500">Selecciona una carrera para ver inscripciones.</p>
      )}
    </div>
  );
}
