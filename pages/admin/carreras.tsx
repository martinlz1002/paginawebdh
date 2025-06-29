import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";
import { getDocs, collection } from "firebase/firestore";
import Layout from "@/components/Layout";

interface Carrera {
  id: string;
  titulo: string;
}

export default function AdminCarreras() {
  // Estados para el formulario de creación
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [price, setPrecio] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Lista de carreras para gestión de inscripciones
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [loadingBorrado, setLoadingBorrado] = useState(false);

  // Inicializa Firebase Functions
  const functions = getFunctions(app);
  const fnCrearCarrera = httpsCallable<
    { titulo: string; descripcion: string; ubicacion: string; fecha: string; imagenUrl: string; price: number },
    any
  >(functions, "crearCarrera");

  const fnBorrarInscripciones = httpsCallable<
    { carreraId: string },
    { eliminado: number }
  >(functions, "borrarInscripcionesDeCarrera");

  // Carga inicial de carreras desde Firestore
  useEffect(() => {
    (async () => {
      const snapshot = await getDocs(collection(db, "carreras"));
      const lista: Carrera[] = snapshot.docs.map(doc => ({
        id: doc.id,
        // Asegúrate de que cada doc tenga el campo 'titulo'
        titulo: (doc.data() as any).titulo || "Sin título",
      }));
      setCarreras(lista);
    })();
  }, []);

  // Función para crear una nueva carrera
  const handleCrearCarrera = async () => {
    try {
      await fnCrearCarrera({
        titulo,
        descripcion,
        ubicacion,
        fecha,
        imagenUrl,
        price: parseFloat(price) || 0,
      });
      setMensaje("Carrera creada exitosamente.");
      // Refresca listado de carreras
      const snapshot = await getDocs(collection(db, "carreras"));
      const lista: Carrera[] = snapshot.docs.map(doc => ({
        id: doc.id,
        titulo: (doc.data() as any).titulo || "Sin título",
      }));
      setCarreras(lista);
    } catch (error) {
      console.error(error);
      setMensaje("Error al crear la carrera.");
    }
  };

  // Función para borrar inscripciones de una carrera
  const onBorrarInscripciones = async (carreraId: string) => {
    if (!confirm('¿Seguro que quieres borrar todas las inscripciones de esta carrera?')) return;
    setLoadingBorrado(true);
    try {
      const { data } = await fnBorrarInscripciones({ carreraId });
      alert(`Se borraron ${data.eliminado} inscripciones.`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error borrando inscripciones');
    } finally {
      setLoadingBorrado(false);
    }
  };

  return (
    <Layout title="Admin – Carreras">
      <div className="space-y-8 p-6">
        {/* Formulario de creación */}
        <section className="bg-white p-6 rounded shadow">
          <h2 className="text-2xl font-semibold mb-4">Crear Carrera</h2>
          <div className="space-y-2">
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Título"
              className="w-full p-2 border rounded"
            />
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción"
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value)}
              placeholder="Ubicación"
              className="w-full p-2 border rounded"
            />
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <input
              type="text"
              value={imagenUrl}
              onChange={e => setImagenUrl(e.target.value)}
              placeholder="URL de la imagen"
              className="w-full p-2 border rounded"
            />
            <input
              type="number"
              value={price}
              onChange={e => setPrecio(e.target.value)}
              placeholder="Precio (MXN)"
              step="0.01"
              className="w-full p-2 border rounded"
            />
            <button
              onClick={handleCrearCarrera}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Crear Carrera
            </button>
            {mensaje && <p className="mt-2 text-sm text-gray-700">{mensaje}</p>}
          </div>
        </section>

        {/* Gestión de inscripciones */}
        <section className="bg-white p-6 rounded shadow">
          <h2 className="text-2xl font-semibold mb-4">Gestión de Inscripciones</h2>
          <div className="space-y-2">
            {carreras.length === 0 && <p className="text-gray-500">No hay carreras registradas.</p>}
            {carreras.map(c => (
              <div key={c.id} className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">{c.titulo}</span>
                <button
                  onClick={() => onBorrarInscripciones(c.id)}
                  disabled={loadingBorrado}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {loadingBorrado ? 'Borrando...' : 'Borrar inscripciones'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
