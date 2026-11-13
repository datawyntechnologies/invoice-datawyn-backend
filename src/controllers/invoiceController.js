import Invoice from '../models/Invoice.js'
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js'
import { PDFService } from '../services/pdfService.js'
import { EmailService } from '../services/emailService.js'
import CompanySettings from '../models/CompanySettings.js'
import ProformaInvoice from '../models/ProformaInvoice.js'

export const getInvoices = async (req, res, next) => {
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
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('customer', 'companyName')
        .populate('proformaInvoice', 'invoiceNumber')
        .populate('paymentPlan')
        .populate('createdBy', 'name'),
      Invoice.countDocuments(query)
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

export const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'companyName')
      .populate('proformaInvoice', 'invoiceNumber')
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

export const downloadInvoicePDF = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'companyName email phone billingAddress gstin pan')
    
    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }
    
    console.log('Download PDF - Invoice found:', invoice.invoiceNumber)
    
    // Ensure customerSnapshot exists, if not, create it from customer data
    if (!invoice.customerSnapshot && invoice.customer) {
      invoice.customerSnapshot = {
        customerId: invoice.customer.customerId,
        companyName: invoice.customer.companyName,
        contactPerson: invoice.customer.contactPerson,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
        billingAddress: invoice.customer.billingAddress,
        gstin: invoice.customer.gstin,
        pan: invoice.customer.pan,
        state: invoice.customer.billingAddress?.state,
        stateCode: invoice.customer.billingAddress?.stateCode
      }
      console.log('Download PDF - Created customerSnapshot from customer data')
    }
    
    console.log('Download PDF - Invoice data structure:', {
      hasCustomerSnapshot: !!invoice.customerSnapshot,
      hasItems: !!invoice.items && invoice.items.length > 0,
      itemsCount: invoice.items?.length,
      customerSnapshot: invoice.customerSnapshot,
      invoiceItems: invoice.items?.map(item => ({
        hasProductSnapshot: !!item.productSnapshot,
        hasRate: !!item.rate,
        hasQuantity: !!item.quantity,
        productSnapshot: item.productSnapshot
      }))
    })
    
    const companySettings = await CompanySettings.findOne()
    console.log('Download PDF - Company settings found:', !!companySettings)
    console.log('Download PDF - Company settings:', {
      hasLogo: !!companySettings?.logo,
      hasAddress: !!companySettings?.address,
      hasPhone: !!companySettings?.phone,
      hasEmail: !!companySettings?.email,
      hasAuthorizedSignatory: !!companySettings?.authorizedSignatory
    })
    
    // Ensure invoice has required arrays to prevent errors
    const safeInvoice = {
      ...invoice.toObject(),
      items: invoice.items || []
    }
    
    // Use generateInvoice for regular invoices
    const pdfBuffer = await PDFService.generateInvoice(safeInvoice, companySettings)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (error) {
    console.error('PDF generation error:', error)
    console.error('Error message:', error.message)
    return errorResponse(res, `Failed to generate PDF: ${error.message}`, [], 500)
  }
}

export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }

    // Delete associated payment plan, installments and transactions if exists
    if (invoice.paymentPlan) {
      const PaymentPlan = (await import('../models/PaymentPlan.js')).default
      const PaymentInstallment = (await import('../models/PaymentInstallment.js')).default
      const PaymentTransaction = (await import('../models/PaymentTransaction.js')).default

      // Delete payment transactions first
      await PaymentTransaction.deleteMany({ paymentPlan: invoice.paymentPlan })

      // Delete payment installments
      await PaymentInstallment.deleteMany({ paymentPlan: invoice.paymentPlan })

      // Delete payment plan
      await PaymentPlan.findByIdAndDelete(invoice.paymentPlan)
    }

    // If this invoice was converted from a proforma invoice, update the proforma invoice
    if (invoice.proformaInvoice) {
      await ProformaInvoice.findByIdAndUpdate(invoice.proformaInvoice, {
        convertedInvoice: null,
        status: 'draft'
      })
    }

    await Invoice.findByIdAndDelete(req.params.id)

    successResponse(res, null, 'Invoice deleted successfully')
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
    
    const result = await EmailService.sendInvoice(req.params.id, { email, message })
    
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
    
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer', 'companyName')
    
    if (!invoice) {
      return errorResponse(res, 'Invoice not found', [], 404)
    }
    
    const companySettings = await CompanySettings.findOne()
    
    const result = await EmailService.sendInvoiceWithCustomPDF(req.params.id, {
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
