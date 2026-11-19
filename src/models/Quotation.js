import mongoose from 'mongoose'

const customerSnapshotSchema = new mongoose.Schema({
  customerId: String,
  companyName: String,
  contactPerson: String,
  email: String,
  phone: String,
  billingAddress: mongoose.Schema.Types.Mixed,
  gstin: String,
  pan: String,
  state: String,
  stateCode: String,
}, { _id: false })

const quotationItemSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: true,
    trim: true,
  },
  description: String,
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative'],
    default: 1,
  },
  unit: {
    type: String,
    default: 'Project',
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative'],
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed',
  },
  total: {
    type: Number,
    default: 0,
  },
}, { _id: false })

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  expectedDate: Date,
  duration: String,
}, { _id: false })

const paymentMilestoneSchema = new mongoose.Schema({
  stage: {
    type: String,
    required: true,
  },
  description: String,
  percentage: Number,
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative'],
  },
  dueDate: Date,
}, { _id: false })

const statusHistorySchema = new mongoose.Schema({
  status: String,
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  changedAt: { type: Date, default: Date.now },
  notes: String,
}, { _id: false })

const emailHistorySchema = new mongoose.Schema({
  to: String,
  cc: String,
  subject: String,
  sentAt: { type: Date, default: Date.now },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { _id: false })

const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: true,
    unique: true,
  },
  quotationDate: {
    type: Date,
    required: true,
  },
  validUntil: Date,
  sentAt: Date,

  // Customer Reference & Snapshot
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  customerSnapshot: {
    type: customerSnapshotSchema,
    default: {},
  },

  // Basic Information
  contactPerson: String,
  email: String,
  phone: String,
  billingAddress: mongoose.Schema.Types.Mixed,

  // Project Information
  projectName: {
    type: String,
    required: true,
    trim: true,
  },
  projectCategory: String,
  projectDescription: String,

  // Scope of Work & Services (line items)
  items: [quotationItemSchema],

  // Financial Calculations
  subtotal: {
    type: Number,
    required: true,
    default: 0,
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed',
  },
  discountValue: {
    type: Number,
    default: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  additionalCharges: {
    type: Number,
    default: 0,
  },
  taxableAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  taxRate: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  grandTotal: {
    type: Number,
    required: true,
    default: 0,
  },
  amountInWords: String,
  currency: {
    type: String,
    default: 'INR',
  },

  // Project Timeline
  timeline: {
    estimatedStartDate: Date,
    estimatedDuration: String,
    deliveryDate: Date,
    milestones: [milestoneSchema],
  },

  // Payment Terms
  paymentType: {
    type: String,
    enum: ['percentage', 'fixed', 'custom'],
    default: 'percentage',
  },
  paymentTerms: [paymentMilestoneSchema],

  // Additional Information
  inclusions: [String],
  exclusions: [String],
  termsAndConditions: String,
  notes: String,
  internalRemarks: String,
  preparedBy: String,

  // Status & Tracking
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
    default: 'draft',
  },
  emailHistory: [emailHistorySchema],
  statusHistory: [statusHistorySchema],

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
})

// Indexes
quotationSchema.index({ customer: 1 })
quotationSchema.index({ status: 1 })
quotationSchema.index({ quotationDate: 1 })
quotationSchema.index({ validUntil: 1 })
quotationSchema.index({ createdBy: 1 })
quotationSchema.index({ projectName: 'text' })

const Quotation = mongoose.model('Quotation', quotationSchema)

export default Quotation
