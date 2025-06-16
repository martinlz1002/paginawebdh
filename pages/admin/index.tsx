// pages/admin/index.tsx
import { useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminCarrerasForm from '@/components/AdminCarrerasForm'
import AdminCarrerasList from '@/components/AdminCarrerasList'
import type { CarreraData } from '@/types/carrera'

export default function AdminPage() {
  const [vista, setVista] = useState<'crear'|'listar'>('listar')
  const [editar, setEditar] = useState<(CarreraData & { id: string })|null>(null)

  return (
    <ProtectedRoute>
      <div className="flex">
        <aside className="w-1/4 p-4 bg-gray-100">
          <button
            className="block mb-2"
            onClick={() => {
              setVista('crear')
              setEditar(null)
            }}
          >
            + Crear Carrera
          </button>
          <button className="block" onClick={() => setVista('listar')}>
            ⚙️ Administrar Carreras
          </button>
        </aside>
        <main className="flex-1 p-6">
          {vista === 'crear' && (
            <AdminCarrerasForm
              initialValues={editar ?? undefined}
              onSuccess={() => setVista('listar')}
            />
          )}
          {vista === 'listar' && (
            <AdminCarrerasList onEdit={(c) => {
              setEditar(c)
              setVista('crear')
            }} />
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}