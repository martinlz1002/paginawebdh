import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-11-15',
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const { carreraId, perfilId, categoria, precio } = req.body

    if (!carreraId || !perfilId || !categoria || typeof precio !== 'number') {
      return res
        .status(400)
        .json({ error: 'Faltan parámetros obligatorios' })
    }

    // crea un Checkout Session de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Inscripción: ${categoria}`,
              metadata: { carreraId, perfilId, categoria },
            },
            unit_amount: Math.round(precio * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/inscripcion-exitosa?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/inscripcion-cancelada`,
    })

    res.status(200).json({ sessionId: session.id })
  } catch (err: any) {
    console.error('Stripe error:', err)
    res.status(500).json({ error: err.message })
  }
}