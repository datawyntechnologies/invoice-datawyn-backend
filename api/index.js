import app from '../src/app.js'
import { connectDB } from '../src/config/db.js'

// Cache database connection in serverless environment
let isConnected = false

const connectToDatabase = async () => {
  if (isConnected) {
    console.log('Using existing database connection')
    return
  }

  try {
    await connectDB()
    isConnected = true
    console.log('New database connection established')
  } catch (error) {
    console.error('Failed to connect to database:', error)
    throw error
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Set CORS headers for all requests
  const origin = req.headers.origin
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'https://invoice-datawyntechnologies.vercel.app',
    'https://invoice-datawyntechnologies-three.vercel.app',
    'https://invoice.datawyntechnologies.com'
  ]
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400')
    return res.status(204).end()
  }

  // Connect to database (with caching for serverless)
  await connectToDatabase()
  
  // Handle the request with Express app
  return new Promise((resolve, reject) => {
    app(req, res, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
