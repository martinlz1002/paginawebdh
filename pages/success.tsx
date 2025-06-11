import Link from "next/link";

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-softGreen text-white px-4">
      <h1 className="text-3xl font-bold mb-4">¡Pago exitoso!</h1>
      <p className="text-lg mb-6 text-center">
        Tu inscripción ha sido completada correctamente. ¡Gracias por participar!
      </p>
      <Link href="/">
        <span className="bg-white text-softGreen px-6 py-2 rounded-xl font-semibold shadow hover:scale-105 transition">
          Volver al inicio
        </span>
      </Link>
    </div>
  );
}
