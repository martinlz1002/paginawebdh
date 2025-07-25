import { useState } from 'react';
import Layout from '@/components/Layout';
import AdminCarrerasForm from '@/components/AdminCarrerasForm';
import AdminCarrerasList, { CarreraItem } from '@/components/AdminCarrerasList';

export default function AdminCarrerasPage() {
  const [editando, setEditando] = useState<CarreraItem | null>(null);
  const [recarga, setRecarga] = useState(false);

  return (
    <Layout title="Admin – Carreras">
      <div className="p-6 space-y-6">
        <section className="bg-white p-6 rounded shadow">
          <h2 className="text-2xl font-semibold mb-4">
            {editando ? 'Editar carrera' : 'Crear carrera'}
          </h2>
          <AdminCarrerasForm
            initialValues={editando || undefined}
            onSuccess={() => {
              setEditando(null);
              setRecarga(!recarga);
            }}
          />
        </section>

        <section className="bg-white p-6 rounded shadow">
          <h2 className="text-2xl font-semibold mb-4">Carreras creadas</h2>
          <AdminCarrerasList
            key={recarga ? 'a' : 'b'}
            onEdit={(c) => setEditando(c)}
          />
        </section>
      </div>
    </Layout>
  );
}
