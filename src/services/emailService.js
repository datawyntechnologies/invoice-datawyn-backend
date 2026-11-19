import nodemailer from 'nodemailer'
import { PDFService } from './pdfService.js'
import CompanySettings from '../models/CompanySettings.js'
import ProformaInvoice from '../models/ProformaInvoice.js'
import Invoice from '../models/Invoice.js'

// Create transporter (will be configured based on environment)
let transporter = null

const initializeTransporter = () => {
  if (transporter) return transporter

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email credentials are missing from environment variables')
  }

  const config = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  }

  transporter = nodemailer.createTransport(config)
  return transporter
}

export const EmailService = {
  async sendProformaInvoice(invoiceId, emailData) {
    try {
      console.log('Starting proforma email send for invoice:', invoiceId)
      
      const invoice = await ProformaInvoice.findById(invoiceId)
        .populate('customer', 'companyName')
      
      if (!invoice) {
        throw new Error('Invoice not found')
      }

      console.log('Proforma invoice found:', invoice.invoiceNumber)
      
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
        console.log('Created customerSnapshot from customer data')
      }
      
      console.log('Proforma invoice data structure:', {
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
      console.log('Proforma - Company settings found:', !!companySettings)
      console.log('Proforma - Company settings:', {
        hasLogo: !!companySettings?.logo,
        hasAddress: !!companySettings?.address,
        hasPhone: !!companySettings?.phone,
        hasEmail: !!companySettings?.email,
        hasAuthorizedSignatory: !!companySettings?.authorizedSignatory
      })
      
      // Generate PDF
      console.log('Generating proforma PDF...')
      const pdfBuffer = await PDFService.generateProformaInvoice(invoice, companySettings)
      console.log('Proforma PDF generated successfully, size:', pdfBuffer.length)

      const transporter = initializeTransporter()
      
      // Verify connection before sending
      try {
        await transporter.verify()
      } catch (verifyError) {
        console.error('Email transporter verification failed:', verifyError)
        throw new Error('Email service connection failed: ' + verifyError.message)
      }
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || companySettings?.email || 'noreply@datawyn.com',
        to: emailData.email,
        subject: `Proforma Invoice ${invoice.invoiceNumber} from ${companySettings?.companyName || 'Datawyn Technologies'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%); padding: 30px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
              .header .subtitle { color: #cccccc; margin-top: 10px; font-size: 14px; }
              .content { padding: 30px; }
              .greeting { color: #333333; font-size: 16px; margin-bottom: 20px; }
              .invoice-box { background-color: #f9f9f9; border-left: 4px solid #2d2d2d; padding: 20px; margin: 20px 0; border-radius: 4px; }
              .invoice-box h3 { color: #2d2d2d; margin: 0 0 15px 0; font-size: 18px; }
              .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
              .detail-item { color: #666666; font-size: 14px; }
              .detail-item strong { color: #333333; }
              .total-amount { background-color: #2d2d2d; color: #ffffff; padding: 15px; text-align: center; border-radius: 4px; margin-top: 20px; }
              .total-amount .label { font-size: 14px; opacity: 0.9; }
              .total-amount .amount { font-size: 24px; font-weight: bold; margin-top: 5px; }
              .message { color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0; font-style: italic; }
              .footer { background-color: #2d2d2d; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
              .footer a { color: #ffffff; text-decoration: none; }
              .attachment-notice { background-color: #e8f4f8; border: 1px solid #b8daff; color: #004085; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
              .attachment-notice strong { display: block; margin-bottom: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>PROFORMA INVOICE</h1>
                <div class="subtitle">${companySettings?.companyName || 'Datawyn Technologies'}</div>
              </div>
              
              <div class="content">
                <p class="greeting">Dear ${invoice.customerSnapshot?.contactPerson || 'Valued Customer'},</p>
                
                <p style="color: #333333; font-size: 15px; line-height: 1.6;">
                  Please find attached the proforma invoice <strong>${invoice.invoiceNumber}</strong> for your review.
                </p>
                
                <div class="invoice-box">
                  <h3>📋 Invoice Details</h3>
                  <div class="invoice-details">
                    <div class="detail-item"><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
                    <div class="detail-item"><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div class="detail-item"><strong>Valid Until:</strong> ${invoice.validUntil ? new Date(invoice.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</div>
                    <div class="detail-item"><strong>Payment Method:</strong> ${invoice.paymentMethod || 'Bank Transfer'}</div>
                  </div>
                  
                  <div class="total-amount">
                    <div class="label">Total Amount</div>
                    <div class="amount">₹${(invoice.grandTotal || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div class="attachment-notice">
                  <strong>📎 PDF Invoice Attached</strong>
                  The detailed invoice PDF is attached to this email for your records.
                </div>
                
                ${emailData.message ? `<div class="message">"${emailData.message}"</div>` : ''}
                
                <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                  Please review the attached invoice and let us know if you have any questions or require any modifications.
                </p>
                
                <p style="color: #333333; font-size: 15px; margin-top: 20px;">
                  Best regards,<br>
                  <strong>${companySettings?.companyName || 'Datawyn Technologies'}</strong>
                </p>
              </div>
              
              <div class="footer">
                <p>${companySettings?.companyName || 'Datawyn Technologies'}</p>
                ${companySettings?.address ? `<p>${[companySettings.address.street, companySettings.address.city, companySettings.address.state].filter(Boolean).join(', ')}</p>` : ''}
                ${companySettings?.phone ? `<p>📞 ${companySettings.phone}</p>` : ''}
                ${companySettings?.email ? `<p>✉️ ${companySettings.email}</p>` : ''}
                ${companySettings?.website ? `<p>🌐 <a href="https://${companySettings.website}">${companySettings.website}</a></p>` : ''}
              </div>
            </div>
          </body>
          </html>
        `,
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      }

      await transporter.sendMail(mailOptions)
      
      // Update invoice status to sent
      invoice.status = 'sent'
      invoice.statusHistory.push({
        status: 'sent',
        changedAt: new Date()
      })
      await invoice.save()

      return { success: true, message: 'Invoice sent successfully' }
    } catch (error) {
      console.error('Email sending error:', error)
      throw new Error('Failed to send email: ' + error.message)
    }
  },

  async sendInvoice(invoiceId, emailData) {
    try {
      console.log('Starting email send for invoice:', invoiceId)
      
      const invoice = await Invoice.findById(invoiceId)
        .populate('customer', 'companyName email phone billingAddress')
        .populate('proformaInvoice', 'invoiceNumber')
      
      if (!invoice) {
        throw new Error('Invoice not found')
      }

      console.log('Invoice found:', invoice.invoiceNumber)
      
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
        console.log('Created customerSnapshot from customer data')
      }
      
      console.log('Invoice data structure:', {
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
      console.log('Company settings found:', !!companySettings)
      console.log('Company settings:', {
        hasLogo: !!companySettings?.logo,
        hasAddress: !!companySettings?.address,
        hasPhone: !!companySettings?.phone,
        hasEmail: !!companySettings?.email,
        hasAuthorizedSignatory: !!companySettings?.authorizedSignatory
      })
      
      // Generate PDF
      console.log('Generating PDF...')
      const pdfBuffer = await PDFService.generateInvoice(invoice, companySettings)
      console.log('PDF generated successfully, size:', pdfBuffer.length)

      const transporter = initializeTransporter()
      
      // Verify connection before sending
      try {
        await transporter.verify()
        console.log('Email transporter verified successfully')
      } catch (verifyError) {
        console.error('Email transporter verification failed:', verifyError)
        throw new Error('Email service connection failed: ' + verifyError.message)
      }
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || companySettings?.email || 'noreply@datawyn.com',
        to: emailData.email,
        subject: `Invoice ${invoice.invoiceNumber} from ${companySettings?.companyName || 'Datawyn Technologies'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%); padding: 30px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
              .header .subtitle { color: #cccccc; margin-top: 10px; font-size: 14px; }
              .content { padding: 30px; }
              .greeting { color: #333333; font-size: 16px; margin-bottom: 20px; }
              .invoice-box { background-color: #f9f9f9; border-left: 4px solid #2d2d2d; padding: 20px; margin: 20px 0; border-radius: 4px; }
              .invoice-box h3 { color: #2d2d2d; margin: 0 0 15px 0; font-size: 18px; }
              .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
              .detail-item { color: #666666; font-size: 14px; }
              .detail-item strong { color: #333333; }
              .total-amount { background-color: #2d2d2d; color: #ffffff; padding: 15px; text-align: center; border-radius: 4px; margin-top: 20px; }
              .total-amount .label { font-size: 14px; opacity: 0.9; }
              .total-amount .amount { font-size: 24px; font-weight: bold; margin-top: 5px; }
              .message { color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0; font-style: italic; }
              .footer { background-color: #2d2d2d; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
              .footer a { color: #ffffff; text-decoration: none; }
              .attachment-notice { background-color: #e8f4f8; border: 1px solid #b8daff; color: #004085; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
              .attachment-notice strong { display: block; margin-bottom: 5px; }
              .proforma-ref { background-color: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 10px; border-radius: 4px; margin: 15px 0; text-align: center; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>TAX INVOICE</h1>
                <div class="subtitle">${companySettings?.companyName || 'Datawyn Technologies'}</div>
              </div>
              
              <div class="content">
                <p class="greeting">Dear ${invoice.customerSnapshot?.contactPerson || 'Valued Customer'},</p>
                
                <p style="color: #333333; font-size: 15px; line-height: 1.6;">
                  Please find attached the tax invoice <strong>${invoice.invoiceNumber}</strong> for your records.
                </p>
                
                ${invoice.proformaInvoice ? `<div class="proforma-ref">📋 Reference: Proforma Invoice ${invoice.proformaInvoice.invoiceNumber}</div>` : ''}
                
                <div class="invoice-box">
                  <h3>📋 Invoice Details</h3>
                  <div class="invoice-details">
                    <div class="detail-item"><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
                    <div class="detail-item"><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div class="detail-item"><strong>Payment Method:</strong> ${invoice.paymentMethod || 'Bank Transfer'}</div>
                    <div class="detail-item"><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</div>
                  </div>
                  
                  <div class="total-amount">
                    <div class="label">Total Amount</div>
                    <div class="amount">₹${(invoice.grandTotal || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div class="attachment-notice">
                  <strong>📎 PDF Invoice Attached</strong>
                  The detailed invoice PDF is attached to this email for your records.
                </div>
                
                ${emailData.message ? `<div class="message">"${emailData.message}"</div>` : ''}
                
                <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                  Please review the attached invoice and let us know if you have any questions.
                </p>
                
                <p style="color: #333333; font-size: 15px; margin-top: 20px;">
                  Best regards,<br>
                  <strong>${companySettings?.companyName || 'Datawyn Technologies'}</strong>
                </p>
              </div>
              
              <div class="footer">
                <p>${companySettings?.companyName || 'Datawyn Technologies'}</p>
                ${companySettings?.address ? `<p>${[companySettings.address.street, companySettings.address.city, companySettings.address.state].filter(Boolean).join(', ')}</p>` : ''}
                ${companySettings?.phone ? `<p>📞 ${companySettings.phone}</p>` : ''}
                ${companySettings?.email ? `<p>✉️ ${companySettings.email}</p>` : ''}
                ${companySettings?.website ? `<p>🌐 <a href="https://${companySettings.website}">${companySettings.website}</a></p>` : ''}
              </div>
            </div>
          </body>
          </html>
        `,
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      }

      console.log('Sending email to:', emailData.email)
      await transporter.sendMail(mailOptions)
      console.log('Email sent successfully')
      
      // Update invoice status to sent
      invoice.status = 'sent'
      // Add to status history if the field exists
      if (invoice.statusHistory) {
        invoice.statusHistory.push({
          status: 'sent',
          changedAt: new Date()
        })
      }
      await invoice.save()

      return { success: true, message: 'Invoice sent successfully' }
    } catch (error) {
      console.error('Email sending error:', error)
      throw new Error('Failed to send email: ' + error.message)
    }
  },

  testConnection() {
    try {
      const transporter = initializeTransporter()
      return transporter.verify()
    } catch (error) {
      throw new Error('Email connection test failed: ' + error.message)
    }
  },

  async sendProposal(proposal, emailData, pdfBuffer, companySettings, theme, shareUrl) {
    const transporter = initializeTransporter()
    await transporter.verify()
    const clientName = proposal.customerSnapshot?.contactPerson || proposal.customerSnapshot?.companyName || 'Valued Client'
    const message = emailData.message || `Dear ${clientName},\n\nGreetings from Datawyn Technologies!\n\nPlease find attached our project proposal for ${proposal.projectTitle}.\n\nThe document includes the project overview, objectives, scope of work, deliverables, project timeline, pricing, and payment terms.\n\nKindly review the proposal and let us know if you have any questions or modifications.\n\nWe look forward to working with you.\n\nBest Regards,\nDatawyn Technologies\nDigital Solutions That Build And Scale`
    const escaped = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || companySettings?.email || 'noreply@datawyn.com',
      to: emailData.email,
      subject: emailData.subject || `Project Proposal – ${proposal.projectTitle} | Datawyn Technologies`,
      html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:680px;margin:auto"><div style="background:#111;color:#fff;padding:28px;text-align:center"><h1 style="margin:0;font-size:24px">PROJECT PROPOSAL</h1><p style="margin:8px 0 0;color:#d1d5db">${escaped(companySettings?.companyName || 'Datawyn Technologies')}</p></div><div style="padding:30px"><p>Dear ${escaped(clientName)},</p><p>${escaped(message).replace(/\n/g, '<br>')}</p>${shareUrl ? `<p><a href="${escaped(shareUrl)}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;text-decoration:none">Review Proposal Online</a></p>` : ''}<p style="color:#6b7280;font-size:13px">The proposal PDF is attached to this email.</p><p>Best Regards,<br><strong>${escaped(companySettings?.companyName || 'Datawyn Technologies')}</strong><br>Digital Solutions That Build And Scale</p></div></div>`,
      attachments: [{ filename: emailData.filename || `${proposal.proposalNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    })
    return { success: true }
  },

  async sendQuotation(quotation, emailData, pdfBuffer, companySettings) {
    const transporter = initializeTransporter()
    await transporter.verify()
    const clientName = quotation.customerSnapshot?.contactPerson || quotation.customerSnapshot?.companyName || 'Valued Client'
    const companyName = companySettings?.companyName || 'Datawyn Technologies'
    const message = emailData.message || `Dear ${clientName},\n\nGreetings from ${companyName}!\n\nPlease find attached the quotation for your requested project.\n\nThe attached document contains the project scope, deliverables, estimated timeline, pricing and payment terms.\n\nKindly review the quotation and let us know if you have any questions or require any modifications.\n\nWe look forward to working with you.\n\nBest Regards,\n${companyName}\nDigital Solutions That Build And Scale`
    const escaped = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
    const subject = emailData.subject || `Quotation for ${quotation.projectName} – ${quotation.quotationNumber}`
    const filename = emailData.filename || `Datawyn_Quotation_${quotation.quotationNumber}.pdf`
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || companySettings?.email || 'noreply@datawyn.com',
      to: emailData.email,
      cc: emailData.cc || undefined,
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:680px;margin:auto"><div style="background:#111;color:#fff;padding:28px;text-align:center"><h1 style="margin:0;font-size:24px">QUOTATION</h1><p style="margin:8px 0 0;color:#d1d5db">${escaped(companyName)}</p></div><div style="padding:30px"><p>Dear ${escaped(clientName)},</p><p>${escaped(message).replace(/\n/g, '<br>')}</p><p><strong>Quotation No:</strong> ${escaped(quotation.quotationNumber)}<br><strong>Project:</strong> ${escaped(quotation.projectName)}</p><p style="color:#6b7280;font-size:13px">The quotation PDF is attached to this email.</p><p>Best Regards,<br><strong>${escaped(companyName)}</strong><br>Digital Solutions That Build And Scale</p></div></div>`,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }]
    })
    return { success: true }
  },

  async sendInvoiceWithCustomPDF(invoiceId, { email, message, pdfBuffer, invoice, companySettings }) {
    try {
      console.log('Sending invoice with custom PDF:', invoiceId)
      
      const transporter = initializeTransporter()
      
      // Verify connection before sending
      try {
        await transporter.verify()
        console.log('Email transporter verified successfully')
      } catch (verifyError) {
        console.error('Email transporter verification failed:', verifyError)
        throw new Error('Email service connection failed: ' + verifyError.message)
      }
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || companySettings?.email || 'noreply@datawyn.com',
        to: email,
        subject: `Invoice ${invoice.invoiceNumber} from ${companySettings?.companyName || 'Datawyn Technologies'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%); padding: 30px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
              .header .subtitle { color: #cccccc; margin-top: 10px; font-size: 14px; }
              .content { padding: 30px; }
              .greeting { color: #333333; font-size: 16px; margin-bottom: 20px; }
              .invoice-box { background-color: #f9f9f9; border-left: 4px solid #2d2d2d; padding: 20px; margin: 20px 0; border-radius: 4px; }
              .invoice-box h3 { color: #2d2d2d; margin: 0 0 15px 0; font-size: 18px; }
              .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
              .detail-item { color: #666666; font-size: 14px; }
              .detail-item strong { color: #333333; }
              .total-amount { background-color: #2d2d2d; color: #ffffff; padding: 15px; text-align: center; border-radius: 4px; margin-top: 20px; }
              .total-amount .label { font-size: 14px; opacity: 0.9; }
              .total-amount .amount { font-size: 24px; font-weight: bold; margin-top: 5px; }
              .message { color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0; font-style: italic; }
              .footer { background-color: #2d2d2d; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
              .footer a { color: #ffffff; text-decoration: none; }
              .attachment-notice { background-color: #e8f4f8; border: 1px solid #b8daff; color: #004085; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
              .attachment-notice strong { display: block; margin-bottom: 5px; }
              .proforma-ref { background-color: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 10px; border-radius: 4px; margin: 15px 0; text-align: center; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>TAX INVOICE</h1>
                <div class="subtitle">${companySettings?.companyName || 'Datawyn Technologies'}</div>
              </div>
              
              <div class="content">
                <p class="greeting">Dear ${invoice.customerSnapshot?.contactPerson || 'Valued Customer'},</p>
                
                <p style="color: #333333; font-size: 15px; line-height: 1.6;">
                  Please find attached the tax invoice <strong>${invoice.invoiceNumber}</strong> for your records.
                </p>
                
                ${invoice.proformaInvoice ? `<div class="proforma-ref">📋 Reference: Proforma Invoice ${invoice.proformaInvoice.invoiceNumber}</div>` : ''}
                
                <div class="invoice-box">
                  <h3>📋 Invoice Details</h3>
                  <div class="invoice-details">
                    <div class="detail-item"><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
                    <div class="detail-item"><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div class="detail-item"><strong>Payment Method:</strong> ${invoice.paymentMethod || 'Bank Transfer'}</div>
                    <div class="detail-item"><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</div>
                  </div>
                  
                  <div class="total-amount">
                    <div class="label">Total Amount</div>
                    <div class="amount">₹${(invoice.grandTotal || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div class="attachment-notice">
                  <strong>📎 PDF Invoice Attached</strong>
                  The detailed invoice PDF is attached to this email for your records.
                </div>
                
                ${message ? `<div class="message">"${message}"</div>` : ''}
                
                <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                  Please review the attached invoice and let us know if you have any questions.
                </p>
                
                <p style="color: #333333; font-size: 15px; margin-top: 20px;">
                  Best regards,<br>
                  <strong>${companySettings?.companyName || 'Datawyn Technologies'}</strong>
                </p>
              </div>
              
              <div class="footer">
                <p>${companySettings?.companyName || 'Datawyn Technologies'}</p>
                ${companySettings?.address ? `<p>${[companySettings.address.street, companySettings.address.city, companySettings.address.state].filter(Boolean).join(', ')}</p>` : ''}
                ${companySettings?.phone ? `<p>📞 ${companySettings.phone}</p>` : ''}
                ${companySettings?.email ? `<p>✉️ ${companySettings.email}</p>` : ''}
                ${companySettings?.website ? `<p>🌐 <a href="https://${companySettings.website}">${companySettings.website}</a></p>` : ''}
              </div>
            </div>
          </body>
          </html>
        `,
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      }

      console.log('Sending email to:', email)
      await transporter.sendMail(mailOptions)
      console.log('Email sent successfully')
      
      // Update invoice status to sent
      invoice.status = 'sent'
      // Add to status history if the field exists
      if (invoice.statusHistory) {
        invoice.statusHistory.push({
          status: 'sent',
          changedAt: new Date()
        })
      }
      await invoice.save()

      return { success: true, message: 'Invoice sent successfully' }
    } catch (error) {
      console.error('Email sending error:', error)
      throw new Error('Failed to send email: ' + error.message)
    }
  },

  async sendProformaInvoiceWithCustomPDF(invoiceId, { email, message, pdfBuffer, invoice, companySettings }) {
    try {
      console.log('Sending proforma invoice with custom PDF:', invoiceId)
      
      const transporter = initializeTransporter()
      
      // Verify connection before sending
      try {
        await transporter.verify()
        console.log('Email transporter verified successfully')
      } catch (verifyError) {
        console.error('Email transporter verification failed:', verifyError)
        throw new Error('Email service connection failed: ' + verifyError.message)
      }
      
      const mailOptions = {
        from: process.env.EMAIL_FROM || companySettings?.email || 'noreply@datawyn.com',
        to: email,
        subject: `Proforma Invoice ${invoice.invoiceNumber} from ${companySettings?.companyName || 'Datawyn Technologies'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%); padding: 30px; text-align: center; }
              .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
              .header .subtitle { color: #cccccc; margin-top: 10px; font-size: 14px; }
              .content { padding: 30px; }
              .greeting { color: #333333; font-size: 16px; margin-bottom: 20px; }
              .invoice-box { background-color: #f9f9f9; border-left: 4px solid #2d2d2d; padding: 20px; margin: 20px 0; border-radius: 4px; }
              .invoice-box h3 { color: #2d2d2d; margin: 0 0 15px 0; font-size: 18px; }
              .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
              .detail-item { color: #666666; font-size: 14px; }
              .detail-item strong { color: #333333; }
              .total-amount { background-color: #2d2d2d; color: #ffffff; padding: 15px; text-align: center; border-radius: 4px; margin-top: 20px; }
              .total-amount .label { font-size: 14px; opacity: 0.9; }
              .total-amount .amount { font-size: 24px; font-weight: bold; margin-top: 5px; }
              .message { color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0; font-style: italic; }
              .footer { background-color: #2d2d2d; color: #ffffff; padding: 20px; text-align: center; font-size: 12px; }
              .footer a { color: #ffffff; text-decoration: none; }
              .attachment-notice { background-color: #e8f4f8; border: 1px solid #b8daff; color: #004085; padding: 15px; border-radius: 4px; margin: 20px 0; text-align: center; }
              .attachment-notice strong { display: block; margin-bottom: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>PROFORMA INVOICE</h1>
                <div class="subtitle">${companySettings?.companyName || 'Datawyn Technologies'}</div>
              </div>
              
              <div class="content">
                <p class="greeting">Dear ${invoice.customerSnapshot?.contactPerson || 'Valued Customer'},</p>
                
                <p style="color: #333333; font-size: 15px; line-height: 1.6;">
                  Please find attached the proforma invoice <strong>${invoice.invoiceNumber}</strong> for your review.
                </p>
                
                <div class="invoice-box">
                  <h3>📋 Invoice Details</h3>
                  <div class="invoice-details">
                    <div class="detail-item"><strong>Invoice No:</strong> ${invoice.invoiceNumber}</div>
                    <div class="detail-item"><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div class="detail-item"><strong>Valid Until:</strong> ${invoice.validUntil ? new Date(invoice.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</div>
                    <div class="detail-item"><strong>Payment Method:</strong> ${invoice.paymentMethod || 'Bank Transfer'}</div>
                  </div>
                  
                  <div class="total-amount">
                    <div class="label">Total Amount</div>
                    <div class="amount">₹${(invoice.grandTotal || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div class="attachment-notice">
                  <strong>📎 PDF Invoice Attached</strong>
                  The detailed invoice PDF is attached to this email for your records.
                </div>
                
                ${message ? `<div class="message">"${message}"</div>` : ''}
                
                <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                  Please review the attached invoice and let us know if you have any questions or require any modifications.
                </p>
                
                <p style="color: #333333; font-size: 15px; margin-top: 20px;">
                  Best regards,<br>
                  <strong>${companySettings?.companyName || 'Datawyn Technologies'}</strong>
                </p>
              </div>
              
              <div class="footer">
                <p>${companySettings?.companyName || 'Datawyn Technologies'}</p>
                ${companySettings?.address ? `<p>${[companySettings.address.street, companySettings.address.city, companySettings.address.state].filter(Boolean).join(', ')}</p>` : ''}
                ${companySettings?.phone ? `<p>📞 ${companySettings.phone}</p>` : ''}
                ${companySettings?.email ? `<p>✉️ ${companySettings.email}</p>` : ''}
                ${companySettings?.website ? `<p>🌐 <a href="https://${companySettings.website}">${companySettings.website}</a></p>` : ''}
              </div>
            </div>
          </body>
          </html>
        `,
        attachments: [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      }

      console.log('Sending email to:', email)
      await transporter.sendMail(mailOptions)
      console.log('Email sent successfully')
      
      // Update invoice status to sent
      invoice.status = 'sent'
      invoice.statusHistory.push({
        status: 'sent',
        changedAt: new Date()
      })
      await invoice.save()

      return { success: true, message: 'Invoice sent successfully' }
    } catch (error) {
      console.error('Email sending error:', error)
      throw new Error('Failed to send email: ' + error.message)
    }
  }
}
