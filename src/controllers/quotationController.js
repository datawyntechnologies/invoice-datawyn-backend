import Quotation from '../models/Quotation.js'
import Customer from '../models/Customer.js'
import CompanySettings from '../models/CompanySettings.js'
import { generateQuotationNumber } from '../utils/generateInvoiceNumber.js'
import { amountInWords } from '../utils/amountInWords.js'
import { QuotationPdfService } from '../services/quotationPdfService.js'
import { EmailService } from '../services/emailService.js'
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js'

const VALID_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']
const EXPIRABLE_STATUSES = ['draft', 'sent', 'viewed']
const SORTABLE_FIELDS = ['quotationNumber', 'quotationDate', 'validUntil', 'grandTotal', 'projectName', 'createdAt']

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

const calculateItems = (items) => {
  return (items || []).map((item) => {
    const quantity = Math.max(0, parseFloat(item.quantity) || 0)
    const unitPrice = Math.max(0, parseFloat(item.unitPrice) || 0)
    const discount = Math.max(0, parseFloat(item.discount) || 0)
    const discountType = item.discountType === 'percentage' ? 'percentage' : 'fixed'
    const lineGross = quantity * unitPrice
    const discountAmount = discountType === 'percentage'
      ? round2((lineGross * Math.min(discount, 100)) / 100)
      : round2(Math.min(discount, lineGross))
    const total = round2(Math.max(0, lineGross - discountAmount))
    return {
      serviceName: String(item.serviceName || '').trim(),
      description: item.description || '',
      quantity,
      unit: item.unit || 'Project',
      unitPrice: round2(unitPrice),
      discount: round2(discount),
      discountType,
      total
    }
  })
}

const calculateQuotationTotals = (data) => {
  const items = calculateItems(data.items)
  const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))
  const lineDiscountTotal = round2(items.reduce((sum, item) => {
    const gross = item.quantity * item.unitPrice
    return sum + (gross - item.total)
  }, 0))
  const afterLineDiscount = round2(Math.max(0, subtotal - lineDiscountTotal))

  const discountType = data.discountType === 'percentage' ? 'percentage' : 'fixed'
  const discountValue = Math.max(0, parseFloat(data.discountValue) || 0)
  const discountAmount = discountType === 'percentage'
    ? round2((afterLineDiscount * Math.min(discountValue, 100)) / 100)
    : round2(Math.min(discountValue, afterLineDiscount))

  const additionalCharges = Math.max(0, round2(parseFloat(data.additionalCharges) || 0))
  const taxableAmount = round2(Math.max(0, afterLineDiscount - discountAmount + additionalCharges))
  const taxRate = Math.max(0, Math.min(100, parseFloat(data.taxRate) || 0))
  const taxAmount = round2((taxableAmount * taxRate) / 100)
  const grandTotal = round2(taxableAmount + taxAmount)

  return {
    items,
    subtotal,
    lineDiscountTotal,
    discountType,
    discountValue: round2(discountValue),
    discountAmount,
    additionalCharges,
    taxableAmount,
    taxRate,
    taxAmount,
    grandTotal,
    amountInWords: amountInWords(grandTotal)
  }
}

const calculatePaymentTerms = (paymentTerms, paymentType, grandTotal) => {
  const terms = (paymentTerms || [])
    .map((term) => ({
      stage: String(term.stage || term.description || 'Payment').trim(),
      description: term.description || term.notes || '',
      percentage: term.percentage !== undefined && term.percentage !== null && term.percentage !== ''
        ? Math.max(0, parseFloat(term.percentage) || 0) : undefined,
      amount: Math.max(0, round2(parseFloat(term.amount) || 0)),
      dueDate: term.dueDate || undefined
    }))
    .filter((term) => term.stage)

  if (!terms.length) return []

  if (paymentType === 'percentage') {
    // Compute amounts from percentages; make the last milestone absorb rounding so the sum equals grandTotal
    let allocated = 0
    return terms.map((term, index) => {
      const isLast = index === terms.length - 1
      let amount
      if (isLast) {
        amount = round2(grandTotal - allocated)
      } else {
        amount = round2((grandTotal * (Number(term.percentage) || 0)) / 100)
        allocated = round2(allocated + amount)
      }
      return { ...term, amount: Math.max(0, amount) }
    })
  }

  // fixed / custom: honour provided amounts, balance the last milestone against grandTotal
  const providedTotal = round2(terms.reduce((sum, term) => sum + term.amount, 0))
  const diff = round2(grandTotal - providedTotal)
  if (Math.abs(diff) > 0.009 && terms.length) {
    const last = terms[terms.length - 1]
    last.amount = round2(Math.max(0, last.amount + diff))
  }
  return terms
}

