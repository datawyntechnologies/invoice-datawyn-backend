import ProformaInvoice from '../models/ProformaInvoice.js'
import Customer from '../models/Customer.js'
import CompanySettings from '../models/CompanySettings.js'
import { generateProformaInvoiceNumber } from '../utils/generateInvoiceNumber.js'
import { CalculationService } from '../services/calculationService.js'
import { PDFService } from '../services/pdfService.js'
import { EmailService } from '../services/emailService.js'
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js'
import PaymentPlanService from '../services/paymentPlanService.js'
import { createPaymentPlan } from './paymentController.js'

export const getProformaInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, customer } = req.query
    
    const query = {}
    
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customerSnapshot.companyName': { $regex: search, $options: 'i' } }
      ]
    }
    
    if (status) {
      query.status = status
    }
    
    if (customer) {
      query.customer = customer
    }
    
    const skip = (page - 1) * limit
    
    const [invoices, total] = await Promise.all([
      ProformaInvoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('customer', 'companyName')
        .populate('paymentPlan')
        .populate('createdBy', 'name'),
      ProformaInvoice.countDocuments(query)
    ])
    
    paginatedResponse(res, invoices, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  } catch (error) {
    next(error)
  }
}

export const getProformaInvoice = async (req, res, next) => {
  try {
    const invoice = await ProformaInvoice.findById(req.params.id)
      .populate('customer', 'companyName')
      .populate('paymentPlan')
      .populate('createdBy', 'name')

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }

    successResponse(res, invoice)
  } catch (error) {
    next(error)
  }
}

