import { TrophyIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { motion } from "framer-motion";

interface CarreraResultado {
  id: string;
  titulo: string;
  fecha: string;
  resultados?: {
    url?: string;
    publicado?: boolean;
  };
}

export default function ResultadosRecientes({
  carreras,
}: {
  carreras: CarreraResultado[];
}) {
  const resultados = carreras.filter(
    (c) => c.resultados?.publicado && c.resultados?.url
  );

  if (resultados.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="relative w-full"
    >
      {/* Contenedor oscuro glass */}
      <div className="relative backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-10 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

        {/* Glow sutil */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-dh-green/20 blur-3xl opacity-40" />

        <div className="relative z-10">

          <h3 className="text-3xl font-black text-white flex items-center gap-3 mb-8">
            <TrophyIcon className="w-7 h-7 text-dh-green" />
            Resultados recientes
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            {resultados.slice(0, 4).map((r, i) => (
              <motion.a
                key={r.id}
                href={r.resultados!.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                viewport={{ once: true }}
                className="group relative p-6 rounded-2xl border border-white/10 bg-black/40 hover:bg-black/60 transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="text-white font-bold text-lg leading-tight line-clamp-2">
                      {r.titulo}
                    </p>
                    <p className="text-sm text-white/50 mt-1">
                      {r.fecha}
                    </p>
                  </div>

                  <ArrowTopRightOnSquareIcon className="w-5 h-5 text-dh-green opacity-70 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
                </div>

                {/* Línea glow inferior */}
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-dh-purple to-dh-green group-hover:w-full transition-all duration-500 rounded-full" />
              </motion.a>
            ))}
          </div>

        </div>
      </div>
    </motion.section>
  );
}
