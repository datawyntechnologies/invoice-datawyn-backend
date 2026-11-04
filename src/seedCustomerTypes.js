import mongoose from 'mongoose'
import CustomerType from './models/CustomerType.js'
import { connectDB } from './config/db.js'

const seedCustomerTypes = async () => {
  try {
    await connectDB()

    const defaultTypes = [
      { name: 'Business', description: 'Business customers' },
      { name: 'Individual', description: 'Individual customers' },
      { name: 'VIP', description: 'VIP customers' },
      { name: 'Corporate', description: 'Corporate clients' }
    ]

    for (const type of defaultTypes) {
      const existing = await CustomerType.findOne({ name: type.name })
      if (!existing) {
        await CustomerType.create(type)
        console.log(`Created customer type: ${type.name}`)
      } else {
        console.log(`Customer type already exists: ${type.name}`)
      }
    }

    console.log('Customer types seeded successfully')
    process.exit(0)
  } catch (error) {
    console.error('Error seeding customer types:', error)
    process.exit(1)
  }
}

seedCustomerTypes()
