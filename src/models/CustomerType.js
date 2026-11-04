import mongoose from 'mongoose'

const customerTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer type name is required'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
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

// Indexes
customerTypeSchema.index({ name: 1 })
customerTypeSchema.index({ isActive: 1 })
customerTypeSchema.index({ createdBy: 1 })

const CustomerType = mongoose.model('CustomerType', customerTypeSchema)

export default CustomerType
