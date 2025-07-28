interface Photo {
  id: string;
  src: string;
  alt?: string;
}

export default function Gallery({ photos }: { photos: Photo[] }) {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Galería de Emociones</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl shadow-lg">
            <img src={p.src} alt={p.alt || ""} className="w-full h-56 object-cover transition-transform hover:scale-105" />
          </div>
        ))}
      </div>
    </section>
  );
}