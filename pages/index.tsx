import CarreraCard from '../components/carreracard'

export default function Home() {
  return (
    <div className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2">
      <CarreraCard
        nombre="Carrera 10K Ciudad"
        fecha="2025-07-15"
        lugar="Parque Central"
        descripcion="Una carrera para toda la familia con medallas para todos los finalistas."
      />
    </div>
  );
}