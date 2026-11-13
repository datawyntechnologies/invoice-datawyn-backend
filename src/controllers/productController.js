import Product from '../models/Product.js'
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js'
import * as XLSX from 'xlsx'

export const getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, type } = req.query
    
    const query = {}
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (status === 'active' || status === 'inactive') {
      query.status = status
    }
    
    if (type === 'product' || type === 'service') {
      query.type = type
    }
    
    const skip = (page - 1) * limit
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email'),
      Product.countDocuments(query)
    ])
    
    paginatedResponse(res, products, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  } catch (error) {
    next(error)
  }
}

export const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email')
    
    if (!product) {
      return errorResponse(res, 'Product not found', [], 404)
    }
    
    successResponse(res, product)
  } catch (error) {
    next(error)
  }
}

export const createProduct = async (req, res, next) => {
  try {
    const productData = {
      ...req.body,
      createdBy: req.user._id
    }

    // Retry on duplicate auto-generated code (handles concurrent creates)
    let product
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        product = await Product.create(productData)
        break
      } catch (error) {
        const isDuplicateCode = error.code === 11000 && error.keyPattern?.code
        if (!isDuplicateCode || attempt === 2 || productData.code) throw error
        delete productData.code
      }
    }

    successResponse(res, product, 'Product created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    
    if (!product) {
      return errorResponse(res, 'Product not found', [], 404)
    }
    
    successResponse(res, product, 'Product updated successfully')
  } catch (error) {
    next(error)
  }
}

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    
    if (!product) {
      return errorResponse(res, 'Product not found', [], 404)
    }
    
    successResponse(res, null, 'Product deleted successfully')
  } catch (error) {
    next(error)
  }
}

const normalizeHeader = (header) =>
  String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const num = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isNaN(num) ? undefined : num
}

export const importProducts = async (req, res, next) => {
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
        const name = String(row.name || '').trim()
        if (!name) {
          throw new Error('Name is required')
        }

        const typeRaw = String(row.producttype || row.type || 'individual').toLowerCase()
        const productType = typeRaw === 'combo' || typeRaw === 'comboproduct' ? 'combo' : 'individual'

        const statusRaw = String(row.status || 'active').toLowerCase()
        const status = statusRaw === 'inactive' ? 'inactive' : 'active'

        const basic = toNumber(row.basicprice ?? row.basic ?? row.pricebasic)
        const standard = toNumber(row.standardprice ?? row.standard ?? row.pricestandard ?? row.price)
        const premium = toNumber(row.premiumprice ?? row.premium ?? row.pricepremium)
        const custom = toNumber(row.customprice ?? row.custom ?? row.pricecustom)

        const productData = {
          name,
          productType,
          description: row.description ? String(row.description) : undefined,
          status,
          createdBy: req.user._id,
        }

        if (basic !== undefined || standard !== undefined || premium !== undefined || custom !== undefined) {
          productData.priceRanges = {
            basic: basic ?? standard ?? premium ?? custom ?? 0,
            standard: standard ?? basic ?? premium ?? custom ?? 0,
            premium: premium ?? standard ?? basic ?? custom ?? 0,
            ...(custom !== undefined ? { custom } : {}),
          }
        }

        const code = row.code ? String(row.code).trim() : undefined

        if (code) {
          const existing = await Product.findOne({ code })
          if (existing) {
            Object.assign(existing, productData)
            await existing.save()
            results.updated++
            continue
          }
          productData.code = code
        }

        await Product.create(productData)
        results.created++
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
