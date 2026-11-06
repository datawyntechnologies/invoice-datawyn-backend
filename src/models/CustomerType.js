import mongoose from 'mongoose'

const customerTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    unique: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
})

const CustomerType = mongoose.model('CustomerType', customerTypeSchema)

export default CustomerType
