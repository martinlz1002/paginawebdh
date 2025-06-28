import Stripe from "stripe";

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion: "2025-05-28.basil", // deja que Stripe use tu versión por defecto (2025-05-28.basil)
  }
);