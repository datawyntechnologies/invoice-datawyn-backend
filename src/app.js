import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorMiddleware.js'
import upload from './config/multer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Routes
import authRoutes from './routes/authRoutes.js'
import customerRoutes from './routes/customerRoutes.js'
import productRoutes from './routes/productRoutes.js'
import proformaRoutes from './routes/proformaRoutes.js'
import invoiceRoutes from './routes/invoiceRoutes.js'
import proposalRoutes from './routes/proposalRoutes.js'
import companyRoutes from './routes/companyRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import userRoutes from './routes/userRoutes.js'
import roleRoutes from './routes/roleRoutes.js'
import permissionRoutes from './routes/permissionRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'

const app = express()

// CORS configuration (must be before other middleware)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    // Always allow the specific frontend domain
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      'https://invoice-datawyntechnologies.vercel.app',
      'https://invoice.datawyntechnologies.com'
    ]
    
    // Also add any origins from config
    if (config.clientUrl && config.clientUrl.length > 0) {
      config.clientUrl.forEach(url => {
        if (!allowedOrigins.includes(url)) {
          allowedOrigins.push(url)
        }
      })
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.log('CORS blocked origin:', origin)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}))

// Handle OPTIONS requests explicitly for preflight
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.sendStatus(204)
})

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
})
app.use('/api/auth/', limiter)

// Body parser
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files from uploads directory (only for local development)
if (!config.isVercel) {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
}

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/products', productRoutes)
app.use('/api/proforma', proformaRoutes)
app.use('/api/invoices', invoiceRoutes)
app.use('/api/proposals', proposalRoutes)
app.use('/api/company', companyRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users', userRoutes)
app.use('/api/roles', roleRoutes)
app.use('/api/permissions', permissionRoutes)
app.use('/api/payments', paymentRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

// Error handling
app.use(notFound)
app.use(errorHandler)

export default app
export { upload }
