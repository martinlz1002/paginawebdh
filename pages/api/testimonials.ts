import type { NextApiRequest, NextApiResponse } from 'next'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Inicializa Admin SDK una sola vez
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  })
}
const dbAdmin = getFirestore()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const snap = await dbAdmin.collection('testimonios')
      .orderBy('timestamp', 'desc')
      .get()
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data()) }))
    return res.status(200).json(items)
  }
  if (req.method === 'POST') {
    const { author, text, avatarUrl } = req.body
    if (!req.headers.authorization?.startsWith('Bearer '))
      return res.status(401).end('Sin autorización')
    // Aquí podrías verificar el token con Admin SDK si quieres
    await dbAdmin.collection('testimonios').add({
      author,
      text,
      avatarUrl: avatarUrl || null,
      timestamp: Date.now(),
    })
    return res.status(201).end()
  }
  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}