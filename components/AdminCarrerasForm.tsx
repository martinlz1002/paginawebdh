// components/AdminCarrerasForm.tsx
import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

export interface CarreraData {
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  imagenUrl?: string;
  categorias: { nombre: string; minAge: number; maxAge: number }[];
  horaSalida?: string;
}

interface Props {
  initialValues?: CarreraData & { id: string };
  onSuccess?: () => void;
}

export default function AdminCarrerasForm({ initialValues, onSuccess }: Props) {
  const [values, setValues] = useState<CarreraData>({
    titulo: "",
    descripcion: "",
    ubicacion: "",
    fecha: "",
    horaSalida: "",
    imagenUrl: "",
    categorias: [],
  });
  const [imagenArchivo, setImagenArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState("");

  // Para añadir categorías dinámicamente
  const [nuevaCat, setNuevaCat] = useState({ nombre: "", minAge: "", maxAge: "" });

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Si hay imagen nueva, la convertimos a base64
      let imagenBase64 = "";
      if (imagenArchivo) {
        const reader = new FileReader();
        reader.readAsDataURL(imagenArchivo);
        await new Promise((r, rj) => {
          reader.onloadend = r as any;
          reader.onerror = rj as any;
        });
        imagenBase64 = (reader.result as string).split(",")[1];
      }

      const fn = getFunctions(app);
      const fnCall = httpsCallable(fn, "crearCarrera");
      const payload = {
        ...values,
        categorias: values.categorias,
        ...(imagenBase64 && { imagenBase64, nombreArchivo: imagenArchivo!.name }),
        ...(initialValues && { id: initialValues.id }),
      };
      await fnCall(payload);
      setMensaje("Operación exitosa");
      onSuccess?.();
      if (!initialValues) {
        // reset si creamos nuevo
        setValues({
          titulo: "",
          descripcion: "",
          ubicacion: "",
          fecha: "",
          horaSalida: "",
          imagenUrl: "",
          categorias: [],
        });
        setImagenArchivo(null);
      }
    } catch (err: any) {
      setMensaje("Error: " + err.message);
    }
  };

  const addCategoria = () => {
    if (!nuevaCat.nombre || !nuevaCat.minAge || !nuevaCat.maxAge) return;
    setValues((v) => ({
      ...v,
      categorias: [
        ...v.categorias,
        {
          nombre: nuevaCat.nombre,
          minAge: Number(nuevaCat.minAge),
          maxAge: Number(nuevaCat.maxAge),
        },
      ],
    }));
    setNuevaCat({ nombre: "", minAge: "", maxAge: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block">Título</label>
        <input
          value={values.titulo}
          onChange={(e) => setValues(v => ({ ...v, titulo: e.target.value }))}
          className="mt-1 w-full border p-2 rounded"
          required
        />
      </div>
      {/* ... otros campos: descripcion, ubicacion, fecha, horaSalida ... */}
      <div>
        <label className="block">Hora de salida</label>
        <input
          type="time"
          value={values.horaSalida}
          onChange={(e) => setValues(v => ({ ...v, horaSalida: e.target.value }))}
          className="mt-1 border p-2 rounded"
        />
      </div>
      {/* Imagen */}
      <div>
        <label className="block">Imagen</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImagenArchivo(e.target.files?.[0] || null)}
          className="mt-1"
        />
      </div>
      {/* Categorías dinámicas */}
      <div className="border p-3 rounded space-y-2">
        <h3 className="font-semibold">Categorías</h3>
        {values.categorias.map((c, i) => (
          <p key={i}>{c.nombre} ({c.minAge}-{c.maxAge} años)</p>
        ))}
        <div className="flex gap-2">
          <input
            placeholder="Nombre"
            value={nuevaCat.nombre}
            onChange={e => setNuevaCat(n => ({ ...n, nombre: e.target.value }))}
            className="border p-1 rounded"
          />
          <input
            placeholder="Min"
            type="number"
            value={nuevaCat.minAge}
            onChange={e => setNuevaCat(n => ({ ...n, minAge: e.target.value }))}
            className="border p-1 w-16 rounded"
          />
          <input
            placeholder="Max"
            type="number"
            value={nuevaCat.maxAge}
            onChange={e => setNuevaCat(n => ({ ...n, maxAge: e.target.value }))}
            className="border p-1 w-16 rounded"
          />
          <button type="button" onClick={addCategoria} className="bg-gray-200 px-2 rounded">
            +
          </button>
        </div>
      </div>
      <button type="submit" className="bg-green-600 text-white py-2 px-4 rounded">
        {initialValues ? "Actualizar" : "Crear"} Carrera
      </button>
      {mensaje && <p className="mt-2 text-sm">{mensaje}</p>}
    </form>
  );
}