import app from './app.js'
import { connectDB } from './config/db.js'
import { config } from './config/env.js'

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
