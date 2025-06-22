import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { carreraId, perfilId, categoria, precio } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `Inscripción Carrera ${carreraId} – ${categoria}`,
            metadata: { carreraId, perfilId, categoria },
          },
          unit_amount: Math.round(precio * 100), // MXN centavos
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/inscribirse?carreraId=${carreraId}&success=true`,
      cancel_url: `${req.headers.origin}/inscribirse?carreraId=${carreraId}&canceled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}