export const createProformaInvoice = async (req, res, next) => {
  try {
    const { customer, items, paymentPlan, ...invoiceData } = req.body
    
    // Validate customer
    if (!customer) {
      return errorResponse(res, 'Customer is required')
    }
    
    if (!items || items.length === 0) {
      return errorResponse(res, 'At least one item is required')
    }
    
    const customerDoc = await Customer.findById(customer)
    if (!customerDoc) {
      return errorResponse(res, 'Customer not found')
    }
    
    // Get company settings for state code
    const companySettings = await CompanySettings.findOne()
    const companyStateCode = companySettings?.address?.stateCode || ''
    
    // Create customer snapshot
    const customerSnapshot = {
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
    }
    
    // Prepare items with product snapshots
    const itemsWithSnapshots = await Promise.all(items.map(async (item) => {
      const Product = (await import('../models/Product.js')).default
      const product = await Product.findById(item.product)
      
      // Ensure numeric values are valid with fallbacks
      const quantity = Math.max(1, parseFloat(item.quantity) || 1)
      const rate = Math.max(0, parseFloat(item.rate) || 0)
      const discount = Math.max(0, parseFloat(item.discount) || 0)
      const gstRate = Math.max(0, Math.min(100, parseFloat(item.gstRate) || 18))
      
      console.log('Item calculation:', { quantity, rate, discount, gstRate })
      
      return {
        ...item,
        quantity,
        rate,
        discount,
        gstRate,
        productSnapshot: {
          code: product?.code || '',
          name: product?.name || '',
          description: product?.description || '',
          unit: product?.unit || '',
          hsnSacCode: product?.hsnSacCode || ''
        },
        customerStateCode: customerDoc.billingAddress?.stateCode || ''
      }
    }))
    
    // Calculate invoice totals
    const calculations = CalculationService.calculateInvoice(
      { items: itemsWithSnapshots, ...invoiceData, enableGST: invoiceData.enableGST !== undefined ? invoiceData.enableGST : true },
      companyStateCode
    )
    
    // Generate invoice number
    const prefix = companySettings?.invoiceSettings?.prefix || 'PI'
    const invoiceNumber = await generateProformaInvoiceNumber(prefix)
    
    // Create invoice
    const invoice = await ProformaInvoice.create({
      invoiceNumber,
      customer,
      customerSnapshot,
      items: calculations.items,
      subtotal: calculations.subtotal,
      itemDiscount: calculations.itemDiscount,
      invoiceDiscount: calculations.invoiceDiscount,
      taxableAmount: calculations.taxableAmount,
      cgst: calculations.cgst,
      sgst: calculations.sgst,
      igst: calculations.igst,
      totalTax: calculations.totalTax,
      roundOff: calculations.roundOff,
      grandTotal: calculations.grandTotal,
      amountInWords: calculations.amountInWords,
      createdBy: req.user._id,
      ...invoiceData
    })
    
    // Create payment plan if provided
    if (paymentPlan && paymentPlan.planType) {
      try {
        const PaymentPlan = (await import('../models/PaymentPlan.js')).default
        const PaymentInstallment = (await import('../models/PaymentInstallment.js')).default

        console.log('Creating payment plan with data:', {
          planType: paymentPlan.planType,
          paymentMethod: paymentPlan.paymentMethod,
          totalAmount: calculations.grandTotal,
          hasPaymentSchedule: !!paymentPlan.paymentSchedule,
          hasEmiDetails: !!paymentPlan.emiDetails,
          hasBalanceDueDate: !!paymentPlan.balanceDueDate,
          customer: customer,
          customerType: typeof customer
        })

        // Map custom_payment to the appropriate subtype for database storage
        let dbPlanType = paymentPlan.planType
        if (paymentPlan.planType === 'custom_payment') {
          if (!paymentPlan.paymentMethod) {
            return errorResponse(res, 'Payment method is required for custom payment plans')
          }
          if (paymentPlan.paymentMethod === 'fixed_amount') {
            dbPlanType = 'custom_fixed'
          } else if (paymentPlan.paymentMethod === 'percentage_based') {
            dbPlanType = 'custom_percentage'
          } else if (paymentPlan.paymentMethod === 'emi') {
            dbPlanType = 'emi'
          } else {
            return errorResponse(res, `Invalid payment method: ${paymentPlan.paymentMethod}`)
          }
        }

        const paymentSchedule = PaymentPlanService.generatePaymentSchedule(
          paymentPlan.planType,
          paymentPlan.paymentMethod,
          calculations.grandTotal,
          {
            invoiceDate: invoiceData.invoiceDate,
            paymentSchedule: paymentPlan.paymentSchedule,
            emiDetails: paymentPlan.emiDetails,
            balanceDueDate: paymentPlan.balanceDueDate,
            recurringDetails: paymentPlan.recurringDetails,
          }
        )

        console.log('Generated payment schedule:', paymentSchedule)

        // Validate payment schedule (allow past dates, consistent with updates)
        // Recurring plans are open-ended, so installments don't need to sum to the invoice total
        const expectedTotal = paymentPlan.planType === 'recurring'
          ? paymentSchedule.reduce((sum, item) => sum + (item.amount || 0), 0)
          : calculations.grandTotal
        const validation = PaymentPlanService.validatePaymentSchedule(paymentSchedule, expectedTotal, true)
        if (!validation.valid) {
          console.error('Payment schedule validation failed:', validation.error)
          return errorResponse(res, validation.error)
        }

        // Create payment plan
        console.log('Creating payment plan with customer:', customer)
        console.log('Customer ID type:', typeof customer)
        console.log('Using planType for DB:', dbPlanType, '(original:', paymentPlan.planType + ')')

        const newPaymentPlan = await PaymentPlan.create({
          invoiceType: 'proforma',
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          customer,
          planType: dbPlanType,
          ...(paymentPlan.paymentMethod && { paymentMethod: paymentPlan.paymentMethod }),
          totalAmount: calculations.grandTotal,
          remainingAmount: calculations.grandTotal,
          emiDetails: paymentPlan.emiDetails,
          ...(paymentPlan.recurringDetails && { recurringDetails: paymentPlan.recurringDetails }),
          createdBy: req.user._id,
        })

        console.log('Created payment plan:', newPaymentPlan._id)
        console.log('Payment plan customer field:', newPaymentPlan.customer)

        // Create installments
        for (let i = 0; i < paymentSchedule.length; i++) {
          const schedule = paymentSchedule[i]
          await PaymentInstallment.create({
            paymentPlan: newPaymentPlan._id,
            installmentNumber: i + 1,
            paymentName: schedule.paymentName,
            paymentType: schedule.paymentType,
            scheduledAmount: schedule.amount,
            percentage: schedule.percentage,
            dueDate: schedule.dueDate,
            remainingAmount: schedule.amount,
            status: 'pending',
          })
        }

        console.log('Created installments for payment plan:', newPaymentPlan._id)

        // Update invoice with payment plan reference
        invoice.paymentPlan = newPaymentPlan._id
        await invoice.save()

        console.log('Updated invoice with payment plan reference')
      } catch (paymentError) {
        console.error('Payment plan creation failed:', paymentError)
        console.error('Error stack:', paymentError.stack)
        // Return error instead of continuing silently
        return errorResponse(res, `Failed to create payment plan: ${paymentError.message}`)
      }
    }
    
    successResponse(res, invoice, 'Proforma invoice created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateProformaInvoice = async (req, res, next) => {
  try {
    const { customer, items, paymentPlan, ...invoiceData } = req.body

    const invoice = await ProformaInvoice.findById(req.params.id)
    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }

    // Get company settings
    const companySettings = await CompanySettings.findOne()
    const companyStateCode = companySettings?.address?.stateCode || ''

    // Recalculate if items provided
    let calculations
    if (items && items.length > 0) {
      const customerDoc = await Customer.findById(customer || invoice.customer)
      const customerSnapshot = {
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
      }

      const itemsWithSnapshots = await Promise.all(items.map(async (item) => {
        const Product = (await import('../models/Product.js')).default
        const product = await Product.findById(item.product)

        return {
          ...item,
          productSnapshot: {
            code: product?.code,
            name: product?.name,
            description: product?.description,
            unit: product?.unit,
            hsnSacCode: product?.hsnSacCode
          },
          customerStateCode: customerDoc.billingAddress?.stateCode
        }
      }))

      calculations = CalculationService.calculateInvoice(
        { items: itemsWithSnapshots, ...invoiceData, enableGST: invoiceData.enableGST !== undefined ? invoiceData.enableGST : true },
        companyStateCode
      )
    }

    const updateData = calculations ? {
      items: calculations.items,
      subtotal: calculations.subtotal,
      itemDiscount: calculations.itemDiscount,
      invoiceDiscount: calculations.invoiceDiscount,
      taxableAmount: calculations.taxableAmount,
      cgst: calculations.cgst,
      sgst: calculations.sgst,
      igst: calculations.igst,
      totalTax: calculations.totalTax,
      roundOff: calculations.roundOff,
      grandTotal: calculations.grandTotal,
      amountInWords: calculations.amountInWords,
      ...invoiceData
    } : invoiceData

    const updatedInvoice = await ProformaInvoice.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('customer', 'companyName')
     .populate('paymentPlan')

    // Handle payment plan update
    if (paymentPlan && paymentPlan.planType) {
      try {
        const PaymentPlan = (await import('../models/PaymentPlan.js')).default
        const PaymentInstallment = (await import('../models/PaymentInstallment.js')).default

        // If there's an existing payment plan, update it
        if (invoice.paymentPlan) {
          const paymentSchedule = PaymentPlanService.generatePaymentSchedule(
            paymentPlan.planType,
            paymentPlan.paymentMethod,
            calculations?.grandTotal || invoice.grandTotal,
            {
              invoiceDate: invoiceData.invoiceDate || invoice.invoiceDate,
              paymentSchedule: paymentPlan.paymentSchedule,
              emiDetails: paymentPlan.emiDetails,
              balanceDueDate: paymentPlan.balanceDueDate,
              recurringDetails: paymentPlan.recurringDetails,
            }
          )

          // Validate payment schedule (allow past dates for updates)
          // Recurring plans are open-ended, so installments don't need to sum to the invoice total
          const invoiceTotal = calculations?.grandTotal || invoice.grandTotal
          const expectedTotal = paymentPlan.planType === 'recurring'
            ? paymentSchedule.reduce((sum, item) => sum + (item.amount || 0), 0)
            : invoiceTotal
          const validation = PaymentPlanService.validatePaymentSchedule(paymentSchedule, expectedTotal, true)
          if (!validation.valid) {
            return errorResponse(res, validation.error)
          }

          // Update payment plan
          await PaymentPlan.findByIdAndUpdate(invoice.paymentPlan, {
            planType: paymentPlan.planType,
            paymentMethod: paymentPlan.paymentMethod,
            totalAmount: invoiceTotal,
            emiDetails: paymentPlan.emiDetails,
            recurringDetails: paymentPlan.recurringDetails,
          })

          // Delete existing installments and create new ones
          await PaymentInstallment.deleteMany({ paymentPlan: invoice.paymentPlan })
          for (let i = 0; i < paymentSchedule.length; i++) {
            const schedule = paymentSchedule[i]
            await PaymentInstallment.create({
              paymentPlan: invoice.paymentPlan,
              installmentNumber: i + 1,
              paymentName: schedule.paymentName,
              paymentType: schedule.paymentType,
              scheduledAmount: schedule.amount,
              percentage: schedule.percentage,
              dueDate: schedule.dueDate,
              remainingAmount: schedule.amount,
              status: 'pending',
            })
          }
        } else {
          // Create new payment plan
          const invoiceTotal = calculations?.grandTotal || invoice.grandTotal
          const paymentSchedule = PaymentPlanService.generatePaymentSchedule(
            paymentPlan.planType,
            paymentPlan.paymentMethod,
            invoiceTotal,
            {
              invoiceDate: invoiceData.invoiceDate || invoice.invoiceDate,
              paymentSchedule: paymentPlan.paymentSchedule,
              emiDetails: paymentPlan.emiDetails,
              balanceDueDate: paymentPlan.balanceDueDate,
              recurringDetails: paymentPlan.recurringDetails,
            }
          )

          // Validate payment schedule (allow past dates for updates)
          // Recurring plans are open-ended, so installments don't need to sum to the invoice total
          const expectedTotal = paymentPlan.planType === 'recurring'
            ? paymentSchedule.reduce((sum, item) => sum + (item.amount || 0), 0)
            : invoiceTotal
          const validation = PaymentPlanService.validatePaymentSchedule(paymentSchedule, expectedTotal, true)
          if (!validation.valid) {
            return errorResponse(res, validation.error)
          }

          // Map custom_payment to the appropriate subtype for database storage
          let dbPlanType = paymentPlan.planType
          if (paymentPlan.planType === 'custom_payment') {
            if (!paymentPlan.paymentMethod) {
              return errorResponse(res, 'Payment method is required for custom payment plans')
            }
            if (paymentPlan.paymentMethod === 'fixed_amount') {
              dbPlanType = 'custom_fixed'
            } else if (paymentPlan.paymentMethod === 'percentage_based') {
              dbPlanType = 'custom_percentage'
            } else if (paymentPlan.paymentMethod === 'emi') {
              dbPlanType = 'emi'
            } else {
              return errorResponse(res, `Invalid payment method: ${paymentPlan.paymentMethod}`)
            }
          }

          // Create payment plan
          const newPaymentPlan = await PaymentPlan.create({
            invoiceType: 'proforma',
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            customer: invoice.customer,
            planType: dbPlanType,
            ...(paymentPlan.paymentMethod && { paymentMethod: paymentPlan.paymentMethod }),
            totalAmount: invoiceTotal,
            remainingAmount: invoiceTotal,
            emiDetails: paymentPlan.emiDetails,
            ...(paymentPlan.recurringDetails && { recurringDetails: paymentPlan.recurringDetails }),
            createdBy: req.user._id,
          })

          // Create installments
          for (let i = 0; i < paymentSchedule.length; i++) {
            const schedule = paymentSchedule[i]
            await PaymentInstallment.create({
              paymentPlan: newPaymentPlan._id,
              installmentNumber: i + 1,
              paymentName: schedule.paymentName,
              paymentType: schedule.paymentType,
              scheduledAmount: schedule.amount,
              percentage: schedule.percentage,
              dueDate: schedule.dueDate,
              remainingAmount: schedule.amount,
              status: 'pending',
            })
          }

          // Update invoice with payment plan reference
          updatedInvoice.paymentPlan = newPaymentPlan._id
          await updatedInvoice.save()
        }
      } catch (paymentError) {
        console.error('Payment plan update failed:', paymentError)
        // Continue without payment plan if it fails
      }
    }

    successResponse(res, updatedInvoice, 'Proforma invoice updated successfully')
  } catch (error) {
    next(error)
  }
}

export const deleteProformaInvoice = async (req, res, next) => {
  try {
    const invoice = await ProformaInvoice.findById(req.params.id)

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }

    // Delete associated payment plan and installments if exists
    if (invoice.paymentPlan) {
      const PaymentPlan = (await import('../models/PaymentPlan.js')).default
      const PaymentInstallment = (await import('../models/PaymentInstallment.js')).default

      // Delete payment installments first
      await PaymentInstallment.deleteMany({ paymentPlan: invoice.paymentPlan })

      // Delete payment plan
      await PaymentPlan.findByIdAndDelete(invoice.paymentPlan)
    }

    // Delete the invoice
    await ProformaInvoice.findByIdAndDelete(req.params.id)

    successResponse(res, null, 'Proforma invoice deleted successfully')
  } catch (error) {
    next(error)
  }
}