const buildCustomerSnapshot = (customerDoc) => ({
  customerId: customerDoc.customerId,
  companyName: customerDoc.companyName,
  contactPerson: customerDoc.contactPerson,
  email: customerDoc.email,
  phone: customerDoc.phone,
  billingAddress: customerDoc.billingAddress,
  gstin: customerDoc.gstin,
  pan: customerDoc.pan,
  state: customerDoc.billingAddress?.state,
  stateCode: customerDoc.billingAddress?.stateCode
})

const prepareQuotationForPdf = (quotation) => {
  const obj = quotation.toObject ? quotation.toObject() : quotation
  return {
    ...obj,
    items: obj.items || [],
    paymentTerms: obj.paymentTerms || [],
    inclusions: obj.inclusions || [],
    exclusions: obj.exclusions || [],
    timeline: obj.timeline || {},
    internalRemarks: undefined,
    emailHistory: undefined,
    statusHistory: undefined,
    createdBy: undefined,
    updatedBy: undefined,
    customer: undefined
  }
}

const quotationFilename = (quotation) => {
  const client = quotation.customerSnapshot?.companyName || 'Client'
  const safeClient = client.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `Datawyn_Quotation_${quotation.quotationNumber}_${safeClient}.pdf`
}

const expireOverdueQuotations = async () => {
  await Quotation.updateMany(
    { status: { $in: EXPIRABLE_STATUSES }, validUntil: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  )
}

export const getQuotations = async (req, res, next) => {
  try {
    await expireOverdueQuotations()
    const { page = 1, limit = 10, search, status, customer, dateFrom, dateTo, sortBy, sortOrder } = req.query

    const query = {}

    if (search) {
      query.$or = [
        { quotationNumber: { $regex: search, $options: 'i' } },
        { projectName: { $regex: search, $options: 'i' } },
        { 'customerSnapshot.companyName': { $regex: search, $options: 'i' } }
      ]
    }

    if (status) {
      query.status = status
    }

    if (customer) {
      query.customer = customer
    }

    if (dateFrom || dateTo) {
      query.quotationDate = {}
      if (dateFrom) query.quotationDate.$gte = new Date(dateFrom)
      if (dateTo) query.quotationDate.$lte = new Date(dateTo)
    }

    const sortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir = sortOrder === 'asc' ? 1 : -1
    const skip = (page - 1) * limit

    const [quotations, total] = await Promise.all([
      Quotation.find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('customer', 'companyName')
        .populate('createdBy', 'name'),
      Quotation.countDocuments(query)
    ])

    paginatedResponse(res, quotations, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  } catch (error) {
    next(error)
  }
}

export const getQuotationStats = async (req, res, next) => {
  try {
    await expireOverdueQuotations()
    const stats = await Quotation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' }
        }
      }
    ])

    const result = {
      total: 0,
      draft: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      totalAmount: 0
    }

    stats.forEach((s) => {
      result[s._id] = s.count
      result.total += s.count
      result.totalAmount += s.totalAmount || 0
    })

    successResponse(res, {
      totalQuotations: result.total,
      draft: result.draft,
      sent: result.sent,
      viewed: result.viewed,
      accepted: result.accepted,
      rejected: result.rejected,
      expired: result.expired,
      totalQuotedAmount: round2(result.totalAmount)
    })
  } catch (error) {
    next(error)
  }
}

export const getQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer', 'companyName')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')

    if (!quotation) {
      return errorResponse(res, 'Quotation not found', [], 404)
    }

    successResponse(res, quotation)
  } catch (error) {
    next(error)
  }
}

const sanitizeBody = (body) => {
  const {
    customer, items, paymentTerms, inclusions, exclusions,
    timeline, termsAndConditions, notes, internalRemarks, preparedBy,
    quotationDate, validUntil, projectName, projectCategory, projectDescription,
    contactPerson, email, phone, billingAddress,
    discountType, discountValue, additionalCharges, taxRate, paymentType,
    currency, status
  } = body

  return {
    customer, items, paymentTerms,
    inclusions: Array.isArray(inclusions) ? inclusions.filter(Boolean) : inclusions,
    exclusions: Array.isArray(exclusions) ? exclusions.filter(Boolean) : exclusions,
    timeline: timeline || {},
    termsAndConditions, notes, internalRemarks, preparedBy,
    quotationDate, validUntil, projectName, projectCategory, projectDescription,
    contactPerson, email, phone, billingAddress,
    discountType, discountValue, additionalCharges, taxRate, paymentType,
    currency, status
  }
}

