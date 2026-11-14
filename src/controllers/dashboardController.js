import Customer from '../models/Customer.js'
import Product from '../models/Product.js'
import ProformaInvoice from '../models/ProformaInvoice.js'
import PaymentPlan from '../models/PaymentPlan.js'
import { successResponse } from '../utils/response.js'

export const getStats = async (req, res, next) => {
  try {
    const [
      totalCustomers,
      totalProducts,
      totalProformaInvoices,
      totalInvoiceValue,
      recentInvoices
    ] = await Promise.all([
      Customer.countDocuments({ isActive: true }),
      Product.countDocuments({ status: 'active' }),
      ProformaInvoice.countDocuments(),
      ProformaInvoice.aggregate([
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]),
      ProformaInvoice.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customer', 'companyName')
    ])

    // Calculate paid and pending amounts from accepted/converted invoices
    const acceptedInvoices = await ProformaInvoice.aggregate([
      { $match: { status: { $in: ['accepted', 'converted'] } } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: { $ifNull: ['$advanceAmount', 0] } },
          totalGrand: { $sum: '$grandTotal' }
        }
      }
    ])

    // Calculate total paid from payment plans
    const paymentPlansPaid = await PaymentPlan.aggregate([
      { $match: { status: { $in: ['active', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$totalPaid' } } }
    ])

    const invoicePaidAmount = acceptedInvoices[0]?.totalPaid || 0
    const paymentPlanPaidAmount = paymentPlansPaid[0]?.total || 0
    const totalPaidAmount = invoicePaidAmount + paymentPlanPaidAmount

    const totalGrandAmount = acceptedInvoices[0]?.totalGrand || 0
    const totalPendingAmount = totalGrandAmount - totalPaidAmount

    const stats = {
      totalCustomers,
      totalProducts,
      totalProformaInvoices,
      totalInvoiceValue: totalInvoiceValue[0]?.total || 0,
      totalPaidAmount,
      totalPendingAmount,
      recentInvoices
    }

    successResponse(res, stats)
  } catch (error) {
    next(error)
  }
}

export const getCharts = async (req, res, next) => {
  try {
    // Monthly invoice value
    const monthlyValue = await ProformaInvoice.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ])
    
    // Status distribution
    const statusDistribution = await ProformaInvoice.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])
    
    const charts = {
      monthlyValue,
      statusDistribution
    }
    
    successResponse(res, charts)
  } catch (error) {
    next(error)
  }
}

const getMonthLabel = (year, month) => {
  const date = new Date(Date.UTC(year, month, 1))
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const getBucketKey = (date, groupBy) => {
  const d = new Date(date)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const day = d.getUTCDate()

  if (groupBy === 'year') {
    return { key: `${year}`, label: `${year}` }
  }

  if (groupBy === 'week') {
    // Monday-start week bucket
    const weekStart = new Date(Date.UTC(year, month, day))
    const diff = (weekStart.getUTCDay() + 6) % 7
    weekStart.setUTCDate(weekStart.getUTCDate() - diff)
    const key = weekStart.toISOString().split('T')[0]
    return { key, label: key }
  }

  // month (default)
  const key = `${year}-${String(month + 1).padStart(2, '0')}`
  return { key, label: getMonthLabel(year, month) }
}

export const getRevenueChart = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'month' } = req.query
    const validGroupBy = ['week', 'month', 'year'].includes(groupBy) ? groupBy : 'month'

    const match = {}
    if (startDate || endDate) {
      match.invoiceDate = {}
      if (startDate) {
        const start = new Date(startDate)
        if (!isNaN(start)) match.invoiceDate.$gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        if (!isNaN(end)) {
          // Include the entire end day
          end.setUTCHours(23, 59, 59, 999)
          match.invoiceDate.$lte = end
        }
      }
    }

    const invoices = await ProformaInvoice.find(match)
      .select('invoiceDate grandTotal advanceAmount status paymentPlan convertedInvoice')
      .lean()

    const invoiceIds = invoices.map((inv) => inv._id)
    const linkedPlanIds = invoices.map((inv) => inv.paymentPlan).filter(Boolean)
    const convertedInvoiceIds = invoices.map((inv) => inv.convertedInvoice).filter(Boolean)

    const paymentPlans = await PaymentPlan.find({
      status: { $in: ['active', 'completed'] },
      $or: [
        { invoiceType: 'proforma', invoiceId: { $in: invoiceIds } },
        { invoiceType: 'invoice', invoiceId: { $in: convertedInvoiceIds } },
        { _id: { $in: linkedPlanIds } }
      ]
    })
      .select('invoiceType invoiceId totalPaid')
      .lean()

    // Map paid amounts back to proforma invoices
    const planPaidByInvoice = new Map()
    const planById = new Map(paymentPlans.map((p) => [p._id.toString(), p]))

    const addPaid = (invoice, amount) => {
      const key = invoice._id.toString()
      planPaidByInvoice.set(key, (planPaidByInvoice.get(key) || 0) + amount)
    }

    for (const invoice of invoices) {
      // Direct paymentPlan reference on the invoice
      if (invoice.paymentPlan) {
        const plan = planById.get(invoice.paymentPlan.toString())
        if (plan) addPaid(invoice, plan.totalPaid || 0)
      }
      // Plans pointing at the proforma invoice itself
      // (handled below via invoiceType match)
    }

    // Attribute remaining unmatched plans via invoiceId
    const matchedPlanIds = new Set()
    for (const invoice of invoices) {
      if (invoice.paymentPlan) matchedPlanIds.add(invoice.paymentPlan.toString())
    }
    const convertedToProforma = new Map(invoices.map((inv) => [inv.convertedInvoice?.toString(), inv]).filter(([k]) => k))

    for (const plan of paymentPlans) {
      const planKey = plan._id.toString()
      if (matchedPlanIds.has(planKey)) continue

      let targetInvoice = null
      if (plan.invoiceType === 'proforma') {
        targetInvoice = invoices.find((inv) => inv._id.toString() === plan.invoiceId.toString())
      } else if (plan.invoiceType === 'invoice') {
        targetInvoice = convertedToProforma.get(plan.invoiceId.toString())
      }
      if (targetInvoice) addPaid(targetInvoice, plan.totalPaid || 0)
    }

    const buckets = new Map()
    for (const invoice of invoices) {
      const { key, label } = getBucketKey(invoice.invoiceDate, validGroupBy)
      if (!buckets.has(key)) {
        buckets.set(key, { period: key, label, total: 0, paid: 0, pending: 0, count: 0 })
      }
      const bucket = buckets.get(key)
      const total = invoice.grandTotal || 0
      const rawPaid = (invoice.advanceAmount || 0) + (planPaidByInvoice.get(invoice._id.toString()) || 0)
      const paid = Math.min(rawPaid, total)
      bucket.total += total
      bucket.paid += paid
      bucket.pending += Math.max(total - paid, 0)
      bucket.count += 1
    }

    const data = Array.from(buckets.values()).sort((a, b) => a.period.localeCompare(b.period))

    successResponse(res, {
      groupBy: validGroupBy,
      data,
      totals: data.reduce(
        (acc, bucket) => {
          acc.total += bucket.total
          acc.paid += bucket.paid
          acc.pending += bucket.pending
          acc.count += bucket.count
          return acc
        },
        { total: 0, paid: 0, pending: 0, count: 0 }
      )
    })
  } catch (error) {
    next(error)
  }
}
