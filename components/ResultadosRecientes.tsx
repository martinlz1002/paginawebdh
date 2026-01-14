import { TrophyIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

interface CarreraResultado {
  id: string;
  titulo: string;
  fecha: string;
  resultados?: {
    url?: string;
    publicado?: boolean;
  };
}

export default function ResultadosRecientes({ carreras }: { carreras: CarreraResultado[] }) {
  const resultados = carreras.filter(
    c => c.resultados?.publicado && c.resultados?.url
  );

  if (resultados.length === 0) return null;

  return (
    <div className="rounded-2xl border border-dh-purple/10 bg-white shadow-dh p-5 space-y-4">
      <h3 className="text-lg font-extrabold text-dh-ink flex items-center gap-2">
        <TrophyIcon className="w-5 h-5 text-dh-green" />
        Resultados recientes
      </h3>

      <ul className="space-y-3">
        {resultados.slice(0, 4).map(r => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-dh-purple/10 p-3 hover:bg-dh-soft transition"
          >
            <div>
              <p className="font-semibold text-dh-ink leading-tight line-clamp-1">
                {r.titulo}
              </p>
              <p className="text-xs text-gray-500">{r.fecha}</p>
            </div>

            <a
              href={r.resultados!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-extrabold text-dh-green hover:underline"
            >
              Ver
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