export const createQuotation = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body)

    if (!data.customer) {
      return errorResponse(res, 'Customer is required')
    }
    if (!data.projectName) {
      return errorResponse(res, 'Project name is required')
    }
    if (!data.items || !data.items.length) {
      return errorResponse(res, 'At least one service item is required')
    }
    if (data.items.some((item) => !item.serviceName)) {
      return errorResponse(res, 'Every service item must have a name')
    }

    const customerDoc = await Customer.findById(data.customer)
    if (!customerDoc) {
      return errorResponse(res, 'Customer not found')
    }

    const totals = calculateQuotationTotals(data)
    const paymentTerms = calculatePaymentTerms(data.paymentTerms, data.paymentType, totals.grandTotal)
    const quotationNumber = await generateQuotationNumber('DT-QUO')

    const quotation = await Quotation.create({
      quotationNumber,
      quotationDate: data.quotationDate || new Date(),
      validUntil: data.validUntil,
      customer: data.customer,
      customerSnapshot: buildCustomerSnapshot(customerDoc),
      contactPerson: data.contactPerson || customerDoc.contactPerson,
      email: data.email || customerDoc.email,
      phone: data.phone || customerDoc.phone,
      billingAddress: data.billingAddress || customerDoc.billingAddress,
      projectName: data.projectName,
      projectCategory: data.projectCategory,
      projectDescription: data.projectDescription,
      items: totals.items,
      subtotal: totals.subtotal,
      discountType: totals.discountType,
      discountValue: totals.discountValue,
      discountAmount: totals.discountAmount,
      additionalCharges: totals.additionalCharges,
      taxableAmount: totals.taxableAmount,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      amountInWords: totals.amountInWords,
      currency: data.currency || 'INR',
      timeline: data.timeline,
      paymentType: data.paymentType || 'percentage',
      paymentTerms,
      inclusions: data.inclusions,
      exclusions: data.exclusions,
      termsAndConditions: data.termsAndConditions,
      notes: data.notes,
      internalRemarks: data.internalRemarks,
      preparedBy: data.preparedBy,
      status: 'draft',
      statusHistory: [{ status: 'draft', changedBy: req.user._id, changedAt: new Date() }],
      createdBy: req.user._id,
      updatedBy: req.user._id
    })

    successResponse(res, quotation, 'Quotation created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateQuotation = async (req, res, next) => {
  try {
    const data = sanitizeBody(req.body)

    const quotation = await Quotation.findById(req.params.id)
    if (!quotation) {
      return errorResponse(res, 'Quotation not found', [], 404)
    }

    if (data.customer) {
      const customerDoc = await Customer.findById(data.customer)
      if (!customerDoc) {
        return errorResponse(res, 'Customer not found')
      }
      data.customerSnapshot = buildCustomerSnapshot(customerDoc)
    }

    if (data.items && data.items.length) {
      if (data.items.some((item) => !item.serviceName)) {
        return errorResponse(res, 'Every service item must have a name')
      }
      const totals = calculateQuotationTotals(data)
      // Recalculate milestone amounts against the new grand total; fall back to
      // existing milestones when the client didn't resend them
      const paymentTermsSource = data.paymentTerms !== undefined ? data.paymentTerms : quotation.paymentTerms
      const paymentTerms = calculatePaymentTerms(paymentTermsSource, data.paymentType || quotation.paymentType, totals.grandTotal)
      Object.assign(data, {
        items: totals.items,
        subtotal: totals.subtotal,
        discountType: totals.discountType,
        discountValue: totals.discountValue,
        discountAmount: totals.discountAmount,
        additionalCharges: totals.additionalCharges,
        taxableAmount: totals.taxableAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
        amountInWords: totals.amountInWords,
        paymentTerms
      })
    } else if (data.paymentTerms) {
      // Recalculate milestone amounts if only payment terms changed
      data.paymentTerms = calculatePaymentTerms(data.paymentTerms, data.paymentType || quotation.paymentType, quotation.grandTotal)
    }

    // Do not allow quotationNumber edits; ignore status changes through this endpoint
    delete data.status

    const updated = await Quotation.findByIdAndUpdate(
      req.params.id,
      { ...data, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('customer', 'companyName').populate('createdBy', 'name').populate('updatedBy', 'name')

    successResponse(res, updated, 'Quotation updated successfully')
  } catch (error) {
    next(error)
  }
}

export const deleteQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id)
    if (!quotation) {
      return errorResponse(res, 'Quotation not found', [], 404)
    }
    successResponse(res, null, 'Quotation deleted successfully')
  } catch (error) {
    next(error)
  }
}

