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
  <div className="space-y-8">

    {/* Header */}
    <div>
      <h2 className="text-2xl font-extrabold text-white">
        Inscripciones
      </h2>
      <p className="text-sm text-white/70 mt-1">
        Visualiza, filtra y exporta registros.
      </p>
    </div>

    {/* Filtros */}
    <div className="bg-[#16161d] border border-dh-purple/20 rounded-3xl p-6">
      <div className="flex flex-col sm:flex-row gap-4">

        {/* Carrera */}
        <select
          className="flex-1 bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
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

        {/* Estado pago */}
        <select
          className="flex-1 bg-[#141418] border border-white/10 rounded-xl px-4 py-3 text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          disabled={!carreraId}
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
    </div>

    {/* Tabla */}
    {rows.length > 0 ? (
      <div className="space-y-6">

        <button
          onClick={exportCsv}
          className="bg-dh-purple text-black font-bold px-6 py-3 rounded-xl hover:opacity-90 transition"
        >
          Exportar CSV
        </button>

        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[900px] table-auto border-collapse text-sm">
            <thead className="bg-[#1b1b22] text-white/70 uppercase text-xs tracking-wide">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Celular</th>
                <th className="p-3 text-left">Rama</th>
                <th className="p-3 text-left">Categoría</th>
                <th className="p-3 text-left">Distancia</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-left">Creado</th>
              </tr>
            </thead>

            <tbody className="bg-[#141418] text-white">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-white/5 hover:bg-[#1f1f27] transition"
                >
                  <td className="p-3 font-bold text-dh-purple">
                    {r.competitorNumber || "—"}
                  </td>
                  <td className="p-3">{r.nombres || "—"}</td>
                  <td className="p-3 text-white/70">{r.email || "—"}</td>
                  <td className="p-3">{r.celular || "—"}</td>
                  <td className="p-3">{r.rama || "—"}</td>
                  <td className="p-3">{r.categoria || "—"}</td>
                  <td className="p-3">{r.distancia || "—"}</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        r.paymentStatus === "paid"
                          ? "bg-dh-purple text-black"
                          : r.paymentStatus === "pending"
                          ? "bg-yellow-500 text-black"
                          : r.paymentStatus === "manual"
                          ? "bg-blue-500 text-white"
                          : "bg-red-600 text-white"
                      }`}
                    >
                      {r.paymentStatus || "—"}
                    </span>
                  </td>

                  <td className="p-3 text-white/70">
                    {r.createdAt || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : carreraId ? (
      <div className="text-sm text-white/70 bg-[#16161d] border border-white/10 rounded-2xl p-6">
        No hay inscripciones para esta carrera (con ese filtro).
      </div>
    ) : (
      <div className="text-sm text-white/70 bg-[#16161d] border border-white/10 rounded-2xl p-6">
        Selecciona una carrera para ver inscripciones.
      </div>
    )}
  </div>
);
}
