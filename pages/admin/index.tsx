import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'crear' | 'inscritos'>('crear');
  const [carreras, setCarreras] = useState<any[]>([]);
  const [nuevaCarrera, setNuevaCarrera] = useState({
    titulo: '',
    descripcion: '',
    ubicacion: '',
    fecha: '',
  });
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState('');

  // Cargar carreras existentes (para "Inscritos")
  const fetchCarreras = async () => {
    const snap = await getDocs(collection(db, 'carreras'));
    setCarreras(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    // Verificar admin
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) window.location.href = "/login";
    });
    if (activeTab === 'inscritos') fetchCarreras();
    return () => unsub();
  }, [activeTab]);

  const crearCarrera = async () => {
    if (!nuevaCarrera.titulo || !nuevaCarrera.fecha || !imagenArchivo) {
      setMensaje('Completa todos los campos e imagen');
      return;
    }
    setMensaje('Creando...');
    try {
      const functions = getFunctions();
      const crearFn = httpsCallable(functions, 'crearCarrera');

      let base64 = '';
      const reader = new FileReader();
      reader.readAsDataURL(imagenArchivo);
      await new Promise(res => reader.onloadend = res);
      base64 = (reader.result as string).split(',')[1];

      await crearFn({
        ...nuevaCarrera,
        imagenBase64: base64,
        nombreArchivo: imagenArchivo.name,
      });
      setMensaje('Carrera creada con éxito');
      setNuevaCarrera({ titulo: '', descripcion: '', ubicacion: '', fecha: '' });
      setImagenArchivo(null);
    } catch (err) {
      console.error(err);
      setMensaje('Error al crear carrera');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-6">
        <h2 className="text-2xl font-bold mb-6">Panel Admin</h2>
        <nav className="space-y-2">
          <button
            className={`w-full text-left px-4 py-2 rounded ${activeTab === 'crear' ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
            onClick={() => setActiveTab('crear')}
          >
            Crear Carrera
          </button>
          <button
            className={`w-full text-left px-4 py-2 rounded ${activeTab === 'inscritos' ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
            onClick={() => setActiveTab('inscritos')}
          >
            Competidores
          </button>
          {/* Más opciones futuras */}
          <button disabled className="w-full text-left px-4 py-2 rounded opacity-50 cursor-not-allowed">
            Análisis Tráfico
          </button>
          <button disabled className="w-full text-left px-4 py-2 rounded opacity-50 cursor-not-allowed">
            Exportar Excel
          </button>
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 bg-gray-50">
        {activeTab === 'crear' && (
          <div>
            <h1 className="text-2xl font-bold mb-4">Crear Nueva Carrera</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Título"
                value={nuevaCarrera.titulo}
                onChange={e => setNuevaCarrera({ ...nuevaCarrera, titulo: e.target.value })}
                className="border p-2 rounded w-full"
              />
              <input
                type="date"
                value={nuevaCarrera.fecha}
                onChange={e => setNuevaCarrera({ ...nuevaCarrera, fecha: e.target.value })}
                className="border p-2 rounded w-full"
              />
              <input
                type="text"
                placeholder="Ubicación"
                value={nuevaCarrera.ubicacion}
                onChange={e => setNuevaCarrera({ ...nuevaCarrera, ubicacion: e.target.value })}
                className="border p-2 rounded w-full"
              />
              <textarea
                placeholder="Descripción"
                value={nuevaCarrera.descripcion}
                onChange={e => setNuevaCarrera({ ...nuevaCarrera, descripcion: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>
            <div className="mb-4">
              <input
                type="file"
                accept="image/*"
                onChange={e => setImagenArchivo(e.target.files?.[0] || null)}
                className="border p-2 rounded"
              />
            </div>
            <button
              onClick={crearCarrera}
              className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700"
            >
              Guardar Carrera
            </button>
            {mensaje && <p className="mt-4 text-gray-800">{mensaje}</p>}
          </div>
        )}

        {activeTab === 'inscritos' && (
          <div>
            <h1 className="text-2xl font-bold mb-4">Competidores Inscritos</h1>
            {carreras.length === 0 ? (
              <p>No hay carreras disponibles.</p>
            ) : (
              <ul className="space-y-2">
                {carreras.map(c => (
                  <li key={c.id} className="bg-white p-4 rounded shadow">
                    <p className="font-semibold">{c.titulo}</p>
                    <p className="text-sm text-gray-600">ID: {c.id}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
