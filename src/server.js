import app from './app.js'
import { connectDB } from './config/db.js'
import { config } from './config/env.js'

// Cache database connection for serverless environment
let isConnected = false

const connectToDatabase = async () => {
  if (isConnected) {
    return
  }

  try {
    await connectDB()
    isConnected = true
  } catch (error) {
    console.error('Failed to connect to database:', error)
    throw error
  }
}

// Start server only if not in Vercel environment
if (!config.isVercel) {
  const startServer = async () => {
    try {
      // Connect to MongoDB
      await connectDB()

      // Start server
      const PORT = config.port
      app.listen(PORT, () => {
        console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`)
        console.log(`API: http://localhost:${PORT}/api`)
      })
    } catch (error) {
      console.error('Failed to start server:', error)
      process.exit(1)
    }
  }

  startServer()
}

// Export for Vercel serverless
export default async function handler(req, res) {
  await connectToDatabase()
  // Express app needs to handle the request properly
  return new Promise((resolve, reject) => {
    app(req, res, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}
