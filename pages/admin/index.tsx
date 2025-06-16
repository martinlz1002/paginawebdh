import { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminCarrerasForm from "@/components/AdminCarrerasForm";
import InscripcionesAdmin from "@/components/AdminInscripciones";

export default function AdminPage() {
  // ← Aquí, dentro del componente
  const [vista, setVista] = useState<"crear" | "inscripciones">("crear");

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>
        <div className="flex gap-4">
          <aside className="w-1/4 bg-gray-50 p-4 rounded shadow">
            <h2 className="font-semibold mb-4">Menú</h2>
            <ul className="space-y-2">
              <li>
                <button
                  className={`w-full text-left ${
                    vista === "crear" ? "font-bold" : ""
                  }`}
                  onClick={() => setVista("crear")}
                >
                  Crear Carrera
                </button>
              </li>
              <li>
                <button
                  className={`w-full text-left ${
                    vista === "inscripciones" ? "font-bold" : ""
                  }`}
                  onClick={() => setVista("inscripciones")}
                >
                  Ver Inscripciones
                </button>
              </li>
            </ul>
          </aside>
          <main className="w-3/4">
            {vista === "crear" && <AdminCarrerasForm />}
            {vista === "inscripciones" && <InscripcionesAdmin />}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}