import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/router";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function Pago() {
  const router = useRouter();
  const ran = useRef(false);

  const [msg, setMsg] = useState("Preparando pago...");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      const {
        carreraId,
        perfilId,
        categoria,
        distancia,
        ruta,
        inscripcionId,
      } = router.query;

      // 👉 distancia puede venir como distancia o como ruta (legacy)
      const dist =
        (typeof distancia === "string" && distancia) ||
        (typeof ruta === "string" && ruta) ||
        "";

      // 👉 reintento si viene inscripcionId
      const isRetryOnly =
        typeof inscripcionId === "string" && inscripcionId.trim().length > 0;

      if (!isRetryOnly) {
        if (
          typeof carreraId !== "string" ||
          typeof perfilId !== "string" ||
          typeof categoria !== "string" ||
          !dist
        ) {
          setMsg("Faltan datos para el pago. Regresando…");
          setTimeout(() => router.replace("/"), 1200);
          return;
        }
      }

      try {
        setMsg("Redirigiendo a Stripe…");

        /* =======================
           🔁 REINTENTO DE PAGO
           ======================= */
        if (isRetryOnly) {
          const res = await fetch("/api/retry_checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inscripcionId }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

          if (data?.url) {
            setCheckoutUrl(data.url);
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

        /* =======================
           🆕 PAGO NUEVO
           ======================= */
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
          setCheckoutUrl(data.url);
          window.location.href = data.url;
          return;
        }

        if (data?.sessionId) {
          const stripe = await stripePromise;
          await stripe?.redirectToCheckout({ sessionId: data.sessionId });
          return;
        }

        throw new Error("Respuesta inválida desde el servidor.");
      } catch (e) {
        console.error(e);
        setMsg("No se pudo iniciar el pago.");

        const backCarreraId =
          typeof carreraId === "string" ? carreraId : "";

        setTimeout(() => {
          router.replace(
            backCarreraId
              ? `/inscribirse?carreraId=${backCarreraId}`
              : "/"
          );
        }, 2500);
      }
    };

    run();
  }, [router.isReady, router.query, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xl font-semibold text-dh-ink">{msg}</p>

      {checkoutUrl && (
        <a
          href={checkoutUrl}
          className="mt-2 rounded-xl bg-dh-purple px-6 py-3 text-white font-semibold shadow-dh hover:opacity-95 transition"
        >
          Continuar al pago
        </a>
      )}

      <p className="text-sm text-dh-muted max-w-md">
        Si tu navegador bloqueó la redirección automática, toca el botón para
        continuar con el pago de forma segura.
      </p>
    </div>
  );
}
