import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

export default function AdminInscripciones() {
  const [carreras, setCarreras] = useState<{ id: string; titulo: string }[]>([]);
  const [carreraId, setCarreraId] = useState('');
  const [insc, setInsc] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'carreras'));
      setCarreras(snap.docs.map(d => ({ id: d.id, titulo: d.data().titulo })));
    })();
  }, []);

  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const q = query(collection(db, 'inscripciones'), where('carreraId', '==', carreraId));
      const snap = await getDocs(q);
      setInsc(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [carreraId]);

  const exportCsv = () => {
    const csv = Papa.unparse(insc);
    saveAs(new Blob([csv], { type: 'text/csv' }), `inscripciones_${carreraId}.csv`);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Inscripciones</h2>
      <select
        className="border p-2 rounded mb-4"
        onChange={e => setCarreraId(e.target.value)}
        value={carreraId}
      >
        <option value="">-- Selecciona carrera --</option>
        {carreras.map(c => (
          <option key={c.id} value={c.id}>{c.titulo}</option>
        ))}
      </select>

      {insc.length > 0 && (
        <>
          <button onClick={exportCsv} className="bg-green-600 text-white px-4 py-2 rounded mb-4">
            Exportar CSV
          </button>
          <table className="w-full border table-auto">
            <thead className="bg-gray-100">
              <tr><th className="p-2 border">Nombre</th><th className="p-2 border">Email</th><th className="p-2 border">Celular</th></tr>
            </thead>
            <tbody>
              {insc.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{i.nombre}</td>
                  <td className="p-2 border">{i.email}</td>
                  <td className="p-2 border">{i.celular}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}