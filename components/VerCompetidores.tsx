// /components/VerCompetidores.tsx
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const VerCompetidores = () => {
  const [carreras, setCarreras] = useState<any[]>([]);
  const [competidores, setCompetidores] = useState<any[]>([]);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState<string>('');

  useEffect(() => {
    const fetchCarreras = async () => {
      const q = query(collection(db, 'carreras'));
      const querySnapshot = await getDocs(q);
      const carrerasData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCarreras(carrerasData);
    };
    fetchCarreras();
  }, []);

  const handleCarreraSeleccionada = async (id: string) => {
    setCarreraSeleccionada(id);
    const q = query(collection(db, 'inscripciones'), where('carreraId', '==', id));
    const querySnapshot = await getDocs(q);
    const competidoresData = querySnapshot.docs.map((doc) => doc.data());
    setCompetidores(competidoresData);
  };

  return (
    <div>
      <select onChange={(e) => handleCarreraSeleccionada(e.target.value)} value={carreraSeleccionada}>
        <option value="">Seleccionar carrera</option>
        {carreras.map((carrera) => (
          <option key={carrera.id} value={carrera.id}>
            {carrera.titulo}
          </option>
        ))}
      </select>

      {competidores.length > 0 && (
        <div>
          <h3>Competidores Inscritos</h3>
          <ul>
            {competidores.map((competidor, index) => (
              <li key={index}>
                {competidor.nombre} {competidor.apellidoPaterno} {competidor.apellidoMaterno}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default VerCompetidores;