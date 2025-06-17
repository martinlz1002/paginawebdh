import ProtectedRoute from '@/components/ProtectedRoute'
import AdminInscripcionesView from '@/components/AdminInscripcionesView'

export default function AdminInscripcionesPage() {
  return (
    <ProtectedRoute>
      <AdminInscripcionesView />
    </ProtectedRoute>
  )
}