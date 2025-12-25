import Image from "next/image";

export default function HeroBanner() {
  return (
    <section className="relative h-96 bg-gradient-to-r from-purple-800 via-purple-700 to-green-600 text-white flex items-center overflow-hidden">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center">
        {/* Texto */}
        <div className="md:w-1/2 space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold">
            Bienvenido al mundo donde{" "}
            <span className="text-green-300">cada segundo</span> cuenta
          </h1>
          <p className="text-lg md:text-xl text-white/90">
            Únete a nuestra comunidad de corredoras y corredores.
            Corre, vive, siente el pulso.
          </p>
        </div>

        {/* Imagen atleta */}
        <div className="md:w-1/2 mt-6 md:mt-0 flex justify-center">
          <Image
            src="/Corredor.png"
            alt="Corredor"
            width={400}
            height={400}
            className="object-contain drop-shadow-xl"
          />
        </div>
      </div>

      {/* overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/30 pointer-events-none" />
    </section>
  );
}