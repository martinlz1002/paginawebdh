import { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

export interface CarreraData {
  id?: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  hora: string;
  categorias: { nombre: string; minAge: number; maxAge: number }[];
}

interface Props {
  initialValues?: CarreraData;
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({
  initialValues,
  onSuccess = () => {},
}: Props) {
  // Form state
  const [titulo, setTitulo] = useState(initialValues?.titulo || "");
  const [descripcion, setDescripcion] = useState(initialValues?.descripcion || "");
  const [ubicacion, setUbicacion] = useState(initialValues?.ubicacion || "");
  const [fecha, setFecha] = useState(initialValues?.fecha || "");
  const [hora, setHora] = useState(initialValues?.hora || "");
  const [categorias, setCategorias] = useState(initialValues?.categorias || [
    { nombre: "", minAge: 0, maxAge: 99 },
  ]);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState("");

  // Si cambian las initialValues, recarga el formulario
  useEffect(() => {
    if (initialValues) {
      setTitulo(initialValues.titulo);
      setDescripcion(initialValues.descripcion);
      setUbicacion(initialValues.ubicacion);
      setFecha(initialValues.fecha);
      setHora(initialValues.hora);
      setCategorias(initialValues.categorias);
    }
  }, [initialValues]);

  const handleCategoriaChange = (idx: number, key: keyof typeof categorias[0], value: any) => {
    const c = [...categorias];
    c[idx] = { ...c[idx], [key]: value };
    setCategorias(c);
  };
  const addCategoria = () =>
    setCategorias((cats) => [...cats, { nombre: "", minAge: 0, maxAge: 99 }]);
  const removeCategoria = (idx: number) =>
    setCategorias((cats) => cats.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMensaje("");

    // convierte imagen a base64
    let imagenBase64 = "";
    let nombreArchivo = "";
    if (imagenFile) {
      nombreArchivo = imagenFile.name;
      const reader = new FileReader();
      reader.readAsDataURL(imagenFile);
      await new Promise((res, rej) => {
        reader.onloadend = res; reader.onerror = rej;
      });
      imagenBase64 = (reader.result as string).split(",")[1];
    }

    try {
      const functions = getFunctions(app);
      const fnName = initialValues?.id ? "editarCarrera" : "crearCarrera";
      const fn = httpsCallable(functions, fnName);

      await fn({
        id: initialValues?.id,
        titulo,
        descripcion,
        ubicacion,
        fecha,
        hora,
        categorias,
        imagenBase64,
        nombreArchivo,
      });

      setMensaje("Carrera guardada exitosamente");
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setMensaje("Error al guardar la carrera: " + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Campos básicos */}
      <div>
        <label className="block">Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} required className="w-full border p-2 rounded" />
      </div>
      <div>
        <label className="block">Descripción</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} required className="w-full border p-2 rounded" />
      </div>
      <div>
        <label className="block">Ubicación</label>
        <input value={ubicacion} onChange={e => setUbicacion(e.target.value)} required className="w-full border p-2 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block">Hora de salida</label>
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} required className="w-full border p-2 rounded" />
        </div>
      </div>

      {/* Imagen local */}
      <div>
        <label className="block">Imagen (opcional)</label>
        <input type="file" accept="image/*" onChange={e => setImagenFile(e.target.files?.[0] || null)} className="w-full" />
      </div>

      {/* Categorías dinámicas */}
      <div>
        <h3 className="font-semibold">Categorías</h3>
        {categorias.map((cat, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 items-end mb-2">
            <div>
              <label>Nombre</label>
              <input
                value={cat.nombre}
                onChange={e => handleCategoriaChange(i, "nombre", e.target.value)}
                required
                className="border p-1 rounded w-full"
              />
            </div>
            <div>
              <label>Edad min</label>
              <input
                type="number"
                value={cat.minAge}
                onChange={e => handleCategoriaChange(i, "minAge", +e.target.value)}
                required
                className="border p-1 rounded w-full"
              />
            </div>
            <div>
              <label>Edad max</label>
              <input
                type="number"
                value={cat.maxAge}
                onChange={e => handleCategoriaChange(i, "maxAge", +e.target.value)}
                required
                className="border p-1 rounded w-full"
              />
            </div>
            <button type="button" onClick={() => removeCategoria(i)} className="text-red-600">
              Eliminar
            </button>
          </div>
        ))}
        <button type="button" onClick={addCategoria} className="text-blue-600 hover:underline">
          + Agregar categoría
        </button>
      </div>

      <button type="submit" className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700">
        {initialValues?.id ? "Actualizar Carrera" : "Crear Carrera"}
      </button>
      {mensaje && <p className="mt-2 text-sm text-red-600">{mensaje}</p>}
    </form>
  );
}