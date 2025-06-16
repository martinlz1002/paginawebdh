// components/AdminPanel.tsx
import { useState } from "react";
import AdminCarrerasForm from "./AdminCarrerasForm";
import AdminCarrerasList from "./AdminCarrerasList";
import AdminInscripcionesView from "./AdminInscripcionesView";

export default function AdminPanel() {
  const [vista, setVista] = useState<"crear" | "listar" | "inscripciones">("crear");

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>
      <aside className="mb-6">
        <button onClick={() => setVista("crear")} className={`mr-4 ${vista==="crear"?"underline":""}`}>Crear/Editar Carreras</button>
        <button onClick={() => setVista("listar")} className={`mr-4 ${vista==="listar"?"underline":""}`}>Listar Carreras</button>
        <button onClick={() => setVista("inscripciones")} className={`${vista==="inscripciones"?"underline":""}`}>Ver Inscripciones</button>
      </aside>

      {vista === "crear" && (
        <AdminCarrerasForm onSuccess={() => setVista("listar")} />
      )}
      {vista === "listar" && (
        <AdminCarrerasList onEdit={(c) => {
          setVista("crear");
          // pasas initialValues={c} al Formulario
        }} />
      )}
      {vista === "inscripciones" && <AdminInscripcionesView />}
    </div>
  );
}