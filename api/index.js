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
