import ProtectedRoute from '@/components/ProtectedRoute'
import AdminInscripcionesView from '@/components/AdminInscripcionesView'

export default function AdminInscripcionesPage() {
  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Ver Inscripciones</h1>
        <AdminInscripcionesView />
      </div>
    </ProtectedRoute>
  )
}