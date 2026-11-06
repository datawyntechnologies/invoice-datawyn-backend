import CustomerType from '../models/CustomerType.js'
import Customer from '../models/Customer.js'
import { successResponse, errorResponse } from '../utils/response.js'

const DEFAULT_TYPES = ['Business', 'Individual']

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const nameMatch = (name) => ({ $regex: `^${escapeRegExp(name)}$`, $options: 'i' })

export const getCustomerTypes = async (req, res, next) => {
  try {
    // Seed default types on first use
    const count = await CustomerType.countDocuments()
    if (count === 0) {
      await CustomerType.insertMany(DEFAULT_TYPES.map(name => ({ name })))
    }

    const types = await CustomerType.find({ isActive: true }).sort({ name: 1 })
    successResponse(res, types)
  } catch (error) {
    next(error)
  }
}

export const createCustomerType = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim()
    if (!name) {
      return errorResponse(res, 'Name is required')
    }

    const existing = await CustomerType.findOne({ name: nameMatch(name) })
    if (existing) {
      return errorResponse(res, 'Customer type already exists')
    }

    const type = await CustomerType.create({ name })
    successResponse(res, type, 'Customer type created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateCustomerType = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim()
    if (!name) {
      return errorResponse(res, 'Name is required')
    }

    const type = await CustomerType.findById(req.params.id)
    if (!type) {
      return errorResponse(res, 'Customer type not found', [], 404)
    }

    const oldName = type.name
    if (oldName.toLowerCase() !== name.toLowerCase()) {
      const existing = await CustomerType.findOne({
        name: nameMatch(name),
        _id: { $ne: type._id }
      })
      if (existing) {
        return errorResponse(res, 'Customer type already exists')
      }

      type.name = name
      await type.save()

      // Keep existing customers in sync with the renamed type
      await Customer.updateMany(
        { customerType: nameMatch(oldName) },
        { customerType: name }
      )
    }

    successResponse(res, type, 'Customer type updated successfully')
  } catch (error) {
    next(error)
  }
}

export const deleteCustomerType = async (req, res, next) => {
  try {
    const type = await CustomerType.findById(req.params.id)
    if (!type) {
      return errorResponse(res, 'Customer type not found', [], 404)
    }

    const inUse = await Customer.countDocuments({
      customerType: nameMatch(type.name)
    })
    if (inUse > 0) {
      return errorResponse(res, `Cannot delete: ${inUse} customer(s) are using this type. Reassign them first.`)
    }

    await type.deleteOne()
    successResponse(res, null, 'Customer type deleted successfully')
  } catch (error) {
    next(error)
  }
}
