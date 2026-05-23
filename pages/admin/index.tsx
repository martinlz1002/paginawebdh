import React, { useEffect, useMemo, useState } from "react";
import { getDocs, collection } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { app, db } from "@/lib/firebase";
import AdminSidebar from "@/components/AdminSidebar";
import AdminCarrerasForm from "@/components/AdminCarrerasForm";
import AdminCarrerasList, { CarreraItem } from "@/components/AdminCarrerasList";
import AdminInscripcionesView from "@/components/AdminInscripcionesView";
import InscripcionesManualesPage from "./inscripciones-manuales";
import AdminGaleria from "@/components/AdminGaleria";
import EliminarInscripciones, { CarreraOption } from "@/components/EliminarInscripciones";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import AdminBusquedaCompetidor from '@/components/AdminBusquedaCompetidor';

type View =
  | "crear"
  | "listar"
  | "inscripciones"
  | "inscripcionesManuales"
  | "eliminarInscripciones"
  | "galeria"
  | 'buscarCompetidor';

export default function AdminPage() {
  const [view, setView] = useState<View>("crear");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editItem, setEditItem] = useState<CarreraItem | null>(null);

  const [carreras, setCarreras] = useState<CarreraOption[]>([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 🔁 Para forzar refresh de vistas que usan getDocs (no realtime)
  const [refreshKey, setRefreshKey] = useState(0);

  // Function en us-central1
  const functions = getFunctions(app, "us-central1");
  const fnBorrar = httpsCallable<{ carreraId: string }, { eliminado: number }>(
    functions,
    "borrarInscripcionesDeCarrera"
  );

  const loadCarreras = async () => {
    const snap = await getDocs(collection(db, "carreras"));
    setCarreras(
      snap.docs.map((d) => ({
        id: d.id,
        titulo: (d.data() as any).titulo || "Sin título",
      }))
    );
  };

  useEffect(() => {
    loadCarreras();
  }, []);

  // ✅ Renovar token al montar para agarrar claim admin
  useEffect(() => {
    const auth = getAuth(app);
    auth.currentUser?.getIdToken(true).catch(console.error);
  }, []);

  // ✅ Refrescar carreras al entrar a vistas que las necesitan (selects)
  useEffect(() => {
    if (view === "eliminarInscripciones" || view === "inscripcionesManuales") {
      loadCarreras().catch(console.error);
    }
  }, [view]);

  const handleDeleteInscripciones = async (carreraId: string) => {
    setLoadingDelete(true);
    setFeedback(null);

    try {
      const auth = getAuth(app);
      await auth.currentUser?.getIdToken(true);

      const { data } = await fnBorrar({ carreraId });

      setFeedback(`Se borraron ${data.eliminado} inscripciones.`);
      await loadCarreras();

      // ✅ fuerza refresh para que si estás viendo inscripciones luego, no se quede cacheado
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error(err);
      setFeedback(
        err?.code === "permission-denied"
          ? "No tienes permisos para borrar inscripciones."
          : err?.message || "Error interno al borrar inscripciones."
      );
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleSetView = (v: View) => {
    setView(v);
    setFeedback(null);

    // opcional: cerrar sidebar al seleccionar
    // setSidebarOpen(false);
  };

  // ✅ key para remount de AdminInscripcionesView cuando haga falta
  const inscripcionesKey = useMemo(() => `insc_${refreshKey}`, [refreshKey]);

  return (
    <div className="relative flex pt-16">
      <button
        onClick={() => setSidebarOpen((o) => !o)}
        className="fixed top-20 left-4 z-50 p-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition"
        title={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
      >
        {sidebarOpen ? (
          <ChevronLeftIcon className="w-6 h-6" />
        ) : (
          <ChevronRightIcon className="w-6 h-6" />
        )}
      </button>

      <AdminSidebar
        view={view}
        setView={handleSetView}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
      />

      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-0"
        } flex-1 p-6`}
      >
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>

        {view === "crear" && (
          <AdminCarrerasForm
            initialValues={editItem ?? undefined}
            onSuccess={() => {
              setEditItem(null);
              setView("listar");
              loadCarreras();
              setRefreshKey((k) => k + 1);
            }}
          />
        )}

        {view === "listar" && (
          <AdminCarrerasList
            onEdit={(c) => {
              setEditItem(c);
              setView("crear");
            }}
          />
        )}

        {view === "inscripciones" && <AdminInscripcionesView key={inscripcionesKey} />}

        {view === "inscripcionesManuales" && <InscripcionesManualesPage />}

        {view === "eliminarInscripciones" && (
          <EliminarInscripciones
            carreras={carreras}
            onDelete={handleDeleteInscripciones}
            loading={loadingDelete}
            feedback={feedback}
          />
        )}

        {view === "galeria" && <AdminGaleria />}

        {view === 'buscarCompetidor' && (
          <AdminBusquedaCompetidor carreras={carreras} />
        )}
      </main>
    </div>
  );
}
