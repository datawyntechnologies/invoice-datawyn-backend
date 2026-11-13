import mongoose from 'mongoose'

const paymentInstallmentSchema = new mongoose.Schema({
  // Reference to payment plan
  paymentPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentPlan',
    required: true,
  },
  
  // Installment details
  installmentNumber: {
    type: Number,
    required: true,
  },
  paymentName: {
    type: String,
    required: true,
  },
  paymentType: {
    type: String,
    enum: ['advance', 'balance', 'milestone', 'emi', 'recurring', 'other'],
    default: 'other',
  },
  
  // Amount details
  scheduledAmount: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  
  // Due date
  dueDate: {
    type: Date,
    required: true,
  },
  
  // Payment tracking
  amountPaid: {
    type: Number,
    default: 0,
  },
  remainingAmount: {
    type: Number,
    required: true,
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue'],
    default: 'pending',
  },
  
  // Payment details
  paidDate: Date,
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'bank_transfer', 'card', 'other'],
  },
  transactionId: String,
  notes: String,
  
  // Receipt
  receiptUrl: String,
  
  // Overdue tracking
  isOverdue: {
    type: Boolean,
    default: false,
  },
  daysOverdue: {
    type: Number,
    default: 0,
  },
  
}, {
  timestamps: true,
})

// Indexes
paymentInstallmentSchema.index({ paymentPlan: 1 })
paymentInstallmentSchema.index({ status: 1 })
paymentInstallmentSchema.index({ dueDate: 1 })
paymentInstallmentSchema.index({ isOverdue: 1 })

const PaymentInstallment = mongoose.model('PaymentInstallment', paymentInstallmentSchema)

export default PaymentInstallment
