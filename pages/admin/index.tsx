import AdminCarrerasForm from "@/components/AdminCarrerasForm";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <aside className="col-span-1 bg-gray-50 p-4 rounded shadow">
            <h2 className="font-semibold mb-4">Menú</h2>
            <ul className="space-y-2">
              <li>
                <button className="w-full text-left">Crear Carrera</button>
              </li>
              {/* aquí más opciones en el futuro */}
            </ul>
          </aside>
          <main className="col-span-2">
            <AdminCarrerasForm />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}