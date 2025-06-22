import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, carreraId } = req.body;
  // Opcional: leer precio desde Firestore
  const carreraSnap = await getDoc(doc(db, 'carreras', carreraId));
  if (!carreraSnap.exists()) return res.status(404).json({ error: 'Carrera no encontrada' });
  const data = carreraSnap.data() as any;
  const amount = Math.round((data.precio || 0) * 100); // en centavos

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: data.titulo,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/mis-inscripciones?pagado=true`,
      cancel_url: `${req.headers.origin}/inscribirse?carreraId=${carreraId}&cancelado=true`,
      metadata: { userId, carreraId },
    });
    res.status(200).json({ id: session.id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}