export const duplicateProformaInvoice = async (req, res, next) => {
  try {
    const originalInvoice = await ProformaInvoice.findById(req.params.id)
    
    if (!originalInvoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }
    
    // Generate new invoice number
    const companySettings = await CompanySettings.findOne()
    const prefix = companySettings?.invoiceSettings?.prefix || 'PI'
    const invoiceNumber = await generateProformaInvoiceNumber(prefix)
    
    // Create duplicate
    const duplicate = await ProformaInvoice.create({
      ...originalInvoice.toObject(),
      _id: undefined,
      invoiceNumber,
      invoiceDate: new Date(),
      validUntil: null,
      status: 'draft',
      createdBy: req.user._id,
      convertedInvoice: null,
      statusHistory: []
    })
    
    successResponse(res, duplicate, 'Proforma invoice duplicated successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    
    const invoice = await ProformaInvoice.findById(req.params.id)
    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }
    
    // Add to status history
    invoice.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date()
    })
    
    invoice.status = status
    await invoice.save()
    
    successResponse(res, invoice, 'Invoice status updated successfully')
  } catch (error) {
    next(error)
  }
}

export const downloadPDF = async (req, res, next) => {
  try {
    const invoice = await ProformaInvoice.findById(req.params.id)
      .populate('customer', 'companyName')
    
    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }
    
    const companySettings = await CompanySettings.findOne()
    
    // Ensure invoice has required arrays to prevent errors
    const safeInvoice = {
      ...invoice.toObject(),
      items: invoice.items || []
    }
    
    const pdfBuffer = await PDFService.generateProformaInvoice(safeInvoice, companySettings)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (error) {
    console.error('PDF generation error:', error)
    console.error('Error message:', error.message)
    return errorResponse(res, `Failed to generate PDF: ${error.message}`, [], 500)
  }
}

