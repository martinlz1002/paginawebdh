import Head from "next/head";
import { useRouter } from "next/router";

export default function MercadoPagoVinculado() {
  const router = useRouter();

  const estado =
    typeof router.query.estado === "string"
      ? router.query.estado
      : "";

  const conectado = estado === "connected";

  if (!router.isReady) {
    return null;
  }

  return (
    <>
      <Head>
        <title>
          Vinculación Mercado Pago | DHTime
        </title>
      </Head>

      <main className="min-h-screen flex items-center justify-center bg-[#111116] px-5">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1b1b23] p-8 text-center shadow-xl">

          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
              conectado
                ? "bg-green-500/10 text-green-400"
                : "bg-yellow-500/10 text-yellow-400"
            }`}
          >
            {conectado ? "✓" : "!"}
          </div>

          <h1 className="text-2xl font-extrabold text-white">
            {conectado
              ? "¡Cuenta vinculada!"
              : "No se pudo completar"}
          </h1>

          <p className="mt-4 text-sm leading-6 text-white/60">
            {conectado
              ? "Tu cuenta de Mercado Pago se vinculó correctamente con DHTime. Ya puedes avisar al equipo de DHTime que terminaste el proceso."
              : "No se pudo completar la vinculación de Mercado Pago. Contacta al equipo de DHTime para recibir un nuevo enlace."}
          </p>

          <p className="mt-6 text-xs text-white/30">
            DHTime · Sistema de cronometraje deportivo
          </p>

        </div>
      </main>
    </>
  );
}