import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/router";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Pago() {
  const router = useRouter();
  const ran = useRef(false);
  const [msg, setMsg] = useState("Preparando pago...");

  useEffect(() => {
    if (!router.isReady) return;
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      // ✅ Ahora pedimos distancia y NO price
      const { carreraId, perfilId, categoria, distancia, ruta, inscripcionId } = router.query;

      // ✅ Validación mínima
      // - pago “nuevo”: requiere carreraId + perfilId + categoria + distancia
      // - pago “reintento”: lo ideal es pasar inscripcionId y ya (pero dejamos ambos caminos)
      const dist = (typeof distancia === "string" ? distancia : "") || (typeof ruta === "string" ? ruta : "");

      const isRetryOnly = typeof inscripcionId === "string" && inscripcionId.trim().length > 0;

      if (!isRetryOnly) {
        if (
          typeof carreraId !== "string" ||
          typeof perfilId !== "string" ||
          typeof categoria !== "string" ||
          typeof dist !== "string" ||
          !dist
        ) {
          setMsg("Faltan datos para el pago. Regresando…");
          setTimeout(() => router.replace("/"), 900);
          return;
        }
      }

      try {
        setMsg("Redirigiendo a Stripe...");

        // ✅ Si viene inscripcionId, usa el endpoint de reintento
        if (isRetryOnly) {
          const res = await fetch("/api/retry_checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inscripcionId }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

          if (data?.url) {
            window.location.href = data.url;
            return;
          }
          if (data?.sessionId) {
            const stripe = await stripePromise;
            await stripe?.redirectToCheckout({ sessionId: data.sessionId });
            return;
          }
          throw new Error("Respuesta inválida desde el servidor.");
        }

        // ✅ Pago nuevo: usa checkout_sessions pero sin price (el server calcula)
        const res = await fetch("/api/checkout_sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carreraId,
            perfilId,
            categoria,
            distancia: dist,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        if (data?.url) {
          window.location.href = data.url;
          return;
        }
        if (data?.sessionId) {
          const stripe = await stripePromise;
          await stripe?.redirectToCheckout({ sessionId: data.sessionId });
          return;
        }

        throw new Error("Respuesta inválida desde el servidor.");
      } catch (e: any) {
        console.error(e);
        setMsg("Error iniciando pago. Regresando…");
        const backCarreraId = typeof carreraId === "string" ? carreraId : "";
        setTimeout(() => router.replace(backCarreraId ? `/inscribirse?carreraId=${backCarreraId}` : "/"), 1200);
      }
    };

    run();
  }, [router.isReady, router.query, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-xl text-gray-700">{msg}</p>
    </div>
  );
}