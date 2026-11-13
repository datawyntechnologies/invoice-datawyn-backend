import mongoose from 'mongoose'
import { config } from './config/env.js'
import Permission from './models/Permission.js'
import Role from './models/Role.js'

const newPermissions = [
  { name: 'dashboard.view_revenue_chart', description: 'View revenue chart on dashboard', module: 'dashboard', action: 'read' },
  { name: 'customers.view_payment_schedule', description: 'View customer payment schedule tab', module: 'customers', action: 'read' },
  { name: 'customers.view_payment_history', description: 'View customer payment history', module: 'customers', action: 'read' },
  { name: 'data.import', description: 'Import data (customers, products, payment schedules)', module: 'data', action: 'create' },
  { name: 'data.export', description: 'Export data (customers, products, payment schedules)', module: 'data', action: 'read' }
]

const addFeaturePermissions = async () => {
  try {
    await mongoose.connect(config.mongoUri)
    console.log('Connected to MongoDB')

    const created = []
    for (const permData of newPermissions) {
      const existing = await Permission.findOne({ name: permData.name })
      if (existing) {
        console.log(`Permission already exists: ${permData.name}`)
      } else {
        const perm = await Permission.create(permData)
        created.push(perm)
        console.log(`Created permission: ${perm.name}`)
      }
    }

    // Grant new permissions to the Admin role
    const adminRole = await Role.findOne({ name: 'Admin' })
    if (adminRole) {
      const allNewPerms = await Permission.find({ name: { $in: newPermissions.map(p => p.name) } })
      const currentIds = adminRole.permissions.map(p => p.toString())
      const toAdd = allNewPerms.filter(p => !currentIds.includes(p._id.toString()))
      if (toAdd.length > 0) {
        adminRole.permissions.push(...toAdd.map(p => p._id))
        await adminRole.save()
        console.log(`Added ${toAdd.length} permissions to Admin role`)
      } else {
        console.log('Admin role already has all new permissions')
      }
    } else {
      console.log('Admin role not found - assign permissions manually via Roles page')
    }

    console.log('\n=== Feature Permissions Added Successfully ===')
    console.log('Assign these permissions to roles from the Roles page as needed')
    process.exit(0)
  } catch (error) {
    console.error('Error adding feature permissions:', error)
    process.exit(1)
  }
}

addFeaturePermissions()
