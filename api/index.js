import app from '../src/app.js'
import { connectDB } from '../src/config/db.js'

// Vercel serverless function handler
export default async function handler(req, res) {
  // Connect to database for each request (serverless environment)
  await connectDB()
  
  // Handle the request with Express app
  app(req, res)
}
