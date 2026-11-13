import mongoose from 'mongoose'

const paymentPlanSchema = new mongoose.Schema({
  // Reference to the invoice/proforma
  invoiceType: {
    type: String,
    enum: ['proforma', 'invoice'],
    required: true,
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  invoiceNumber: {
    type: String,
    required: true,
  },
  
  // Reference to customer
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  
  // Payment Plan Type
  planType: {
    type: String,
    enum: ['full_payment', 'advance_50', 'custom_fixed', 'custom_percentage', 'emi', 'recurring'],
    required: true,
  },
  
  // Payment Method (for custom plans)
  paymentMethod: {
    type: String,
    enum: {
      values: ['fixed_amount', 'percentage_based', 'emi'],
      message: '{VALUE} is not a valid payment method'
    },
  },
  
  // Total invoice amount
  totalAmount: {
    type: Number,
    required: true,
  },
  
  // Payment summary
  totalPaid: {
    type: Number,
    default: 0,
  },
  remainingAmount: {
    type: Number,
    required: true,
  },
  
  // EMI specific fields
  emiDetails: {
    numberOfMonths: Number,
    startDate: Date,
    paymentDay: Number, // Day of month (1-31)
    monthlyAmount: Number,
  },

  // Recurring payment specific fields
  recurringDetails: {
    amount: Number,
    frequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
    },
    startDate: Date,
    endDate: Date,
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
  },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
})

paymentPlanSchema.virtual('invoiceItems')
paymentPlanSchema.set('toJSON', { virtuals: true })
paymentPlanSchema.set('toObject', { virtuals: true })

// Indexes
paymentPlanSchema.index({ invoiceId: 1 })
paymentPlanSchema.index({ customer: 1 })
paymentPlanSchema.index({ status: 1 })
paymentPlanSchema.index({ invoiceType: 1, invoiceId: 1 })

const PaymentPlan = mongoose.model('PaymentPlan', paymentPlanSchema)

export default PaymentPlan
