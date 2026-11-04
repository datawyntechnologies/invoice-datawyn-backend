import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['static', 'dynamic'],
    default: 'static',
  },
  description: {
    type: String,
  },
  priceRanges: {
    basic: {
      type: Number,
      required: function() {
        return this.priceRanges !== undefined
      },
      min: [0, 'Basic price cannot be negative'],
    },
    standard: {
      type: Number,
      required: function() {
        return this.priceRanges !== undefined
      },
      min: [0, 'Standard price cannot be negative'],
    },
    premium: {
      type: Number,
      required: function() {
        return this.priceRanges !== undefined
      },
      min: [0, 'Premium price cannot be negative'],
    },
    custom: {
      type: Number,
      min: [0, 'Custom price cannot be negative'],
    }
  },
  // Keep legacy price field for backward compatibility (defaults to standard price)
  price: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
})

// Generate product code before saving
productSchema.pre('save', async function(next) {
  if (!this.code) {
    const count = await mongoose.model('Product').countDocuments()
    const year = new Date().getFullYear()
    const paddedNumber = String(count + 1).padStart(4, '0')
    this.code = `PROD-${year}-${paddedNumber}`
  }
  
  // Handle priceRanges backward compatibility
  if (this.priceRanges && this.priceRanges.standard) {
    this.price = this.priceRanges.standard
  } else if (!this.priceRanges && this.price) {
    // If priceRanges is not set but price is, create priceRanges from price
    this.priceRanges = {
      basic: this.price,
      standard: this.price,
      premium: this.price
    }
  }
  
  next()
})

// Indexes
productSchema.index({ name: 'text' })
productSchema.index({ status: 1 })
productSchema.index({ createdBy: 1 })

const Product = mongoose.model('Product', productSchema)

export default Product
