import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminCarrerasForm from "@/components/AdminCarrerasForm";
import AdminCarrerasList from "@/components/AdminCarrerasList";
import AdminInscripcionesView from "@/components/AdminInscripcionesView"; // si ya lo tienes

type Vista = "crear" | "gestionar" | "inscripciones";

export default function AdminPage() {
  const [vista, setVista] = useState<Vista>("crear");

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-48 bg-gray-50 p-4 rounded shadow space-y-3">
            <button
              className={`block w-full text-left px-2 py-1 rounded ${
                vista === "crear" ? "bg-purple-600 text-white" : "hover:bg-gray-200"
              }`}
              onClick={() => setVista("crear")}
            >
              Crear Carrera
            </button>
            <button
              className={`block w-full text-left px-2 py-1 rounded ${
                vista === "gestionar" ? "bg-purple-600 text-white" : "hover:bg-gray-200"
              }`}
              onClick={() => setVista("gestionar")}
            >
              Gestionar Carreras
            </button>
            <button
              className={`block w-full text-left px-2 py-1 rounded ${
                vista === "inscripciones" ? "bg-purple-600 text-white" : "hover:bg-gray-200"
              }`}
              onClick={() => setVista("inscripciones")}
            >
              Ver Inscripciones
            </button>
          </aside>

          {/* Main */}
          <main className="flex-1 ml-6">
            {vista === "crear" && <AdminCarrerasForm />}
            {vista === "gestionar" && <AdminCarrerasList />}
            {vista === "inscripciones" && <AdminInscripcionesView />}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}