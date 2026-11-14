import PaymentPlan from '../models/PaymentPlan.js'
import PaymentInstallment from '../models/PaymentInstallment.js'
import PaymentTransaction from '../models/PaymentTransaction.js'
import ProformaInvoice from '../models/ProformaInvoice.js'
import Invoice from '../models/Invoice.js'
import * as XLSX from 'xlsx'
import { successResponse, errorResponse } from '../utils/response.js'

// Helper function to check and update overdue status
const checkOverdueStatus = (installment) => {
  const today = new Date()
  const dueDate = new Date(installment.dueDate)
  
  if (dueDate < today && installment.status !== 'paid') {
    const diffTime = Math.abs(today - dueDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    installment.isOverdue = true
    installment.daysOverdue = diffDays
    if (installment.status === 'pending') {
      installment.status = 'overdue'
    }
  } else {
    installment.isOverdue = false
    installment.daysOverdue = 0
    if (installment.status === 'overdue') {
      installment.status = 'pending'
    }
  }
  
  return installment
}

// Create Payment Plan
export const createPaymentPlan = async (req, res, next) => {
  try {
    const {
      invoiceType,
      invoiceId,
      invoiceNumber,
      customer,
      planType,
      paymentMethod,
      totalAmount,
      paymentSchedule,
      emiDetails
    } = req.body
    
    // Validate required fields
    if (!invoiceType || !invoiceId || !customer || !planType || !totalAmount) {
      return errorResponse(res, 'Missing required fields')
    }
    
    // Validate total scheduled amount matches invoice amount
    if (paymentSchedule && paymentSchedule.length > 0) {
      const totalScheduled = paymentSchedule.reduce((sum, item) => sum + (item.amount || 0), 0)
      if (Math.abs(totalScheduled - totalAmount) > 0.01) {
        return errorResponse(res, `Total scheduled amount (${totalScheduled}) must equal invoice amount (${totalAmount})`)
      }
    }
    
    // Validate percentage-based payments
    if (paymentMethod === 'percentage_based' && paymentSchedule) {
      const totalPercentage = paymentSchedule.reduce((sum, item) => sum + (item.percentage || 0), 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return errorResponse(res, `Total percentage (${totalPercentage}%) must equal 100%`)
      }
    }

    // Map custom_payment to the appropriate subtype for database storage
    let dbPlanType = planType
    if (planType === 'custom_payment') {
      if (!paymentMethod) {
        return errorResponse(res, 'Payment method is required for custom payment plans')
      }
      if (paymentMethod === 'fixed_amount') {
        dbPlanType = 'custom_fixed'
      } else if (paymentMethod === 'percentage_based') {
        dbPlanType = 'custom_percentage'
      } else if (paymentMethod === 'emi') {
        dbPlanType = 'emi'
      } else {
        return errorResponse(res, `Invalid payment method: ${paymentMethod}`)
      }
    }

    // Create payment plan
    const paymentPlan = await PaymentPlan.create({
      invoiceType,
      invoiceId,
      invoiceNumber,
      customer,
      planType: dbPlanType,
      ...(paymentMethod && { paymentMethod }),
      totalAmount,
      remainingAmount: totalAmount,
      emiDetails,
      createdBy: req.user._id,
    })
    
    // Create installments
    const installments = []
    if (paymentSchedule && paymentSchedule.length > 0) {
      for (let i = 0; i < paymentSchedule.length; i++) {
        const schedule = paymentSchedule[i]
        const installment = await PaymentInstallment.create({
          paymentPlan: paymentPlan._id,
          installmentNumber: i + 1,
          paymentName: schedule.paymentName || `Payment ${i + 1}`,
          paymentType: schedule.paymentType || 'other',
          scheduledAmount: schedule.amount,
          percentage: schedule.percentage,
          dueDate: schedule.dueDate,
          remainingAmount: schedule.amount,
          status: 'pending',
        })
        
        // Check if overdue
        checkOverdueStatus(installment)
        await installment.save()
        
        installments.push(installment)
      }
    }
    
    // Update invoice with payment plan reference
    if (invoiceType === 'proforma') {
      await ProformaInvoice.findByIdAndUpdate(invoiceId, { paymentPlan: paymentPlan._id })
    } else if (invoiceType === 'invoice') {
      await Invoice.findByIdAndUpdate(invoiceId, { paymentPlan: paymentPlan._id })
    }
    
    successResponse(res, {
      paymentPlan,
      installments,
    }, 'Payment plan created successfully', 201)
  } catch (error) {
    next(error)
  }
}

// Get Payment Plan by Invoice
export const getPaymentPlanByInvoice = async (req, res, next) => {
  try {
    const { invoiceType, invoiceId } = req.params
    
    const paymentPlan = await PaymentPlan.findOne({
      invoiceType,
      invoiceId,
    })
      .populate('customer', 'companyName email phone')
      .populate('createdBy', 'name')
    
    if (!paymentPlan) {
      return errorResponse(res, 'Payment plan not found', [], 404)
    }
    
    // Get installments
    const installments = await PaymentInstallment.find({
      paymentPlan: paymentPlan._id,
    }).sort({ installmentNumber: 1 })
    
    // Check overdue status for all installments
    for (const installment of installments) {
      checkOverdueStatus(installment)
      await installment.save()
    }
    
    // Get payment transactions
    const transactions = await PaymentTransaction.find({
      paymentPlan: paymentPlan._id,
    })
      .populate('installment', 'paymentName installmentNumber')
      .populate('recordedBy', 'name')
      .sort({ transactionDate: -1 })
    
    // Calculate summary
    const totalPaid = installments.reduce((sum, inst) => sum + inst.amountPaid, 0)
    const pendingInstallments = installments.filter(inst => inst.status === 'pending').length
    const paidInstallments = installments.filter(inst => inst.status === 'paid').length
    const overdueInstallments = installments.filter(inst => inst.isOverdue).length
    const nextPayment = installments.find(inst => inst.status === 'pending' && !inst.isOverdue)
    
    successResponse(res, {
      paymentPlan,
      installments,
      transactions,
      summary: {
        totalPaid,
        remainingAmount: paymentPlan.remainingAmount,
        pendingInstallments,
        paidInstallments,
        overdueInstallments,
        nextPayment,
        progressPercentage: (totalPaid / paymentPlan.totalAmount) * 100,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get All Payment Plans
export const getAllPaymentPlans = async (req, res, next) => {
  try {
    const paymentPlans = await PaymentPlan.find()
      .populate('customer', 'companyName name')
      .sort({ createdAt: -1 })

    // Calculate stats
    const totalAmount = paymentPlans.reduce((sum, plan) => sum + plan.totalAmount, 0)
    const totalPaid = paymentPlans.reduce((sum, plan) => sum + plan.totalPaid, 0)
    const totalPending = paymentPlans.reduce((sum, plan) => sum + plan.remainingAmount, 0)
    const activePlans = paymentPlans.filter(plan => plan.status === 'active').length

    successResponse(res, {
      paymentPlans,
      stats: {
        totalAmount,
        totalPaid,
        totalPending,
        activePlans
      }
    })
  } catch (error) {
    next(error)
  }
}

// Record Payment
export const recordPayment = async (req, res, next) => {
  try {
    const {
      installmentId,
      amount,
      paymentMethod,
      paymentDate,
      referenceNumber,
      notes,
      receiptUrl,
    } = req.body
    
    // Validate
    if (!installmentId || !amount || !paymentMethod) {
      return errorResponse(res, 'Missing required fields')
    }
    
    // Get installment
    const installment = await PaymentInstallment.findById(installmentId)
      .populate('paymentPlan')
    
    if (!installment) {
      return errorResponse(res, 'Installment not found', [], 404)
    }
    
    if (installment.status === 'paid') {
      return errorResponse(res, 'This installment is already fully paid')
    }
    
    const paymentPlan = installment.paymentPlan
    
    // Check if amount exceeds remaining
    if (amount > installment.remainingAmount) {
      return errorResponse(res, `Amount (${amount}) exceeds remaining amount (${installment.remainingAmount})`)
    }
    
    // Generate transaction ID
    const count = await PaymentTransaction.countDocuments()
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const paddedNumber = String(count + 1).padStart(6, '0')
    const transactionId = `TXN-${year}${month}-${paddedNumber}`
    
    // Create transaction
    const transaction = await PaymentTransaction.create({
      installment: installmentId,
      paymentPlan: paymentPlan._id,
      customer: paymentPlan.customer,
      transactionId,
      amount,
      paymentMethod,
      transactionDate: paymentDate || new Date(),
      referenceNumber,
      notes,
      receiptUrl,
      recordedBy: req.user._id,
    })
    
    // Update installment
    installment.amountPaid += amount
    installment.remainingAmount -= amount
    installment.paidDate = paymentDate || new Date()
    installment.paymentMethod = paymentMethod
    installment.transactionId = transaction.transactionId
    installment.notes = notes
    installment.receiptUrl = receiptUrl
    
    // Update status
    if (installment.remainingAmount <= 0.01) {
      installment.status = 'paid'
      installment.remainingAmount = 0
    } else {
      installment.status = 'partial'
    }
    
    // Check overdue status
    checkOverdueStatus(installment)
    await installment.save()
    
    // Update payment plan
    paymentPlan.totalPaid += amount
    paymentPlan.remainingAmount -= amount
    
    // Check if all installments are paid
    const allInstallments = await PaymentInstallment.find({ paymentPlan: paymentPlan._id })
    const allPaid = allInstallments.every(inst => inst.status === 'paid')
    
    if (allPaid) {
      paymentPlan.status = 'completed'
    }
    
    await paymentPlan.save()
    
    successResponse(res, {
      transaction,
      installment,
      paymentPlan,
    }, 'Payment recorded successfully')
  } catch (error) {
    next(error)
  }
}

// Creates a manual installment record (and a transaction for any paid portion)
// Does NOT update payment plan totals - callers handle that
const createManualInstallmentRecord = async (paymentPlan, fields, userId) => {
  const { paymentName, paymentDate, scheduledAmount, remainingAmount, paymentMethod, notes } = fields

  if (!paymentDate || scheduledAmount === undefined || scheduledAmount === null || scheduledAmount === '') {
    throw new Error('Payment date and amount are required')
  }

  const scheduled = Number(scheduledAmount)
  if (isNaN(scheduled) || scheduled <= 0) {
    throw new Error('Amount must be greater than 0')
  }

  const remaining = remainingAmount !== undefined && remainingAmount !== null && remainingAmount !== ''
    ? Number(remainingAmount)
    : scheduled
  if (isNaN(remaining) || remaining < 0 || remaining > scheduled) {
    throw new Error('Remaining amount must be between 0 and the amount')
  }

  const amountPaid = Math.round((scheduled - remaining) * 100) / 100
  const isFullyPaid = remaining <= 0.01
  const status = isFullyPaid ? 'paid' : amountPaid > 0 ? 'partial' : 'pending'

  const lastInstallment = await PaymentInstallment.findOne({ paymentPlan: paymentPlan._id }).sort({ installmentNumber: -1 })
  const installment = await PaymentInstallment.create({
    paymentPlan: paymentPlan._id,
    installmentNumber: (lastInstallment?.installmentNumber || 0) + 1,
    paymentName: paymentName || 'Manual Payment',
    paymentType: 'other',
    scheduledAmount: scheduled,
    dueDate: paymentDate,
    amountPaid,
    remainingAmount: isFullyPaid ? 0 : remaining,
    status,
    paidDate: amountPaid > 0 ? paymentDate : undefined,
    paymentMethod: amountPaid > 0 ? (paymentMethod || 'other') : undefined,
    notes,
  })

  checkOverdueStatus(installment)
  await installment.save()

  // Record a transaction for the paid portion so it appears in payment history
  let transaction = null
  if (amountPaid > 0) {
    const count = await PaymentTransaction.countDocuments()
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const transactionId = `TXN-${year}${month}-${String(count + 1).padStart(6, '0')}`
    transaction = await PaymentTransaction.create({
      installment: installment._id,
      paymentPlan: paymentPlan._id,
      customer: paymentPlan.customer,
      transactionId,
      amount: amountPaid,
      paymentMethod: paymentMethod || 'other',
      transactionDate: paymentDate,
      notes: notes || 'Manual payment entry',
      recordedBy: userId,
    })
  }

  return { installment, transaction, scheduled, amountPaid }
}

// Recomputes plan totals/status after manual entries change
const updatePlanTotalsAfterManualEntries = async (paymentPlan) => {
  const allInstallments = await PaymentInstallment.find({ paymentPlan: paymentPlan._id })
  paymentPlan.totalPaid = allInstallments.reduce((sum, inst) => sum + inst.amountPaid, 0)
  paymentPlan.remainingAmount = paymentPlan.totalAmount - paymentPlan.totalPaid
  if (allInstallments.every(inst => inst.status === 'paid')) {
    paymentPlan.status = 'completed'
  } else if (paymentPlan.status === 'completed') {
    paymentPlan.status = 'active'
  }
  await paymentPlan.save()
  return paymentPlan
}

// Add a manual installment/payment entry to a payment plan
export const addManualInstallment = async (req, res, next) => {
  try {
    const { paymentPlanId, paymentName, paymentDate, scheduledAmount, remainingAmount, paymentMethod, notes } = req.body

    if (!paymentPlanId) {
      return errorResponse(res, 'Payment plan is required')
    }

    const paymentPlan = await PaymentPlan.findById(paymentPlanId)
    if (!paymentPlan) {
      return errorResponse(res, 'Payment plan not found', [], 404)
    }

    let record
    try {
      record = await createManualInstallmentRecord(paymentPlan, {
        paymentName, paymentDate, scheduledAmount, remainingAmount, paymentMethod, notes
      }, req.user._id)
    } catch (fieldError) {
      return errorResponse(res, fieldError.message)
    }

    // Manual entries add to the plan's total obligation
    paymentPlan.totalAmount += record.scheduled
    await paymentPlan.save()
    await updatePlanTotalsAfterManualEntries(paymentPlan)

    successResponse(res, { installment: record.installment, transaction: record.transaction, paymentPlan }, 'Payment added successfully', 201)
  } catch (error) {
    next(error)
  }
}

const normalizeImportHeader = (header) =>
  String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Bulk import payment schedule rows; each row targets a plan by invoice number
export const importPaymentSchedule = async (req, res, next) => {
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

    const results = { created: 0, failed: 0, errors: [] }
    const plansByInvoice = new Map()
    const scheduledByPlan = new Map()

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2
      const row = {}
      Object.entries(rows[i]).forEach(([key, value]) => {
        row[normalizeImportHeader(key)] = value
      })

      try {
        const invoiceNumber = String(row.invoicenumber || row.invoice || '').trim()
        if (!invoiceNumber) {
          throw new Error('Invoice Number is required')
        }

        let paymentPlan = plansByInvoice.get(invoiceNumber)
        if (paymentPlan === undefined) {
          paymentPlan = await PaymentPlan.findOne({ invoiceNumber })
          if (!paymentPlan) {
            plansByInvoice.set(invoiceNumber, null)
            throw new Error(`No payment plan found for invoice "${invoiceNumber}"`)
          }
          plansByInvoice.set(invoiceNumber, paymentPlan)
          scheduledByPlan.set(paymentPlan._id.toString(), 0)
        }
        if (!paymentPlan) {
          throw new Error(`No payment plan found for invoice "${invoiceNumber}"`)
        }

        const record = await createManualInstallmentRecord(paymentPlan, {
          paymentName: row.paymentname || row.name || row.payment,
          paymentDate: row.paymentdate || row.date || row.duedate,
          scheduledAmount: row.amount,
          remainingAmount: row.remaining,
          paymentMethod: row.paymentmethod || row.method,
          notes: row.notes,
        }, req.user._id)

        scheduledByPlan.set(paymentPlan._id.toString(), scheduledByPlan.get(paymentPlan._id.toString()) + record.scheduled)
        results.created++
      } catch (rowError) {
        results.failed++
        results.errors.push({ row: rowNumber, error: rowError.message })
      }
    }

    // Apply accumulated totals once per plan
    for (const [planId, scheduledTotal] of scheduledByPlan) {
      if (scheduledTotal <= 0) continue
      const paymentPlan = await PaymentPlan.findById(planId)
      if (!paymentPlan) continue
      paymentPlan.totalAmount += scheduledTotal
      await paymentPlan.save()
      await updatePlanTotalsAfterManualEntries(paymentPlan)
    }

    const message = `Import completed: ${results.created} created, ${results.failed} failed`
    successResponse(res, results, message)
  } catch (error) {
    next(error)
  }
}

// Get Payment History
export const getPaymentHistory = async (req, res, next) => {
  try {
    const { customer } = req.params
    
    const transactions = await PaymentTransaction.find({ customer })
      .populate('installment', 'paymentName installmentNumber')
      .populate('paymentPlan', 'invoiceNumber invoiceType')
      .populate('recordedBy', 'name')
      .sort({ transactionDate: -1 })
    
    successResponse(res, transactions)
  } catch (error) {
    next(error)
  }
}

// Update Payment Plan
export const updatePaymentPlan = async (req, res, next) => {
  try {
    const { id } = req.params
    const { paymentSchedule, emiDetails } = req.body
    
    const paymentPlan = await PaymentPlan.findById(id)
    if (!paymentPlan) {
      return errorResponse(res, 'Payment plan not found', [], 404)
    }
    
    // Don't allow updates if payments have been made
    const hasPayments = await PaymentTransaction.exists({ paymentPlan: id })
    if (hasPayments) {
      return errorResponse(res, 'Cannot update payment plan after payments have been made')
    }
    
    // Delete existing installments
    await PaymentInstallment.deleteMany({ paymentPlan: id })
    
    // Create new installments
    const installments = []
    if (paymentSchedule && paymentSchedule.length > 0) {
      for (let i = 0; i < paymentSchedule.length; i++) {
        const schedule = paymentSchedule[i]
        const installment = await PaymentInstallment.create({
          paymentPlan: paymentPlan._id,
          installmentNumber: i + 1,
          paymentName: schedule.paymentName || `Payment ${i + 1}`,
          paymentType: schedule.paymentType || 'other',
          scheduledAmount: schedule.amount,
          percentage: schedule.percentage,
          dueDate: schedule.dueDate,
          remainingAmount: schedule.amount,
          status: 'pending',
        })
        
        checkOverdueStatus(installment)
        await installment.save()
        
        installments.push(installment)
      }
    }
    
    // Update EMI details if provided
    if (emiDetails) {
      paymentPlan.emiDetails = emiDetails
    }
    
    await paymentPlan.save()
    
    successResponse(res, {
      paymentPlan,
      installments,
    }, 'Payment plan updated successfully')
  } catch (error) {
    next(error)
  }
}

// Delete Payment Plan
export const deletePaymentPlan = async (req, res, next) => {
  try {
    const { id } = req.params
    const force = req.query.force === 'true'

    const paymentPlan = await PaymentPlan.findById(id)
    if (!paymentPlan) {
      return errorResponse(res, 'Payment plan not found', [], 404)
    }

    // Check if payments have been made
    const hasPayments = await PaymentTransaction.exists({ paymentPlan: id })

    if (hasPayments && !force) {
      return errorResponse(res, 'Cannot delete payment plan after payments have been made. Use force delete to override.')
    }

    // If force deleting, also delete all payment transactions
    if (hasPayments && force) {
      await PaymentTransaction.deleteMany({ paymentPlan: id })
    }

    // Delete installments
    await PaymentInstallment.deleteMany({ paymentPlan: id })

    // Remove reference from invoice (clear on both models - a converted
    // proforma may also have an Invoice doc referencing this plan)
    await ProformaInvoice.findByIdAndUpdate(paymentPlan.invoiceId, { paymentPlan: null })
    await Invoice.findByIdAndUpdate(paymentPlan.invoiceId, { paymentPlan: null })

    // Delete payment plan
    await PaymentPlan.findByIdAndDelete(id)

    successResponse(res, null, 'Payment plan deleted successfully')
  } catch (error) {
    next(error)
  }
}

// Delete a payment transaction and reverse its effect on installment/plan totals
export const deletePaymentTransaction = async (req, res, next) => {
  try {
    const { id } = req.params

    const transaction = await PaymentTransaction.findById(id)
    if (!transaction) {
      return errorResponse(res, 'Transaction not found', [], 404)
    }

    const installment = await PaymentInstallment.findById(transaction.installment)
    const paymentPlan = await PaymentPlan.findById(transaction.paymentPlan)

    if (installment) {
      installment.amountPaid = Math.max(0, Math.round((installment.amountPaid - transaction.amount) * 100) / 100)
      installment.remainingAmount = Math.round((installment.remainingAmount + transaction.amount) * 100) / 100

      if (installment.amountPaid <= 0.01) {
        installment.status = 'pending'
        installment.paidDate = undefined
        installment.transactionId = undefined
      } else {
        installment.status = 'partial'
      }

      checkOverdueStatus(installment)
      await installment.save()
    }

    if (paymentPlan) {
      paymentPlan.totalPaid = Math.max(0, Math.round((paymentPlan.totalPaid - transaction.amount) * 100) / 100)
      paymentPlan.remainingAmount = Math.round((paymentPlan.remainingAmount + transaction.amount) * 100) / 100
      if (paymentPlan.status === 'completed') {
        paymentPlan.status = 'active'
      }
      await paymentPlan.save()
    }

    await PaymentTransaction.findByIdAndDelete(id)

    successResponse(res, null, 'Payment transaction deleted successfully')
  } catch (error) {
    next(error)
  }
}

// Get Customer Payment Summary
export const getCustomerPaymentSummary = async (req, res, next) => {
  try {
    const { customer } = req.params

    console.log('Fetching payment summary for customer:', customer)
    console.log('Customer ID type:', typeof customer)

    // Debug: Check all payment plans in database
    const allPaymentPlans = await PaymentPlan.find({})
    console.log('Total payment plans in database:', allPaymentPlans.length)
    console.log('All payment plans:', allPaymentPlans.map(p => ({
      _id: p._id,
      invoiceType: p.invoiceType,
      invoiceId: p.invoiceId,
      customer: p.customer,
      planType: p.planType,
      totalAmount: p.totalAmount
    })))

    // Get all payment plans for customer
    const paymentPlans = await PaymentPlan.find({ customer })

    console.log('Found payment plans for customer:', paymentPlans.length)
    console.log('Payment plans details:', paymentPlans.map(p => ({
      _id: p._id,
      invoiceType: p.invoiceType,
      invoiceId: p.invoiceId,
      customer: p.customer,
      planType: p.planType,
      totalAmount: p.totalAmount
    })))

    const planInvoiceIds = {
      proforma: paymentPlans.filter(p => p.invoiceType === 'proforma').map(p => p.invoiceId),
      invoice: paymentPlans.filter(p => p.invoiceType === 'invoice').map(p => p.invoiceId),
    }
    const [proformaInvoices, invoices] = await Promise.all([
      ProformaInvoice.find({ _id: { $in: planInvoiceIds.proforma } }).select('items'),
      Invoice.find({ _id: { $in: planInvoiceIds.invoice } }).select('items'),
    ])

    paymentPlans.forEach((plan) => {
      const sourceInvoices = plan.invoiceType === 'proforma' ? proformaInvoices : invoices
      const invoice = sourceInvoices.find(i => i._id.toString() === plan.invoiceId.toString())
      plan.set('invoiceItems', invoice?.items || [])
      plan.set('invoiceNumber', invoice?.invoiceNumber || '')
      plan.set('invoiceDate', invoice?.invoiceDate || null)
      plan.set('invoiceStatus', invoice?.status || '')
    })

    // Get all installments
    const installmentIds = paymentPlans.map(p => p._id)
    const installments = await PaymentInstallment.find({
      paymentPlan: { $in: installmentIds },
    })

    console.log('Found installments:', installments.length)

    // Check overdue status
    for (const installment of installments) {
      checkOverdueStatus(installment)
      await installment.save()
    }

    // Calculate summary
    const totalInvoiceAmount = paymentPlans.reduce((sum, p) => sum + p.totalAmount, 0)
    const totalPaid = paymentPlans.reduce((sum, p) => sum + p.totalPaid, 0)
    const totalRemaining = paymentPlans.reduce((sum, p) => sum + p.remainingAmount, 0)
    const pendingInstallments = installments.filter(inst => inst.status === 'pending').length
    const paidInstallments = installments.filter(inst => inst.status === 'paid').length
    const overdueInstallments = installments.filter(inst => inst.isOverdue).length

    // Get next payment
    const nextPayment = installments
      .filter(inst => inst.status === 'pending' && !inst.isOverdue)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]

    successResponse(res, {
      summary: {
        totalInvoiceAmount,
        totalPaid,
        totalRemaining,
        pendingInstallments,
        paidInstallments,
        overdueInstallments,
        nextPayment,
        progressPercentage: totalInvoiceAmount > 0 ? (totalPaid / totalInvoiceAmount) * 100 : 0,
      },
      paymentPlans,
      installments,
    })
  } catch (error) {
    console.error('Error in getCustomerPaymentSummary:', error)
    next(error)
  }
}
