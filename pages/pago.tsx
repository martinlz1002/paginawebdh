import { useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/router";

export default function Pago() {
  const router = useRouter();

  const handleCheckout = async () => {
    const res = await fetch("/api/create-checkout-session", { method: "POST" });
    const data = await res.json();

    if (data.id) {
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      await stripe?.redirectToCheckout({ sessionId: data.id });
    } else {
      alert("Error iniciando pago");
    }
  };

  useEffect(() => {
    handleCheckout();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-xl text-gray-700">Redirigiendo al pago...</p>
    </div>
  );
}