export const convertToInvoice = async (req, res, next) => {
  try {
    const proformaInvoice = await ProformaInvoice.findById(req.params.id)

    if (!proformaInvoice) {
      return errorResponse(res, 'Proforma invoice not found', [], 404)
    }

    if (proformaInvoice.convertedInvoice) {
      return errorResponse(res, 'This invoice has already been converted')
    }

    const Invoice = (await import('../models/Invoice.js')).default
    const { generateInvoiceNumber } = await import('../utils/generateInvoiceNumber.js')

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber('INV')

    // Create final invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      invoiceDate: new Date(),
      enableGST: proformaInvoice.enableGST,
      proformaInvoice: proformaInvoice._id,
      customer: proformaInvoice.customer,
      customerSnapshot: proformaInvoice.customerSnapshot,
      items: proformaInvoice.items,
      subtotal: proformaInvoice.subtotal,
      itemDiscount: proformaInvoice.itemDiscount,
      invoiceDiscount: proformaInvoice.invoiceDiscount,
      taxableAmount: proformaInvoice.taxableAmount,
      cgst: proformaInvoice.cgst,
      sgst: proformaInvoice.sgst,
      igst: proformaInvoice.igst,
      totalTax: proformaInvoice.totalTax,
      roundOff: proformaInvoice.roundOff,
      grandTotal: proformaInvoice.grandTotal,
      amountInWords: proformaInvoice.amountInWords,
      paymentTerms: proformaInvoice.paymentTerms,
      paymentMethod: proformaInvoice.paymentMethod,
      advanceAmount: proformaInvoice.advanceAmount,
      balanceAmount: proformaInvoice.balanceAmount,
      dueDate: proformaInvoice.dueDate,
      notes: proformaInvoice.notes,
      termsAndConditions: proformaInvoice.termsAndConditions,
      createdBy: req.user._id,
      status: 'sent'
    })

    // Update payment plan if exists
    if (proformaInvoice.paymentPlan) {
      const PaymentPlan = (await import('../models/PaymentPlan.js')).default
      await PaymentPlan.findByIdAndUpdate(
        proformaInvoice.paymentPlan,
        {
          invoiceType: 'invoice',
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber
        }
      )
      // Copy payment plan reference to invoice
      invoice.paymentPlan = proformaInvoice.paymentPlan
      await invoice.save()
    }

    // Update proforma invoice
    proformaInvoice.convertedInvoice = invoice._id
    proformaInvoice.status = 'converted'
    proformaInvoice.statusHistory.push({
      status: 'converted',
      changedBy: req.user._id,
      changedAt: new Date()
    })
    await proformaInvoice.save()

    successResponse(res, invoice, 'Invoice converted successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const sendEmail = async (req, res, next) => {
  try {
    const { email, emailType, message } = req.body
    
    if (!email) {
      return errorResponse(res, 'Email is required')
    }
    
    const result = await EmailService.sendProformaInvoice(req.params.id, { email, message })
    
    successResponse(res, null, result.message)
  } catch (error) {
    next(error)
  }
}

export const sendEmailWithPDF = async (req, res, next) => {
  try {
    const { email, message } = req.body
    
    if (!email) {
      return errorResponse(res, 'Email is required')
    }
    
    if (!req.file) {
      return errorResponse(res, 'PDF file is required')
    }
    
    const invoice = await ProformaInvoice.findById(req.params.id)
      .populate('customer', 'companyName')
    
    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }
    
    const companySettings = await CompanySettings.findOne()
    
    const result = await EmailService.sendProformaInvoiceWithCustomPDF(req.params.id, {
      email,
      message,
      pdfBuffer: req.file.buffer,
      invoice,
      companySettings
    })
    
    successResponse(res, null, result.message)
  } catch (error) {
    next(error)
  }
}
