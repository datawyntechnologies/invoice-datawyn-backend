import mongoose from 'mongoose'
import { config } from './config/env.js'
import Permission from './models/Permission.js'
import Role from './models/Role.js'
import User from './models/User.js'

const seedRBAC = async () => {
  try {
    await mongoose.connect(config.mongoUri)
    console.log('Connected to MongoDB')

    // Clear existing permissions and roles
    await Permission.deleteMany({})
    await Role.deleteMany({})
    console.log('Cleared existing permissions and roles')

    // Create permissions
    const permissions = await Permission.create([
      // Dashboard permissions
      { name: 'dashboard.view', description: 'View dashboard', module: 'dashboard', action: 'read' },
      { name: 'dashboard.view_invoice_value', description: 'View total invoice value card', module: 'dashboard', action: 'read' },
      { name: 'dashboard.view_paid_value', description: 'View total invoice paid value card', module: 'dashboard', action: 'read' },
      { name: 'dashboard.view_pending_value', description: 'View total invoice pending value card', module: 'dashboard', action: 'read' },
      { name: 'dashboard.view_revenue_chart', description: 'View revenue chart on dashboard', module: 'dashboard', action: 'read' },

      // Customer permissions
      { name: 'customers.view', description: 'View customers', module: 'customers', action: 'read' },
      { name: 'customers.create', description: 'Create customers', module: 'customers', action: 'create' },
      { name: 'customers.edit', description: 'Edit customers', module: 'customers', action: 'update' },
      { name: 'customers.delete', description: 'Delete customers', module: 'customers', action: 'delete' },
      { name: 'customers.view_payment_schedule', description: 'View customer payment schedule tab', module: 'customers', action: 'read' },
      { name: 'customers.view_payment_history', description: 'View customer payment history', module: 'customers', action: 'read' },

      // Product permissions
      { name: 'products.view', description: 'View products', module: 'products', action: 'read' },
      { name: 'products.create', description: 'Create products', module: 'products', action: 'create' },
      { name: 'products.edit', description: 'Edit products', module: 'products', action: 'update' },
      { name: 'products.delete', description: 'Delete products', module: 'products', action: 'delete' },

      // Proforma invoice permissions
      { name: 'proforma.view', description: 'View proforma invoices', module: 'proforma', action: 'read' },
      { name: 'proforma.create', description: 'Create proforma invoices', module: 'proforma', action: 'create' },
      { name: 'proforma.edit', description: 'Edit proforma invoices', module: 'proforma', action: 'update' },
      { name: 'proforma.delete', description: 'Delete proforma invoices', module: 'proforma', action: 'delete' },
      { name: 'proforma.convert', description: 'Convert proforma to invoice', module: 'proforma', action: 'manage' },

      // Proposal permissions
      { name: 'proposals.view', description: 'View proposals', module: 'proposals', action: 'read' },
      { name: 'proposals.create', description: 'Create proposals', module: 'proposals', action: 'create' },
      { name: 'proposals.edit', description: 'Edit proposals', module: 'proposals', action: 'update' },
      { name: 'proposals.delete', description: 'Delete proposals', module: 'proposals', action: 'delete' },

      // Invoice permissions
      { name: 'invoices.view', description: 'View invoices', module: 'invoices', action: 'read' },
      { name: 'invoices.create', description: 'Create invoices', module: 'invoices', action: 'create' },
      { name: 'invoices.edit', description: 'Edit invoices', module: 'invoices', action: 'update' },
      { name: 'invoices.delete', description: 'Delete invoices', module: 'invoices', action: 'delete' },

      // Settings permissions
      { name: 'settings.view', description: 'View settings', module: 'settings', action: 'read' },
      { name: 'settings.edit', description: 'Edit settings', module: 'settings', action: 'update' },

      // User management permissions
      { name: 'users.view', description: 'View users', module: 'users', action: 'read' },
      { name: 'users.create', description: 'Create users', module: 'users', action: 'create' },
      { name: 'users.edit', description: 'Edit users', module: 'users', action: 'update' },
      { name: 'users.delete', description: 'Delete users', module: 'users', action: 'delete' },

      // Role management permissions
      { name: 'roles.view', description: 'View roles', module: 'users', action: 'read' },
      { name: 'roles.create', description: 'Create roles', module: 'users', action: 'create' },
      { name: 'roles.edit', description: 'Edit roles', module: 'users', action: 'update' },
      { name: 'roles.delete', description: 'Delete roles', module: 'users', action: 'delete' },

      // Reports permissions
      { name: 'reports.view', description: 'View reports', module: 'reports', action: 'read' },
      { name: 'reports.export', description: 'Export reports', module: 'reports', action: 'manage' },

      // Payment permissions
      { name: 'payment.view', description: 'View payment plans and transactions', module: 'payment', action: 'read' },
      { name: 'payment.create', description: 'Create payment plans', module: 'payment', action: 'create' },
      { name: 'payment.edit', description: 'Edit payment plans and record payments', module: 'payment', action: 'update' },
      { name: 'payment.delete', description: 'Delete payment plans', module: 'payment', action: 'delete' },

      // Data import/export permissions
      { name: 'data.import', description: 'Import data (customers, products, payment schedules)', module: 'data', action: 'create' },
      { name: 'data.export', description: 'Export data (customers, products, payment schedules)', module: 'data', action: 'read' }
    ])
    console.log('Created permissions')

    // Clear user role assignments
    const updateResult = await User.updateMany(
      {},
      { $unset: { role: 1, legacyRole: 1 } }
    )
    console.log(`Cleared role assignments from ${updateResult.modifiedCount} users`)

    console.log('\n=== RBAC Data Seeded Successfully ===')
    console.log('Total permissions:', permissions.length)
    console.log('All roles cleared')
    console.log('Users can now create custom roles through the Roles page')
    console.log('IMPORTANT: You must create at least one role and assign it to users to regain access')

    process.exit(0)
  } catch (error) {
    console.error('Error seeding RBAC data:', error)
    process.exit(1)
  }
}

seedRBAC()