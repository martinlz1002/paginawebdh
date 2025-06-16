import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
}

export default function AdminCarrerasForm() {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaSalida, setHoraSalida] = useState("");
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([
    { nombre: "", minAge: 0, maxAge: 0 },
  ]);
  const [mensaje, setMensaje] = useState("");

  const handleAgregarCategoria = () => {
    setCategorias([...categorias, { nombre: "", minAge: 0, maxAge: 0 }]);
  };

  const handleEliminarCategoria = (index: number) => {
    setCategorias(categorias.filter((_, i) => i !== index));
  };

  const handleCategoriaChange = (
    index: number,
    field: keyof Categoria,
    value: string | number
  ) => {
    const nueva = [...categorias];
    // @ts-ignore
    nueva[index][field] = value;
    setCategorias(nueva);
  };

  const handleCrearCarrera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagenArchivo) {
      setMensaje("Selecciona una imagen.");
      return;
    }
    try {
      // Leer imagen como base64
      const reader = new FileReader();
      reader.readAsDataURL(imagenArchivo);
      await new Promise((res, rej) => {
        reader.onloadend = res;
        reader.onerror = rej;
      });
      const base64str = reader.result as string;
      const imagenBase64 = base64str.split(",")[1];
      const nombreArchivo = imagenArchivo.name;

      const functions = getFunctions(app);
      const crearCarrera = httpsCallable(functions, "crearCarrera");

      await crearCarrera({
        titulo,
        descripcion,
        ubicacion,
        fecha,
        horaSalida,
        imagenBase64,
        nombreArchivo,
        categorias,
      });

      setMensaje("Carrera creada exitosamente.");
      // limpiar
      setTitulo("");
      setDescripcion("");
      setUbicacion("");
      setFecha("");
      setHoraSalida("");
      setImagenArchivo(null);
      setCategorias([{ nombre: "", minAge: 0, maxAge: 0 }]);
    } catch (error: any) {
      console.error("Error creando carrera:", error);
      setMensaje("Error creando carrera: " + (error.message || error));
    }
  };

  return (
    <form onSubmit={handleCrearCarrera} className="space-y-6">
      <div>
        <label className="block text-sm font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Ubicación</label>
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Hora de salida</label>
          <input
            type="time"
            value={horaSalida}
            onChange={(e) => setHoraSalida(e.target.value)}
            required
            className="mt-1 block w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Imagen</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImagenArchivo(e.target.files?.[0] || null)}
            required
            className="mt-1 block w-full"
          />
        </div>
      </div>

      {/* Categorías dinámicas */}
      <div>
        <h3 className="font-semibold mb-2">Categorías</h3>
        {categorias.map((cat, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 items-end mb-2">
            <div className="col-span-2">
              <label className="block text-sm">Nombre</label>
              <input
                type="text"
                value={cat.nombre}
                onChange={(e) =>
                  handleCategoriaChange(i, "nombre", e.target.value)
                }
                required
                className="mt-1 block w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm">Edad min.</label>
              <input
                type="number"
                value={cat.minAge}
                onChange={(e) =>
                  handleCategoriaChange(i, "minAge", +e.target.value)
                }
                min={0}
                className="mt-1 block w-full border p-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm">Edad max.</label>
              <input
                type="number"
                value={cat.maxAge}
                onChange={(e) =>
                  handleCategoriaChange(i, "maxAge", +e.target.value)
                }
                min={0}
                className="mt-1 block w-full border p-2 rounded"
              />
            </div>
            <button
              type="button"
              onClick={() => handleEliminarCategoria(i)}
              className="text-red-600 hover:underline ml-2"
            >
              Eliminar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAgregarCategoria}
          className="text-blue-600 hover:underline"
        >
          + Agregar categoría
        </button>
      </div>

      <button
        type="submit"
        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
      >
        Crear Carrera
      </button>

      {mensaje && (
        <p className="mt-4 text-center text-sm text-green-600">{mensaje}</p>
      )}
    </form>
  );
}