export const duplicateQuotation = async (req, res, next) => {
  try {
    const original = await Quotation.findById(req.params.id)
    if (!original) {
      return errorResponse(res, 'Quotation not found', [], 404)
    }

    const quotationNumber = await generateQuotationNumber('DT-QUO')
    const copy = original.toObject()
    delete copy._id
    delete copy.quotationNumber
    delete copy.emailHistory
    delete copy.statusHistory
    delete copy.sentAt

    const duplicate = await Quotation.create({
      ...copy,
      quotationNumber,
      quotationDate: new Date(),
      status: 'draft',
      statusHistory: [{ status: 'draft', changedBy: req.user._id, changedAt: new Date() }],
      createdBy: req.user._id,
      updatedBy: req.user._id
    })

    successResponse(res, duplicate, 'Quotation duplicated successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateQuotationStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body

    if (!VALID_STATUSES.includes(status)) {
      return errorResponse(res, 'Invalid quotation status')
    }

    const quotation = await Quotation.findById(req.params.id)
    if (!quotation) {
      return errorResponse(res, 'Quotation not found', [], 404)
    }

    if (quotation.status === 'accepted' || quotation.status === 'rejected') {
      return errorResponse(res, `Cannot change status of a ${quotation.status} quotation`)
    }

    quotation.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      notes: notes || ''
    })
    quotation.status = status
    quotation.updatedBy = req.user._id
    if (status === 'sent' && !quotation.sentAt) {
      quotation.sentAt = new Date()
    }
    await quotation.save()

    successResponse(res, quotation, 'Quotation status updated successfully')
  } catch (error) {
    next(error)
  }
}

export const downloadQuotationPDF = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
    if (!quotation) {
      return errorResponse(res, 'Quotation not found', [], 404)
    }

    const companySettings = await CompanySettings.findOne()
    const pdfBuffer = await QuotationPdfService.generateQuotation(
      prepareQuotationForPdf(quotation),
      companySettings
    )

    const filename = quotationFilename(quotation)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-Quotation-Filename', encodeURIComponent(filename))
    res.send(pdfBuffer)
  } catch (error) {
    console.error('Quotation PDF generation error:', error)
    return errorResponse(res, `Failed to generate PDF: ${error.message}`, [], 500)
  }
}

export const sendQuotationEmail = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
    if (!quotation) {
      return errorResponse(res, 'Quotation not found', [], 404)
    }

    const email = req.body.email || quotation.customerSnapshot?.email || quotation.email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(res, 'A valid recipient email is required')
    }

    const [companySettings] = await Promise.all([CompanySettings.findOne()])
    const pdfBuffer = await QuotationPdfService.generateQuotation(
      prepareQuotationForPdf(quotation),
      companySettings
    )

    await EmailService.sendQuotation(
      prepareQuotationForPdf(quotation),
      { ...req.body, email },
      pdfBuffer,
      companySettings
    )

    quotation.emailHistory.push({
      to: email,
      cc: req.body.cc || '',
      subject: req.body.subject || `Quotation ${quotation.quotationNumber} - ${quotation.projectName}`,
      sentAt: new Date(),
      sentBy: req.user._id
    })

    if (quotation.status === 'draft' || quotation.status === 'viewed') {
      quotation.statusHistory.push({
        status: 'sent',
        changedBy: req.user._id,
        changedAt: new Date(),
        notes: 'Quotation sent by email'
      })
      quotation.status = 'sent'
    }
    quotation.sentAt = new Date()
    quotation.updatedBy = req.user._id
    await quotation.save()

    successResponse(res, {
      emailHistory: quotation.emailHistory,
      status: quotation.status
    }, 'Quotation email sent successfully')
  } catch (error) {
    console.error('Quotation email error:', error)
    return errorResponse(res, `Failed to send quotation: ${error.message}`, [], 500)
  }
}
