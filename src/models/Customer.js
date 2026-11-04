import mongoose from 'mongoose'

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  stateCode: String,
  country: { type: String, default: 'India' },
  pincode: String,
}, { _id: false })

const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    unique: true,
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
  },
  contactPerson: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  phone: {
    type: String,
    trim: true,
  },
  alternatePhone: {
    type: String,
    trim: true,
  },
  billingAddress: {
    type: addressSchema,
    default: {},
  },
  shippingAddress: {
    type: addressSchema,
    default: {},
  },
  customerType: {
    type: String,
    enum: ['individual', 'business'],
    default: 'business',
  },
  notes: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
})

// Generate customer ID before saving
customerSchema.pre('save', async function(next) {
  if (!this.customerId) {
    const count = await mongoose.model('Customer').countDocuments()
    const year = new Date().getFullYear()
    const paddedNumber = String(count + 1).padStart(4, '0')
    this.customerId = `CUST-${year}-${paddedNumber}`
  }
  next()
})

// Indexes
customerSchema.index({ email: 1 })
customerSchema.index({ companyName: 'text' })
customerSchema.index({ createdBy: 1 })

const Customer = mongoose.model('Customer', customerSchema)

export default Customer
