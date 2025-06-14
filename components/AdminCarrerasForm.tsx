// /components/AdminCarrerasForm.tsx
import { useState } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const AdminCarrerasForm = () => {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fecha, setFecha] = useState('');
  const [imagen, setImagen] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imagen) {
      const imageRef = ref(storage, `carreras/${imagen.name}`);
      await uploadBytes(imageRef, imagen);
      const imageUrl = await getDownloadURL(imageRef);

      await addDoc(collection(db, 'carreras'), {
        titulo,
        descripcion,
        ubicacion,
        fecha: new Date(fecha),
        imageUrl,
      });

      setTitulo('');
      setDescripcion('');
      setUbicacion('');
      setFecha('');
      setImagen(null);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Título de la carrera"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        required
      />
      <textarea
        placeholder="Descripción"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Ubicación"
        value={ubicacion}
        onChange={(e) => setUbicacion(e.target.value)}
        required
      />
      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        required
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImagen(e.target.files?.[0] ?? null)}
      />
      <button type="submit">Crear Carrera</button>
    </form>
  );
};

export default AdminCarrerasForm;