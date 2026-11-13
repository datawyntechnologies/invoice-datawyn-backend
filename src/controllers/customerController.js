import Customer from '../models/Customer.js'
import * as XLSX from 'xlsx'
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js'

export const getCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query
    
    const query = {}
    
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (status === 'active' || status === 'inactive') {
      query.isActive = status === 'active'
    }
    
    const skip = (page - 1) * limit
    
    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email'),
      Customer.countDocuments(query)
    ])
    
    paginatedResponse(res, customers, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  } catch (error) {
    next(error)
  }
}

export const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'name email')
    
    if (!customer) {
      return errorResponse(res, 'Customer not found', [], 404)
    }
    
    successResponse(res, customer)
  } catch (error) {
    next(error)
  }
}

export const createCustomer = async (req, res, next) => {
  try {
    const customerData = {
      ...req.body,
      createdBy: req.user._id
    }
    
    const customer = await Customer.create(customerData)
    
    successResponse(res, customer, 'Customer created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    
    if (!customer) {
      return errorResponse(res, 'Customer not found', [], 404)
    }
    
    successResponse(res, customer, 'Customer updated successfully')
  } catch (error) {
    next(error)
  }
}

export const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id)
    
    if (!customer) {
      return errorResponse(res, 'Customer not found', [], 404)
    }
    
    successResponse(res, null, 'Customer deleted successfully')
  } catch (error) {
    next(error)
  }
}

const normalizeHeader = (header) =>
  String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const buildAddress = (row, prefix) => {
  const address = {}
  const street = row[`${prefix}street`]
  const city = row[`${prefix}city`]
  const state = row[`${prefix}state`]
  const pincode = row[`${prefix}pincode`] ?? row[`${prefix}pin`]
  if (street) address.street = String(street)
  if (city) address.city = String(city)
  if (state) address.state = String(state)
  if (pincode) address.pincode = String(pincode)
  return Object.keys(address).length > 0 ? address : undefined
}

export const importCustomers = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded', [], 400)
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return errorResponse(res, 'The uploaded file is empty', [], 400)
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
    if (rows.length === 0) {
      return errorResponse(res, 'No data rows found in the file', [], 400)
    }

    const results = { created: 0, updated: 0, failed: 0, errors: [] }

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2 // +1 for header row, +1 for 0-index
      const row = {}
      Object.entries(rows[i]).forEach(([key, value]) => {
        row[normalizeHeader(key)] = value
      })

      try {
        const companyName = String(row.companyname || row.name || '').trim()
        if (!companyName) {
          throw new Error('Company Name is required')
        }

        const email = row.email ? String(row.email).trim().toLowerCase() : undefined
        const customerType = row.customertype || row.type ? String(row.customertype || row.type).trim() : undefined

        const customerData = {
          companyName,
          contactPerson: row.contactperson ? String(row.contactperson).trim() : undefined,
          email,
          phone: row.phone ? String(row.phone).trim() : undefined,
          alternatePhone: row.alternatephone || row.altphone ? String(row.alternatephone || row.altphone).trim() : undefined,
          customerType,
          notes: row.notes ? String(row.notes) : undefined,
          createdBy: req.user._id,
        }

        const billingAddress = buildAddress(row, 'billing')
        const shippingAddress = buildAddress(row, 'shipping')
        if (billingAddress) customerData.billingAddress = billingAddress
        if (shippingAddress) customerData.shippingAddress = shippingAddress

        // Match existing customer by email first, then by company name
        let existing = null
        if (email) {
          existing = await Customer.findOne({ email })
        }
        if (!existing) {
          existing = await Customer.findOne({ companyName: { $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })
        }

        if (existing) {
          Object.entries(customerData).forEach(([key, value]) => {
            if (value !== undefined) existing[key] = value
          })
          await existing.save()
          results.updated++
        } else {
          await Customer.create(customerData)
          results.created++
        }
      } catch (rowError) {
        results.failed++
        results.errors.push({ row: rowNumber, error: rowError.message })
      }
    }

    const message = `Import completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed`
    successResponse(res, results, message)
  } catch (error) {
    next(error)
  }
}

export const getCustomerInvoices = async (req, res, next) => {
  try {
    const ProformaInvoice = (await import('../models/ProformaInvoice.js')).default
    
    const invoices = await ProformaInvoice.find({ customer: req.params.id })
      .sort({ createdAt: -1 })
      .select('invoiceNumber invoiceDate grandTotal status')
    
    successResponse(res, invoices)
  } catch (error) {
    next(error)
  }
}
