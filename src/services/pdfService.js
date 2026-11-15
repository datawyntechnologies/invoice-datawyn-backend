import PDFKit from 'pdfkit'
import path from 'path'
import fs from 'fs'

export class PDFService {
  static async generateProformaInvoice(invoice, companySettings) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFKit({ 
          margin: 40, 
          size: 'A4',
          bufferPages: true
        })
        const chunks = []
        
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)
        
        // New color scheme matching the design
        const darkGrey = '#2d2d2d'
        const lightGrey = '#f5f5f5'
        const mediumGrey = '#e0e0e0'
        const white = '#ffffff'
        const textColor = '#333333'
        
        let currentY = 0
        
        // Add new header
        currentY = this.addNewHeader(doc, companySettings, darkGrey, white, 'PROFORMA INVOICE', currentY)
        
        // Invoice details section
        currentY = this.addInvoiceDetails(doc, invoice, textColor, currentY - 35)
        
        // New table design
        currentY = this.addNewTable(doc, invoice, lightGrey, mediumGrey, textColor, currentY)
        
        // Summary section with dark grey TOTAL box
        currentY = this.addNewSummary(doc, invoice, darkGrey, white, textColor, currentY)
        
        // Amount in words section
        currentY = this.addAmountInWords(doc, invoice, textColor, currentY)
        
        // Payment Terms
        currentY = this.addPaymentTerms(doc, invoice, textColor, currentY)
        
        // Notes
        currentY = this.addNotes(doc, invoice, textColor, currentY)
        
        // Terms & Conditions
        currentY = this.addTermsAndConditions(doc, invoice, textColor, currentY)
        
        // Bank Details
        currentY = this.addBankDetails(doc, companySettings, textColor, currentY)
        
        // Signature section
        currentY = this.addSignature(doc, invoice, companySettings, textColor, currentY)
        
        // Contact footer - positioned after signature with minimum spacing
        this.addContactFooter(doc, companySettings, darkGrey, white, currentY)
        
        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  static async generateInvoice(invoice, companySettings) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFKit({ 
          margin: 40, 
          size: 'A4',
          bufferPages: true
        })
        const chunks = []
        
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)
        
        // New color scheme matching the design
        const darkGrey = '#2d2d2d'
        const lightGrey = '#f5f5f5'
        const mediumGrey = '#e0e0e0'
        const white = '#ffffff'
        const textColor = '#333333'
        
        let currentY = 0
        
        // Add new header
        currentY = this.addNewHeader(doc, companySettings, darkGrey, white, 'TAX INVOICE', currentY)
        
        // Invoice details section
        currentY = this.addInvoiceDetails(doc, invoice, textColor, currentY - 35)
        
        // New table design
        currentY = this.addNewTable(doc, invoice, lightGrey, mediumGrey, textColor, currentY)
        
        // Summary section with dark grey TOTAL box
        currentY = this.addNewSummary(doc, invoice, darkGrey, white, textColor, currentY)
        
        // Amount in words section
        currentY = this.addAmountInWords(doc, invoice, textColor, currentY)
        
        // Payment Terms
        currentY = this.addPaymentTerms(doc, invoice, textColor, currentY)
        
        // Notes
        currentY = this.addNotes(doc, invoice, textColor, currentY)
        
        // Terms & Conditions
        currentY = this.addTermsAndConditions(doc, invoice, textColor, currentY)
        
        // Bank Details
        currentY = this.addBankDetails(doc, companySettings, textColor, currentY)
        
        // Signature section
        currentY = this.addSignature(doc, invoice, companySettings, textColor, currentY)
        
        // Contact footer - positioned after signature with minimum spacing
        this.addContactFooter(doc, companySettings, darkGrey, white, currentY)
        
        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }
  
  static addNewHeader(doc, company, darkGrey, white, invoiceType = 'INVOICE', startY = 0) {
    // Handle missing company settings
    const safeCompany = company || {}
    
    const headerY = startY + 40
    
    // Logo on left side with border - improved handling
    let logoLoaded = false
    if (safeCompany.logo) {
      try {
        let logoPath
        if (safeCompany.logo.startsWith('/uploads/')) {
          const filename = safeCompany.logo.replace('/uploads/', '')
          logoPath = path.join(process.cwd(), 'uploads', filename)
        } else if (safeCompany.logo.startsWith('uploads/')) {
          logoPath = path.join(process.cwd(), safeCompany.logo)
        } else if (safeCompany.logo.startsWith('http')) {
          console.log('URL-based logos not yet supported in PDF')
        } else {
          logoPath = path.join(process.cwd(), 'uploads', safeCompany.logo)
        }
        
        if (logoPath && fs.existsSync(logoPath)) {
          // Draw border around logo with better styling
          doc.rect(40, headerY, 90, 90)
            .lineWidth(1.5)
            .stroke('#d1d5db')
          
          // Add logo with better fit
          doc.image(logoPath, 45, headerY + 5, { 
            width: 80, 
            height: 80,
            fit: [80, 80],
            align: 'center',
            valign: 'center'
          })
          logoLoaded = true
        } else {
          console.log('Logo file not found at path:', logoPath)
        }
      } catch (error) {
        console.log('Could not load logo:', error)
      }
    }
    
    // Company name and address details - improved spacing and typography
    let y = headerY + 10
    if (!logoLoaded) {
      y = headerY + 20
    }
    
    // Company name - larger and more prominent with better color
    doc.fillColor('#111827')
      .fontSize(26)
      .font('Helvetica-Bold')
      .text(safeCompany.companyName || 'Datawyn Technologies', logoLoaded ? 145 : 40, y)
    
    y += 35
    
    // Address details with better formatting
    const address = safeCompany.address || {}
    if (address.street) {
      doc.fillColor('#4b5563')
        .fontSize(11)
        .font('Helvetica')
        .text(address.street, logoLoaded ? 145 : 40, y)
      y += 18
    }
    if (address.city || address.state || address.pincode) {
      const cityState = [address.city, address.state, address.pincode].filter(Boolean).join(', ')
      doc.fillColor('#4b5563')
        .fontSize(11)
        .font('Helvetica')
        .text(cityState, logoLoaded ? 145 : 40, y)
      y += 18
    }
    if (safeCompany.email) {
      doc.fillColor('#4b5563')
        .fontSize(11)
        .font('Helvetica')
        .text(safeCompany.email, logoLoaded ? 145 : 40, y)
      y += 18
    }
    if (safeCompany.phone) {
      doc.fillColor('#4b5563')
        .fontSize(11)
        .font('Helvetica')
        .text(safeCompany.phone, logoLoaded ? 145 : 40, y)
      y += 18
    }
    if (safeCompany.gstin) {
      doc.fillColor('#111827')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`GSTIN: ${safeCompany.gstin}`, logoLoaded ? 145 : 40, y)
    }
    
    // Determine the document type label
    const documentType = invoiceType === 'PROPOSAL' ? 'PROPOSAL' : 
                        invoiceType === 'PROFORMA INVOICE' ? 'PROFORMA' : 'INVOICE'
    
    // INVOICE/PROPOSAL text on right side with improved styling
    doc.rect(450, headerY, 105, 45)
      .fill('#000000')
    
    doc.fillColor('#ffffff')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(documentType, 450, headerY + 18, { width: 105, align: 'center' })
    
    // Invoice/Proposal number below with better box styling
    doc.rect(450, headerY + 50, 105, 40)
      .lineWidth(1.5)
      .stroke('#d1d5db')
    
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica')
      .text(invoiceType === 'PROPOSAL' ? 'Proposal No' : 'Invoice No', 455, headerY + 58)
    
    return headerY + 95
  }
  
  static addInvoiceDetails(doc, invoice, textColor, startY = 0) {
    const customer = invoice.customerSnapshot || {}
    
    const detailsY = startY + 10
    
    // Add invoice number to the header box with better styling
    doc.fillColor('#111827')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(invoice.invoiceNumber || 'N/A', 455, startY - 35, { width: 100, align: 'center' })
    
    // Add separator line for better visual separation
    doc.moveTo(40, detailsY)
      .lineTo(555, detailsY)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    // Invoice details section - two column layout
    let y = detailsY + 25
    
    // Left column - Invoice Details
    doc.fillColor('#374151')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('INVOICE DETAILS', 40, y)
    
    y += 25
    
    // Invoice No
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica')
      .text('Invoice No:', 40, y)
    doc.fillColor('#111827')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(invoice.invoiceNumber || 'N/A', 120, y)
    y += 20
    
    // Invoice Date
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica')
      .text('Date:', 40, y)
    doc.fillColor('#111827')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A', 120, y)
    y += 20
    
    // Proforma Ref (if exists)
    if (invoice.proformaInvoice) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text('Proforma Ref:', 40, y)
      doc.fillColor('#111827')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(invoice.proformaInvoice.invoiceNumber || 'N/A', 120, y)
      y += 20
    }
    
    // Status
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica')
      .text('Status:', 40, y)
    doc.fillColor('#111827')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : 'N/A', 120, y)
    
    // Right column - Bill To
    y = detailsY + 25
    const billToX = 320
    
    doc.fillColor('#374151')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('BILL TO', billToX, y)
    
    y += 25
    
    // Company Name
    doc.fillColor('#111827')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(customer.companyName || 'N/A', billToX, y)
    y += 20
    
    // Contact Person
    if (customer.contactPerson) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(customer.contactPerson, billToX, y)
      y += 18
    }
    
    // Email
    if (customer.email) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(customer.email, billToX, y)
      y += 18
    }
    
    // Phone
    if (customer.phone) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(customer.phone, billToX, y)
      y += 18
    }
    
    // Address
    if (customer.billingAddress) {
      const addr = customer.billingAddress
      const address = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(address, billToX, y, { width: 235 })
    } else if (customer.address) {
      const addr = customer.address
      const address = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(address, billToX, y, { width: 235 })
    }
    
    // GSTIN
    if (customer.gstin) {
      y += 18
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(`GSTIN: ${customer.gstin}`, billToX, y)
    }
    
    // Add separator line
    y += 25
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    return y + 20
  }
  
  
  static addNewTable(doc, invoice, lightGrey, mediumGrey, textColor, startY = 0) {
    const tableTop = startY + 20
    const rowHeight = 35
    const enableGST = invoice.enableGST !== undefined ? invoice.enableGST : true
    // Adjust column widths based on GST enabled/disabled - matching CRM UI
    const colWidths = enableGST ? [180, 50, 60, 50, 60, 95] : [280, 50, 80, 80, 105]
    const items = invoice.items || []
    
    // Handle missing items gracefully
    if (!items || !Array.isArray(items) || items.length === 0) {
      doc.fillColor('#999999')
        .fontSize(11)
        .text('No items in this invoice', 40, tableTop + 20)
      return tableTop + 50
    }
    
    // Table header background - light grey
    doc.rect(40, tableTop, 515, 35)
      .fill('#f9fafb')
    
    // Table headers - matching CRM UI
    doc.fillColor('#374151')
      .fontSize(10)
      .font('Helvetica-Bold')
    
    const headers = enableGST 
      ? ['DESCRIPTION', 'QTY', 'RATE', 'GST %', 'TAXABLE', 'TOTAL']
      : ['DESCRIPTION', 'QTY', 'RATE', 'TOTAL']
    let x = 50
    
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop + 12)
      x += colWidths[i]
    })
    
    // Table rows with alternating colors
    let y = tableTop + rowHeight
    let alternateColor = false
    
    items.forEach((item, index) => {
      // Alternate row colors - light grey
      if (alternateColor) {
        doc.rect(40, y, 515, rowHeight)
          .fill('#f3f4f6')
      } else {
        doc.rect(40, y, 515, rowHeight)
          .fill('#ffffff')
      }
      alternateColor = !alternateColor
      
      // Item data
      doc.fillColor('#374151')
        .fontSize(10)
        .font('Helvetica')
      
      x = 50
      
      // Description - handle both proforma, invoice, and proposal item structures
      let desc = item.productSnapshot?.name || item.description || item.name || item.customName || 'N/A'
      if (!desc || desc === 'N/A') {
        desc = 'Product/Service'
      }
      doc.text(desc.substring(0, 40), x, y + 12)
      x += colWidths[0]
      
      // Quantity
      const quantity = parseFloat(item.quantity) || 1
      doc.text(quantity.toString(), x, y + 12, { align: 'center' })
      x += colWidths[1]
      
      // Rate
      const rate = parseFloat(item.rate) || 0
      doc.text(`₹${rate.toFixed(2)}`, x, y + 12, { align: 'right' })
      x += colWidths[2]
      
      // GST % (only if GST enabled)
      if (enableGST) {
        const gstRate = parseFloat(item.gstRate) || 0
        doc.text(`${gstRate}%`, x, y + 12, { align: 'center' })
        x += colWidths[3]
        
        // Taxable Amount
        const taxableAmount = parseFloat(item.taxableAmount) || (rate * quantity)
        doc.text(`₹${taxableAmount.toFixed(2)}`, x, y + 12, { align: 'right' })
        x += colWidths[4]
      }
      
      // Total
      const total = parseFloat(item.total) || (rate * quantity)
      doc.fillColor('#374151')
        .font('Helvetica-Bold')
        .text(`₹${total.toFixed(2)}`, x, y + 12, { align: 'right' })
      
      y += rowHeight
    })
    
    // Table border
    doc.rect(40, tableTop, 515, y - tableTop)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    return y + 10
  }
  
  static addNewSummary(doc, invoice, darkGrey, white, textColor, startY = 0) {
    const enableGST = invoice.enableGST !== undefined ? invoice.enableGST : true
    
    // Handle missing financial values with defaults
    const subtotal = parseFloat(invoice.subtotal) || 0
    const itemDiscount = parseFloat(invoice.itemDiscount) || 0
    const invoiceDiscount = parseFloat(invoice.invoiceDiscount) || 0
    const cgst = parseFloat(invoice.cgst) || 0
    const sgst = parseFloat(invoice.sgst) || 0
    const igst = parseFloat(invoice.igst) || 0
    const grandTotal = parseFloat(invoice.grandTotal) || 0
    
    // Summary section on the right - matching CRM UI
    let y = startY + 20
    const summaryX = 350
    
    // Sub Total
    doc.fillColor('#4b5563')
      .fontSize(11)
      .font('Helvetica')
      .text('Subtotal', summaryX, y)
    
    doc.fillColor(textColor)
      .font('Helvetica-Bold')
      .text(`₹${subtotal.toFixed(2)}`, 500, y, { align: 'right' })
    
    y += 20
    
    // Discount (if any)
    const totalDiscount = itemDiscount + invoiceDiscount
    if (totalDiscount > 0) {
      doc.fillColor('#4b5563')
        .font('Helvetica')
        .text('Discount', summaryX, y)
      
      doc.fillColor('#dc2626')
        .font('Helvetica-Bold')
        .text(`-₹${totalDiscount.toFixed(2)}`, 500, y, { align: 'right' })
      
      y += 20
    }
    
    // Tax breakdown (only if GST enabled)
    if (enableGST) {
      if (cgst > 0) {
        doc.fillColor('#4b5563')
          .font('Helvetica')
          .text('CGST', summaryX, y)
        
        doc.fillColor(textColor)
          .font('Helvetica-Bold')
          .text(`₹${cgst.toFixed(2)}`, 500, y, { align: 'right' })
        
        y += 20
      }
      
      if (sgst > 0) {
        doc.fillColor('#4b5563')
          .font('Helvetica')
          .text('SGST', summaryX, y)
        
        doc.fillColor(textColor)
          .font('Helvetica-Bold')
          .text(`₹${sgst.toFixed(2)}`, 500, y, { align: 'right' })
        
        y += 20
      }
      
      if (igst > 0) {
        doc.fillColor('#4b5563')
          .font('Helvetica')
          .text('IGST', summaryX, y)
        
        doc.fillColor(textColor)
          .font('Helvetica-Bold')
          .text(`₹${igst.toFixed(2)}`, 500, y, { align: 'right' })
        
        y += 20
      }
    }
    
    y += 10
    
    // Grand Total - matching CRM UI with border
    doc.moveTo(summaryX, y)
      .lineTo(555, y)
      .lineWidth(2)
      .stroke('#e5e7eb')
    
    y += 15
    
    doc.fillColor('#111827')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Grand Total', summaryX, y)
    
    doc.fillColor('#000000')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`₹${grandTotal.toFixed(2)}`, 500, y, { align: 'right' })
    
    return y + 30
  }
  
  static addAmountInWords(doc, invoice, textColor, startY = 0) {
    const amountWordsY = startY + 20
    
    // Amount in words section - matching CRM UI with grey background
    doc.rect(40, amountWordsY, 515, 40)
      .fill('#f9fafb')
    
    doc.rect(40, amountWordsY, 515, 40)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('AMOUNT IN WORDS', 50, amountWordsY + 10)
    
    const amountWords = invoice.amountInWords || 'Rupees Only'
    doc.fillColor('#111827')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(amountWords, 50, amountWordsY + 25)
    
    return amountWordsY + 50
  }
  
  static addPaymentTerms(doc, invoice, textColor, startY = 0) {
    const paymentTermsY = startY + 10
    
    if (invoice.paymentTerms) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('PAYMENT TERMS', 40, paymentTermsY)
      
      doc.fillColor('#374151')
        .fontSize(10)
        .font('Helvetica')
        .text(invoice.paymentTerms, 40, paymentTermsY + 15)
      
      return paymentTermsY + 35
    }
    return paymentTermsY
  }
  
  static addNotes(doc, invoice, textColor, startY = 0) {
    const notesY = startY + 10
    
    if (invoice.notes) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('NOTES', 40, notesY)
      
      doc.fillColor('#374151')
        .fontSize(10)
        .font('Helvetica')
        .text(invoice.notes, 40, notesY + 15)
      
      return notesY + 35
    }
    return notesY
  }
  
  static addBankDetails(doc, company, textColor, startY = 0) {
    const bankY = startY + 10
    
    const safeCompany = company || {}
    const bankDetails = safeCompany.bankDetails || {}
    
    if (bankDetails.bankName || bankDetails.accountNumber || bankDetails.ifsc) {
      doc.moveTo(40, bankY)
        .lineTo(555, bankY)
        .lineWidth(1)
        .stroke('#e5e7eb')
      
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('BANK DETAILS', 40, bankY + 15)
      
      let y = bankY + 35
      
      // Grid layout for bank details
      const col1X = 40
      const col2X = 200
      
      if (bankDetails.bankName) {
        doc.fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text('Bank Name', col1X, y)
        doc.fillColor('#111827')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.bankName, col1X, y + 12)
        y += 30
      }
      
      if (bankDetails.accountNumber) {
        doc.fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text('Account Number', col1X, y)
        doc.fillColor('#111827')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.accountNumber, col1X, y + 12)
        y += 30
      }
      
      if (bankDetails.ifsc) {
        doc.fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text('IFSC Code', col1X, y)
        doc.fillColor('#111827')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.ifsc, col1X, y + 12)
        y += 30
      }
      
      y = bankY + 35
      
      if (bankDetails.branch) {
        doc.fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text('Branch', col2X, y)
        doc.fillColor('#111827')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.branch, col2X, y + 12)
        y += 30
      }
      
      if (bankDetails.accountHolderName) {
        doc.fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text('Account Holder', col2X, y)
        doc.fillColor('#111827')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.accountHolderName, col2X, y + 12)
      }
      
      return bankY + 100
    }
    return bankY
  }
  
  static addTermsAndConditions(doc, invoice, textColor, startY = 0) {
    const termsY = startY + 10
    
    if (invoice.termsAndConditions) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('TERMS & CONDITIONS', 40, termsY)
      
      doc.rect(40, termsY + 15, 515, 40)
        .fill('#f9fafb')
      
      doc.rect(40, termsY + 15, 515, 40)
        .lineWidth(1)
        .stroke('#e5e7eb')
      
      doc.fillColor('#374151')
        .fontSize(9)
        .font('Helvetica')
        .text(invoice.termsAndConditions, 50, termsY + 25, {
          width: 500,
          align: 'justify'
        })
      
      return termsY + 65
    }
    return termsY
  }
  
  static addSignature(doc, invoice, company, textColor, startY = 0) {
    const signatureY = startY + 20
    
    // Handle missing company settings
    const safeCompany = company || {}
    
    // Signature section on the right - improved alignment and dynamic handling
    let currentY = signatureY
    
    // Add separator line before signature section
    doc.moveTo(40, currentY)
      .lineTo(555, currentY)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    currentY += 25
    
    // Add signature image if available with better error handling
    if (safeCompany.authorizedSignatory?.signatureImage) {
      try {
        let signaturePath
        if (safeCompany.authorizedSignatory.signatureImage.startsWith('/uploads/')) {
          const filename = safeCompany.authorizedSignatory.signatureImage.replace('/uploads/', '')
          signaturePath = path.join(process.cwd(), 'uploads', filename)
        } else if (safeCompany.authorizedSignatory.signatureImage.startsWith('uploads/')) {
          signaturePath = path.join(process.cwd(), safeCompany.authorizedSignatory.signatureImage)
        } else if (safeCompany.authorizedSignatory.signatureImage.startsWith('http')) {
          console.log('URL-based signatures not yet supported in PDF')
        } else {
          signaturePath = path.join(process.cwd(), 'uploads', safeCompany.authorizedSignatory.signatureImage)
        }
        
        if (signaturePath && fs.existsSync(signaturePath)) {
          // Better positioning for signature image with proper fit
          doc.image(signaturePath, 340, currentY, { 
            width: 200, 
            height: 80,
            fit: [200, 80],
            align: 'center',
            valign: 'center'
          })
          currentY += 85
        } else {
          console.log('Signature file not found at path:', signaturePath)
          // Fallback to signature line with better styling
          doc.moveTo(340, currentY + 30)
            .lineTo(540, currentY + 30)
            .lineWidth(2)
            .stroke('#111827')
          currentY += 40
        }
      } catch (error) {
        console.log('Could not load signature:', error)
        // Fallback to signature line with better styling
        doc.moveTo(340, currentY + 30)
          .lineTo(540, currentY + 30)
          .lineWidth(2)
          .stroke('#111827')
        currentY += 40
      }
    } else {
      // Signature line - thicker and darker with better positioning
      doc.moveTo(340, currentY + 30)
        .lineTo(540, currentY + 30)
        .lineWidth(2)
        .stroke('#111827')
      currentY += 40
    }
    
    // Signature name and designation - improved styling and dynamic handling
    if (safeCompany.authorizedSignatory?.name) {
      doc.fillColor('#111827')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text(safeCompany.authorizedSignatory.name, 340, currentY)
      currentY += 20
      
      if (safeCompany.authorizedSignatory?.designation) {
        doc.fillColor('#6b7280')
          .fontSize(11)
          .font('Helvetica')
          .text(safeCompany.authorizedSignatory.designation, 340, currentY)
        currentY += 20
      }
    } else {
      doc.fillColor('#111827')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('Authorized Signatory', 340, currentY)
      currentY += 20
    }
    
    // Company name below signature - improved positioning and formatting
    doc.fillColor('#6b7280')
      .fontSize(11)
      .font('Helvetica')
      .text('For ' + (safeCompany.companyName || 'Datawyn Technologies'), 340, currentY)
    
    currentY += 25
    
    // Add date placeholder
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    doc.fillColor('#9ca3af')
      .fontSize(10)
      .font('Helvetica')
      .text(`Date: ${today}`, 340, currentY)
    
    // Return the final Y position but cap it to avoid footer overlap
    return Math.min(currentY + 30, 730)
  }
  
  static addProposalHeader(doc, company, black, white, proposal, startY = 0) {
    const safeCompany = company || {}
    const customer = proposal.customerSnapshot || {}
    
    const headerY = startY + 30
    let y = headerY
    
    // Professional header with logo and company info
    let logoHeight = 0
    
    // Logo on left side - with better error handling for serverless environments
    if (safeCompany.logo) {
      try {
        let logoPath
        if (safeCompany.logo.startsWith('/uploads/')) {
          const filename = safeCompany.logo.replace('/uploads/', '')
          logoPath = path.join(process.cwd(), 'uploads', filename)
        } else if (safeCompany.logo.startsWith('uploads/')) {
          logoPath = path.join(process.cwd(), safeCompany.logo)
        } else if (safeCompany.logo.startsWith('http')) {
          console.log('URL-based logos not yet supported in PDF')
        } else {
          logoPath = path.join(process.cwd(), 'uploads', safeCompany.logo)
        }
        
        // Check if file exists and is accessible
        if (logoPath) {
          try {
            if (fs.existsSync(logoPath)) {
              doc.image(logoPath, 40, y, { 
                width: 80, 
                height: 50,
                fit: [80, 50]
              })
              logoHeight = 60
            }
          } catch (fsError) {
            console.log('Logo file check failed, skipping logo:', fsError.message)
          }
        }
      } catch (error) {
        console.log('Could not load logo, skipping:', error.message)
      }
    }
    
    // Company name and tagline
    const companyX = logoHeight > 0 ? 130 : 40
    doc.fillColor('#000000')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(safeCompany.companyName || 'DATAWYN TECHNOLOGIES', companyX, y)
    
    y += 18
    
    // Tagline
    doc.fillColor('#666666')
      .fontSize(10)
      .font('Helvetica')
      .text('Digital Solutions That Build & Scale', companyX, y)
    
    y += 25
    
    // Divider line
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#E5E5E5')
    
    y += 25
    
    // Two-column layout for proposal info and client
    // Left column: Proposal details
    doc.fillColor('#000000')
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('PROPOSAL', 40, y)
    
    y += 20
    
    doc.fillColor('#666666')
      .fontSize(11)
      .font('Helvetica')
      .text(proposal.proposalNumber || 'PROP-2026-0001', 40, y)
    
    y += 15
    
    if (proposal.proposalDate) {
      doc.fillColor('#888888')
        .fontSize(9)
        .font('Helvetica')
        .text('Date: ' + new Date(proposal.proposalDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 40, y)
      y += 15
    }
    
    if (proposal.status) {
      const statusText = proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)
      doc.fillColor('#888888')
        .fontSize(9)
        .font('Helvetica')
        .text('Status: ' + statusText, 40, y)
      y += 15
    }
    
    // Right column: Project title and client
    const rightColumnY = headerY + 55
    
    if (proposal.projectTitle) {
      doc.fillColor('#000000')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(proposal.projectTitle, 300, rightColumnY, { width: 255 })
      rightColumnY += 20
    }
    
    if (customer.companyName) {
      doc.fillColor('#666666')
        .fontSize(9)
        .font('Helvetica')
        .text('Prepared for:', 300, rightColumnY)
      rightColumnY += 12
      
      doc.fillColor('#000000')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text(customer.companyName, 300, rightColumnY, { width: 255 })
      rightColumnY += 15
    }
    
    // Use the maximum Y from both columns
    y = Math.max(y, rightColumnY)
    
    // Professional divider
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(2)
      .stroke('#000000')
    
    return y + 30
  }

  static addContactFooter(doc, company, darkGrey, white, startY = 750) {
    // Footer background - position based on content or default
    const footerY = Math.max(startY + 10, 750)
    doc.rect(0, footerY, 595.28, 40)
      .fill('#f9fafb')
    
    doc.rect(0, footerY, 595.28, 40)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    // Footer message - matching CRM UI
    doc.fillColor('#6b7280')
      .fontSize(9)
      .font('Helvetica')
      .text('This is a computer-generated invoice and does not require a physical signature.', 40, footerY + 15, {
        align: 'center',
        width: 515
      })
  }

  static async generateProposal(proposal, companySettings, theme = {}) {
    return new Promise((resolve, reject) => {
      try {
        const safeTheme = this.normalizeProposalPdfTheme(theme)
        const doc = new PDFKit({ margin: 48, size: 'A4', bufferPages: true, autoFirstPage: false })
        this.patchProposalTextEncoder(doc)
        const chunks = []
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const originalAddPage = doc.addPage.bind(doc)
        doc.addPage = (...args) => {
          const page = originalAddPage(...args)
          doc.rect(0, 0, 595.28, 842).fill(safeTheme.background || '#FFFFFF')
          doc.y = 98
          doc.x = 48
          return page
        }

        this.drawProposalCover(doc, proposal, companySettings, safeTheme)
        this.drawProposalOverview(doc, proposal, companySettings, safeTheme)
        this.drawProposalScope(doc, proposal, safeTheme)
        this.drawProposalDeliverablesAndTechnology(doc, proposal, safeTheme)
        this.drawProposalTimeline(doc, proposal, safeTheme)
        this.drawProposalPricing(doc, proposal, safeTheme)
        this.drawProposalPaymentTerms(doc, proposal, companySettings, safeTheme)
        this.drawProposalAcceptance(doc, proposal, companySettings, safeTheme)

        const range = doc.bufferedPageRange()
        for (let i = range.start; i < range.start + range.count; i += 1) {
          doc.switchToPage(i)
          this.drawProposalPageChrome(doc, companySettings, proposal, safeTheme, i + 1, range.count)
        }
        doc.end()
      } catch (error) { reject(error) }
    })
  }

  static sanitizeProposalText(value) {
    if (value === null || value === undefined) return ''
    let text = String(value)
    const replacements = {
      '₹': 'Rs.', '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '−': '-',
      '‘': "'", '’': "'", '‚': "'", '‛': "'",
      '“': '"', '”': '"', '„': '"', '‟': '"',
      '•': '-', '·': '-', '▪': '-', '◦': '-', '‣': '-',
      '…': '...', '™': '', '®': '', '©': '', '°': ' deg',
      '\u00a0': ' ', '\u200b': '', '\u200c': '', '\u200d': '', '\ufeff': ''
    }
    Object.entries(replacements).forEach(([from, to]) => {
      text = text.split(from).join(to)
    })
    return text
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\x00-\xFF]/g, '')
  }

  static patchProposalTextEncoder(doc) {
    const originalText = doc.text.bind(doc)
    doc.text = (text, ...args) => originalText(this.sanitizeProposalText(text), ...args)
  }

  static normalizeProposalPdfTheme(theme = {}) {
    const colors = {
      primary: '#111111', secondary: '#333333', accent: '#111111', background: '#FFFFFF',
      text: '#222222', muted: '#6B7280', divider: '#D1D5DB', light: '#F4F4F4',
      lightBackground: '#F4F4F4',
      coverBackground: '#111111', coverText: '#FFFFFF', coverMuted: '#D1D5DB'
    }
    const config = theme.config || theme
    Object.entries(colors).forEach(([key, fallback]) => {
      const value = config?.[`${key}Color`] || config?.[key]
      if (/^#[0-9a-f]{3,8}$/i.test(value || '')) colors[key] = value
    })
    return { ...config, ...colors, fontFamily: 'Helvetica' }
  }

  static drawProposalPageChrome(doc, company, proposal, theme, pageNumber, pageCount) {
    if (pageNumber === 1) return
    const c = theme
    const safeCompany = company || {}

    // Header: small logo + company name, proposal label on the right
    const logo = this.proposalLogoPath(safeCompany)
    let nameX = 48
    if (c.showLogo !== false && logo) {
      try {
        doc.image(logo, 48, 30, { width: 30, height: 15, fit: [30, 15] })
        nameX = 84
      } catch (_) {}
    }
    doc.fillColor(c.primary || '#111111').font('Helvetica-Bold').fontSize(8.5)
      .text(safeCompany.companyName || 'Datawyn Technologies', nameX, 32, { width: 280 })
    doc.fillColor(c.muted).font('Helvetica').fontSize(7)
      .text('PROJECT PROPOSAL', 360, 34, { width: 187, align: 'right' })
    doc.fillColor(c.primary).font('Helvetica-Bold').fontSize(8)
      .text(proposal?.proposalNumber || '', 360, 45, { width: 187, align: 'right' })
    doc.moveTo(48, 62).lineTo(547, 62).lineWidth(0.7).stroke(c.divider || '#E5E5E5')

    // Footer: confidentiality, validity and page numbering
    doc.page.margins.bottom = 8
    const fy = 786
    doc.moveTo(48, fy).lineTo(547, fy).lineWidth(0.7).stroke(c.divider || '#E5E5E5')
    doc.fillColor(c.muted).font('Helvetica').fontSize(7.5)
      .text('Confidential', 48, fy + 8)
    const validUntil = this.formatProposalDate(proposal?.validUntil)
    const rightParts = [proposal?.proposalNumber, validUntil ? `Valid until ${validUntil}` : '', `Page ${pageNumber} of ${pageCount}`].filter(Boolean)
    doc.text(rightParts.join('  ·  '), 250, fy + 8, { width: 297, align: 'right' })
  }

  static proposalNewPage(doc, theme) {
    doc.addPage()
  }

  static ensureProposalSpace(doc, theme, needed = 90) {
    if (doc.y + needed > 776) {
      this.proposalNewPage(doc, theme)
      return true
    }
    return false
  }

  static drawProposalHeading(doc, theme, title, subtitle = '') {
    this.ensureProposalSpace(doc, theme, subtitle ? 110 : 80)
    const y = doc.y + 14
    doc.rect(48, y + 3, 30, 3).fill(theme.accent || theme.primary)
    const headingText = theme.headingStyle === 'title' ? title : title.toUpperCase()
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(16)
      .text(headingText, 88, y, { width: 459 })
    let bottom = y + 24
    if (subtitle) {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8.5)
        .text(subtitle, 48, bottom, { width: 499 })
      bottom += 15
    }
    doc.y = bottom + 16
  }

  static drawProposalSubheading(doc, theme, text) {
    this.ensureProposalSpace(doc, theme, 80)
    const y = doc.y + 10
    doc.rect(48, y + 2, 18, 2).fill(theme.accent || theme.primary)
    doc.fillColor(theme.secondary).font('Helvetica-Bold').fontSize(9)
      .text(String(text).toUpperCase(), 76, y - 2, { width: 471 })
    doc.y = y + 18
  }

  static proposalTextHeight(doc, text, width, size = 9.5, font = 'Helvetica') {
    doc.font(font).fontSize(size)
    return doc.heightOfString(String(text ?? ''), { width })
  }

  static drawProposalText(doc, theme, text, options = {}) {
    const {
      x = 48, width = 499, size = 9.5, font = 'Helvetica',
      color, align = 'justify', gapAfter = 10, indent = 0
    } = options
    const paragraphs = String(text ?? '').split(/\r?\n/).map(p => p.trim()).filter(Boolean)
    paragraphs.forEach(paragraph => {
      let remaining = paragraph
      while (remaining.length) {
        if (776 - doc.y < 36) this.proposalNewPage(doc, theme)
        const available = 776 - doc.y - 6
        let lo = 1
        let hi = remaining.length
        let best = 0
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          const h = this.proposalTextHeight(doc, remaining.slice(0, mid), width - indent, size, font)
          if (h <= available) { best = mid; lo = mid + 1 } else { hi = mid - 1 }
        }
        if (!best) {
          this.proposalNewPage(doc, theme)
          continue
        }
        let cut = best
        if (cut < remaining.length) {
          const spaceIndex = remaining.lastIndexOf(' ', cut)
          if (spaceIndex > cut * 0.5) cut = spaceIndex
        }
        const chunk = remaining.slice(0, cut)
        remaining = remaining.slice(cut).replace(/^\s+/, '')
        doc.font(font).fontSize(size).fillColor(color || theme.text || '#222222')
        doc.text(chunk, x + indent, doc.y, { width: width - indent, align })
      }
      doc.y += gapAfter
    })
  }

  static proposalSpacedCaps(text) {
    return String(text || '').replace(/\s+/g, '  ').split('').join(' ')
  }

  static drawProposalCover(doc, proposal, company, theme) {
    doc.addPage()
    doc.rect(0, 0, 595.28, 842).fill(theme.coverBackground || '#111111')
    const coverText = theme.coverText || '#FFFFFF'
    const coverMuted = theme.coverMuted || '#D1D5DB'

    // Brand block: logo + company name + tagline
    const logo = this.proposalLogoPath(company)
    let nameX = 48
    if (theme.showLogo !== false && logo) {
      try {
        doc.image(logo, 48, 54, { width: 104, height: 46, fit: [104, 46] })
        nameX = 164
      } catch (_) {}
    }
    const nameWidth = 547 - nameX
    doc.fillColor(coverText).font('Helvetica-Bold').fontSize(15)
      .text(company?.companyName || 'Datawyn Technologies', nameX, 58, { width: nameWidth })
    doc.fillColor(coverMuted).font('Helvetica').fontSize(9)
      .text('Digital Solutions That Build and Scale', nameX, 80, { width: nameWidth })

    doc.moveTo(48, 128).lineTo(547, 128).lineWidth(0.7).stroke(coverMuted)

    // Hero: kicker, project title, subtitle
    doc.fillColor(coverMuted).font('Helvetica').fontSize(10)
      .text(this.proposalSpacedCaps('Project Proposal'), 48, 168)
    let y = 192
    doc.fillColor(coverText).font('Helvetica-Bold').fontSize(30)
      .text(proposal.projectTitle || 'Project Proposal', 48, y, { width: 499 })
    y = doc.y + 8
    if (proposal.projectSubtitle) {
      doc.fillColor(coverMuted).font('Helvetica').fontSize(12)
        .text(proposal.projectSubtitle, 48, y, { width: 499 })
      y = doc.y + 6
    }

    // Prepared-for block
    const customer = proposal.customerSnapshot || {}
    y = Math.max(y + 30, 400)
    doc.fillColor(coverMuted).font('Helvetica').fontSize(8)
      .text(this.proposalSpacedCaps('Prepared For'), 48, y)
    y += 16
    doc.fillColor(coverText).font('Helvetica-Bold').fontSize(17)
      .text(customer.companyName || 'Client', 48, y, { width: 499 })
    y = doc.y + 6
    const addressSource = customer.billingAddress || customer.address
    const addressText = typeof addressSource === 'string'
      ? addressSource
      : [addressSource?.street, addressSource?.city, addressSource?.state, addressSource?.pincode].filter(Boolean).join(', ')
    const clientLines = [
      customer.contactPerson,
      [customer.email, customer.phone].filter(Boolean).join('  ·  '),
      addressText
    ].filter(Boolean)
    clientLines.forEach(line => {
      doc.fillColor(coverMuted).font('Helvetica').fontSize(9).text(line, 48, y, { width: 499 })
      y = doc.y + 3
    })

    // Metadata grid: two columns of label/value pairs
    const metaY = Math.min(Math.max(y + 26, 520), 640)
    const meta = [
      ['Proposal Number', proposal.proposalNumber],
      ['Proposal Date', this.formatProposalDate(proposal.proposalDate)],
      ['Valid Until', this.formatProposalDate(proposal.validUntil)],
      ['Prepared By', proposal.preparedBy || company?.authorizedSignatory?.name]
    ].filter(([, value]) => value)
    meta.forEach(([label, value], index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const mx = 48 + col * 260
      const my = metaY + row * 52
      doc.fillColor(coverMuted).font('Helvetica').fontSize(7.5)
        .text(this.proposalSpacedCaps(label), mx, my, { width: 240 })
      doc.fillColor(coverText).font('Helvetica-Bold').fontSize(11)
        .text(String(value), mx, my + 13, { width: 240 })
    })

    // Bottom bar
    doc.moveTo(48, 762).lineTo(547, 762).lineWidth(0.7).stroke(coverMuted)
    doc.fillColor(coverMuted).font('Helvetica').fontSize(8)
      .text('Confidential', 48, 774)
    const validUntil = this.formatProposalDate(proposal.validUntil)
    doc.text(validUntil ? `Valid until ${validUntil}` : '', 250, 774, { width: 297, align: 'right' })
  }

  static drawProposalOverview(doc, proposal, company, theme) {
    const hasContent = proposal.projectDescription || proposal.objectives || proposal.proposedSolution
    if (!hasContent) return
    this.proposalNewPage(doc, theme)
    this.drawProposalHeading(doc, theme, 'Project Overview')

    // Client snapshot card
    const customer = proposal.customerSnapshot || {}
    const addressSource = customer.billingAddress || customer.address
    const addressText = typeof addressSource === 'string'
      ? addressSource
      : [addressSource?.street, addressSource?.city, addressSource?.state, addressSource?.pincode].filter(Boolean).join(', ')
    const clientLines = [
      customer.contactPerson,
      [customer.email, customer.phone].filter(Boolean).join('  ·  '),
      customer.gstin ? `GSTIN: ${customer.gstin}` : '',
      addressText
    ].filter(Boolean)
    if (customer.companyName || clientLines.length) {
      const companyH = customer.companyName ? this.proposalTextHeight(doc, customer.companyName, 475, 11, 'Helvetica-Bold') : 0
      const lineHs = clientLines.map(line => this.proposalTextHeight(doc, line, 475, 8, 'Helvetica'))
      const boxH = 16 + (customer.companyName ? companyH + 6 : 0) + lineHs.reduce((sum, h) => sum + h + 3, 0) + 8
      this.ensureProposalSpace(doc, theme, boxH + 10)
      const y = doc.y + 4
      doc.rect(48, y, 499, boxH).fill(theme.lightBackground).lineWidth(0.6).stroke(theme.divider)
      let cy = y + 12
      doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
        .text(this.proposalSpacedCaps('Prepared For'), 60, cy)
      cy += 15
      if (customer.companyName) {
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(11)
          .text(customer.companyName, 60, cy, { width: 475 })
        cy = doc.y + 3
      }
      clientLines.forEach((line, index) => {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text(line, 60, cy, { width: 475 })
        cy = doc.y + 3
      })
      doc.y = y + boxH + 14
    }

    const sections = [
      ['Project Description', proposal.projectDescription],
      ['Project Objectives', proposal.objectives],
      ['Proposed Solution', proposal.proposedSolution]
    ]
    sections.forEach(([label, value]) => {
      if (!value) return
      this.drawProposalSubheading(doc, theme, label)
      if (label === 'Project Objectives') {
        const objectives = String(value).split(/\r?\n/).map(o => o.trim()).filter(Boolean)
        if (objectives.length > 1) {
          objectives.forEach((objective, index) => {
            this.drawProposalText(doc, theme, `${index + 1}.  ${objective}`, { size: 9.5, gapAfter: 5 })
          })
          doc.y += 5
          return
        }
      }
      this.drawProposalText(doc, theme, value, { size: 9.5, gapAfter: 12 })
    })
    this.drawProposalSectionDivider(doc, theme)
  }

  static drawProposalScope(doc, proposal, theme) {
    const items = proposal.scopeOfWork || []
    if (!items.length) return
    this.proposalNewPage(doc, theme)
    this.drawProposalHeading(doc, theme, 'Scope of Work', `${items.length} workstream${items.length === 1 ? '' : 's'} included`)

    items.forEach((item, index) => {
      const title = item.title || 'Scope item'
      const description = item.description || ''
      const bullets = (item.bulletPoints || []).filter(Boolean)

      const titleH = this.proposalTextHeight(doc, title, 430, 11, 'Helvetica-Bold')
      const descH = description ? this.proposalTextHeight(doc, description, 430, 9, 'Helvetica') + 6 : 0
      const bulletHs = bullets.map(point => this.proposalTextHeight(doc, point, 412, 8.5, 'Helvetica') + 4)
      const bulletsH = bulletHs.reduce((sum, h) => sum + h, 0)
      const blockH = titleH + descH + bulletsH + 26

      this.ensureProposalSpace(doc, theme, blockH + 18)
      const top = doc.y + 8

      // Numbered marker
      doc.circle(60, top + 10, 10).fill(theme.primary)
      doc.fillColor(theme.background || '#FFFFFF').font('Helvetica-Bold').fontSize(9)
        .text(String(index + 1), 52, top + 5.5, { width: 16, align: 'center' })

      // Title
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(11)
        .text(title, 84, top, { width: 430 })

      // Description
      let cursor = top + titleH + (description ? 6 : 0)
      if (description) {
        doc.fillColor(theme.text).font('Helvetica').fontSize(9)
          .text(description, 84, cursor, { width: 430, align: 'justify' })
        cursor = doc.y + 4
      }

      // Bullet points
      bullets.forEach((point, bulletIndex) => {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(8.5)
          .text(`-  ${point}`, 88, cursor + 2, { width: 412 })
        cursor += bulletHs[bulletIndex]
      })

      const bottom = Math.max(cursor + 8, top + blockH - 8)
      doc.moveTo(48, bottom).lineTo(547, bottom).lineWidth(0.5).stroke(theme.divider)
      doc.y = bottom + 14
    })
    this.drawProposalSectionDivider(doc, theme)
  }

  static drawProposalDeliverablesAndTechnology(doc, proposal, theme) {
    const deliverables = proposal.deliverables || []
    const technologies = (proposal.technologyStack || []).filter(Boolean)
    if (!deliverables.length && !technologies.length) return
    this.proposalNewPage(doc, theme)
    this.drawProposalHeading(doc, theme, 'Deliverables & Technology', 'Included outputs and selected technology stack')

    deliverables.forEach((item, index) => {
      const name = item.name || 'Deliverable'
      const description = item.description || ''
      const notes = item.notes || ''
      const nameH = this.proposalTextHeight(doc, name, 320, 10.5, 'Helvetica-Bold')
      const descH = description ? this.proposalTextHeight(doc, description, 320, 8.5, 'Helvetica') + 4 : 0
      const notesH = notes ? this.proposalTextHeight(doc, notes, 320, 8, 'Helvetica') + 4 : 0
      const metaH = item.quantity ? 26 : 0
      const cardH = Math.max(46, 16 + nameH + descH + notesH + metaH + 12)

      this.ensureProposalSpace(doc, theme, cardH + 12)
      const top = doc.y + 6
      doc.rect(48, top, 499, cardH).fill(theme.lightBackground)

      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(13)
        .text(String(index + 1).padStart(2, '0'), 60, top + 14, { width: 24 })

      let cy = top + 14
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(10.5)
        .text(name, 92, cy, { width: 320 })
      cy = doc.y + 3
      if (description) {
        doc.fillColor(theme.text).font('Helvetica').fontSize(8.5)
          .text(description, 92, cy, { width: 320, align: 'justify' })
        cy = doc.y + 2
      }
      if (notes) {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
          .text(`Notes: ${notes}`, 92, cy, { width: 320 })
        cy = doc.y + 2
      }
      if (item.quantity) {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
          .text('QUANTITY', 415, top + 14, { width: 110 })
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(11)
          .text(String(item.quantity), 415, top + 26, { width: 110, align: 'right' })
      }
      doc.moveTo(48, top + cardH).lineTo(547, top + cardH).lineWidth(0.5).stroke(theme.divider)
      doc.y = top + cardH + 10
    })

    if (technologies.length) {
      const cols = 3
      const gap = 12
      const chipW = (499 - gap * (cols - 1)) / cols
      const chipRows = []
      for (let start = 0; start < technologies.length; start += cols) {
        const rowItems = technologies.slice(start, start + cols)
        const chipHs = rowItems.map(tech => Math.max(30, this.proposalTextHeight(doc, tech, chipW - 20, 8.5, 'Helvetica-Bold') + 16))
        chipRows.push({ items: rowItems, chipHs, h: Math.max(...chipHs) + gap })
      }
      // Keep the subheading attached to the first chip row
      if (doc.y + 46 + (chipRows[0]?.h || 0) > 776) this.proposalNewPage(doc, theme)
      this.drawProposalSubheading(doc, theme, 'Technology Stack')
      chipRows.forEach(row => {
        this.ensureProposalSpace(doc, theme, row.h + 8)
        const rowY = doc.y + 4
        row.items.forEach((tech, col) => {
          const chipX = 48 + col * (chipW + gap)
          const chipH = row.chipHs[col]
          const textH = this.proposalTextHeight(doc, tech, chipW - 20, 8.5, 'Helvetica-Bold')
          doc.rect(chipX, rowY, chipW, chipH).fill(theme.background).lineWidth(0.7).stroke(theme.divider)
          doc.fillColor(theme.secondary).font('Helvetica-Bold').fontSize(8.5)
            .text(tech, chipX + 10, rowY + (chipH - textH) / 2, { width: chipW - 20, align: 'center' })
        })
        doc.y = rowY + row.h
      })
      doc.y += 8
    }
    this.drawProposalSectionDivider(doc, theme)
  }

  static drawProposalTimeline(doc, proposal, theme) {
    const timeline = proposal.timeline || {}
    const milestones = timeline.milestones || []
    const hasTimeline = timeline.startDate || timeline.estimatedCompletionDate || timeline.duration || milestones.length
    if (!hasTimeline) return
    this.proposalNewPage(doc, theme)
    this.drawProposalHeading(doc, theme, 'Project Timeline', 'Delivery milestones and expected dates')

    // Summary stat boxes
    const stats = [
      ['Start Date', this.formatProposalDate(timeline.startDate)],
      ['Est. Completion', this.formatProposalDate(timeline.estimatedCompletionDate)],
      ['Total Duration', timeline.duration]
    ].filter(([, value]) => value)
    if (stats.length) {
      this.ensureProposalSpace(doc, theme, 60)
      const statW = 499 / stats.length
      const statY = doc.y + 6
      stats.forEach(([label, value], index) => {
        const x = 48 + index * statW
        doc.rect(x, statY, statW - 8, 42).fill(theme.lightBackground)
        doc.fillColor(theme.muted).font('Helvetica').fontSize(7)
          .text(this.proposalSpacedCaps(label), x + 10, statY + 8, { width: statW - 28 })
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(10)
          .text(String(value), x + 10, statY + 20, { width: statW - 28 })
      })
      doc.y = statY + 56
    }

    // Vertical milestone timeline
    const lineX = 62
    let previousCircleBottom = null
    milestones.forEach((milestone, index) => {
      const title = milestone.title || 'Milestone'
      const description = milestone.description || ''
      const dateText = this.formatProposalDate(milestone.expectedDate)
      const durationText = milestone.duration || ''
      const metaText = [dateText, durationText].filter(Boolean).join('  ·  ')

      const titleH = this.proposalTextHeight(doc, title, 335, 10.5, 'Helvetica-Bold')
      const descH = description ? this.proposalTextHeight(doc, description, 459, 8.5, 'Helvetica') + 5 : 0
      const metaH = metaText ? 13 : 0
      const rowH = Math.max(48, titleH + descH + 22)

      const broke = this.ensureProposalSpace(doc, theme, rowH + 10)
      if (broke) previousCircleBottom = null
      const top = doc.y + 6
      const circleY = top + 15

      // Connecting line from previous milestone
      if (previousCircleBottom !== null) {
        doc.moveTo(lineX, previousCircleBottom).lineTo(lineX, circleY - 11).lineWidth(1).stroke(theme.divider)
      }

      // Numbered node
      doc.circle(lineX, circleY, 11).fill(theme.primary)
      doc.fillColor(theme.background || '#FFFFFF').font('Helvetica-Bold').fontSize(8.5)
        .text(String(index + 1), lineX - 8, circleY - 5, { width: 16, align: 'center' })

      // Title and meta
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(10.5)
        .text(title, 88, top + 4, { width: 335 })
      if (metaText) {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
          .text(metaText, 430, top + 8, { width: 110, align: 'right' })
      }
      if (description) {
        doc.fillColor(theme.text).font('Helvetica').fontSize(8.5)
          .text(description, 88, top + 4 + titleH + 5, { width: 459, align: 'justify' })
      }

      previousCircleBottom = circleY + 11
      doc.y = top + rowH
    })
    doc.y += 8
    this.drawProposalSectionDivider(doc, theme)
  }

  static drawProposalPricing(doc, proposal, theme) {
    const items = proposal.items || []
    this.proposalNewPage(doc, theme)
    this.drawProposalHeading(doc, theme, 'Products / Services & Pricing', 'Detailed commercial summary')

    // Column layout: S.No | Product / Service | Description | Qty | Unit Price | Total
    const widths = [24, 150, 155, 34, 72, 64]
    const colX = []
    let accX = 48
    widths.forEach(w => { colX.push(accX); accX += w })

    const drawTableHeader = () => {
      const headerY = doc.y
      doc.rect(48, headerY, 499, 30).fill(theme.primary)
      const headers = ['S.No', 'Product / Service', 'Description', 'Qty', 'Unit Price', 'Total']
      headers.forEach((header, i) => {
        const isNumeric = i >= 3
        doc.fillColor(theme.background || '#FFFFFF').font('Helvetica-Bold').fontSize(8)
        doc.text(header.toUpperCase(), colX[i] + 7, headerY + 10, { width: widths[i] - 14, align: isNumeric ? 'right' : 'left' })
      })
      return headerY + 30
    }

    this.ensureProposalSpace(doc, theme, 90)
    let rowY = drawTableHeader()

    const preparedItems = items.map((item, index) => {
      const name = item.isCustom ? item.customName : item.productSnapshot?.name || 'Product / Service'
      const description = String(item.isCustom ? item.customDescription : item.productSnapshot?.description || '').slice(0, 600)
      const nameH = this.proposalTextHeight(doc, name || 'Product / Service', widths[1] - 16, 8.5, 'Helvetica-Bold')
      const descH = description ? this.proposalTextHeight(doc, description, widths[2] - 16, 7.5, 'Helvetica') : 0
      const rowH = Math.max(32, nameH + descH + 18)
      return { item, index, name: name || 'Product / Service', description, nameH, rowH }
    })

    if (!preparedItems.length) {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(9)
        .text('No priced items in this proposal.', 48, rowY + 10, { width: 499 })
      doc.y = rowY + 34
    }

    preparedItems.forEach(({ item, index, name, description, nameH, rowH }) => {
      if (rowY + rowH > 776) {
        this.proposalNewPage(doc, theme)
        rowY = drawTableHeader()
      }
      doc.rect(48, rowY, 499, rowH).fill(index % 2 ? theme.lightBackground : (theme.background || '#FFFFFF'))
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(8)
        .text(String(index + 1), colX[0] + 7, rowY + 11, { width: widths[0] - 14 })
      doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(8.5)
        .text(name, colX[1] + 8, rowY + 9, { width: widths[1] - 16 })
      if (description) {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
          .text(description, colX[2] + 8, rowY + 9 + nameH + 2, { width: widths[2] - 16 })
      }
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(8)
        .text(String(item.quantity ?? 1), colX[3] + 7, rowY + 11, { width: widths[3] - 14, align: 'right' })
        .text(this.formatProposalCurrency(item.rate), colX[4] + 7, rowY + 11, { width: widths[4] - 14, align: 'right' })
        .font('Helvetica-Bold').fillColor(theme.primary)
        .text(this.formatProposalCurrency(item.total ?? (Number(item.rate || 0) * Number(item.quantity || 1))), colX[5] + 7, rowY + 11, { width: widths[5] - 14, align: 'right' })
      doc.moveTo(48, rowY + rowH).lineTo(547, rowY + rowH).lineWidth(0.5).stroke(theme.divider)
      rowY += rowH
    })

    // Financial summary panel
    const discount = Number(proposal.itemDiscount || 0) + Number(proposal.invoiceDiscount || 0)
    const otherTax = Number(proposal.totalTax || 0) - Number(proposal.cgst || 0) - Number(proposal.sgst || 0) - Number(proposal.igst || 0)
    const roundOff = Number(proposal.roundOff || 0)
    const summaryRows = [
      ['Subtotal', this.formatProposalCurrency(proposal.subtotal)],
      ...(discount > 0 ? [['Discount', `- ${this.formatProposalCurrency(discount)}`]] : []),
      ...(Number(proposal.cgst) > 0 ? [['CGST', this.formatProposalCurrency(proposal.cgst)]] : []),
      ...(Number(proposal.sgst) > 0 ? [['SGST', this.formatProposalCurrency(proposal.sgst)]] : []),
      ...(Number(proposal.igst) > 0 ? [['IGST', this.formatProposalCurrency(proposal.igst)]] : []),
      ...(otherTax > 0.005 ? [['Other Tax', this.formatProposalCurrency(otherTax)]] : []),
      ...(Math.abs(roundOff) > 0.005 ? [['Round Off', this.formatProposalCurrency(roundOff)]] : [])
    ]
    const wordsText = proposal.amountInWords ? String(proposal.amountInWords) : ''
    const wordsMeasure = wordsText ? this.proposalTextHeight(doc, wordsText, 193, 8, 'Helvetica') : 0
    const rowsH = summaryRows.length * 19
    const stripH = 44
    const wordsBlockH = wordsText ? 12 + wordsMeasure + 10 : 0
    const panelH = 18 + rowsH + 10 + stripH + (wordsBlockH ? 10 + wordsBlockH : 0) + 10

    if (rowY + 20 + panelH > 776) {
      this.proposalNewPage(doc, theme)
      this.drawProposalSubheading(doc, theme, 'Commercial Summary')
      rowY = doc.y
    }
    const panelY = rowY + 18
    doc.rect(327, panelY, 220, panelH).fill(theme.lightBackground).lineWidth(0.7).stroke(theme.divider)

    let sy = panelY + 18
    summaryRows.forEach(([label, value]) => {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8.5).text(label, 341, sy, { width: 110 })
      doc.fillColor(theme.text).font('Helvetica').fontSize(9).text(value, 380, sy, { width: 155, align: 'right' })
      sy += 19
    })

    // Grand total strip
    const totalY = panelY + 18 + rowsH + 10
    doc.rect(328, totalY, 218, stripH).fill(theme.primary)
    doc.fillColor(theme.background || '#FFFFFF').font('Helvetica-Bold').fontSize(8)
      .text('GRAND TOTAL', 341, totalY + 14, { width: 120 })
    doc.fontSize(13)
      .text(this.formatProposalCurrency(proposal.grandTotal), 341, totalY + 24, { width: 193, align: 'right' })

    if (wordsText) {
      const wy = totalY + stripH + 10
      doc.fillColor(theme.muted).font('Helvetica').fontSize(7).text('AMOUNT IN WORDS', 341, wy, { width: 193 })
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(8)
        .text(wordsText, 341, wy + 11, { width: 193 })
    }
    doc.y = panelY + panelH + 24
  }

  static drawProposalPaymentTerms(doc, proposal, company, theme) {
    const schedule = proposal.paymentSchedule || []
    const advance = Number(proposal.advanceAmount || 0)
    const balance = proposal.balanceAmount !== undefined && proposal.balanceAmount !== null
      ? Number(proposal.balanceAmount)
      : Math.max(0, Number(proposal.grandTotal || 0) - advance)
    const hasPayment = schedule.length || proposal.paymentTerms || advance > 0 || balance > 0
    const hasTerms = proposal.termsAndConditions || proposal.notes
    if (!hasPayment && !hasTerms) return

    this.proposalNewPage(doc, theme)
    this.drawProposalHeading(doc, theme, 'Payment Terms & Conditions', 'Commercial terms, schedule and conditions')

    // Payment summary stat boxes
    const stats = []
    if (advance > 0) stats.push(['Advance Amount', this.formatProposalCurrency(advance)])
    if (balance > 0) stats.push(['Remaining Balance', this.formatProposalCurrency(balance)])
    if (schedule.length) stats.push(['Installments', `${schedule.length} payment${schedule.length === 1 ? '' : 's'}`])
    if (stats.length) {
      this.ensureProposalSpace(doc, theme, 60)
      const statW = 499 / stats.length
      const statY = doc.y + 4
      stats.forEach(([label, value], index) => {
        const x = 48 + index * statW
        doc.rect(x, statY, statW - 8, 40).fill(theme.lightBackground)
        doc.fillColor(theme.muted).font('Helvetica').fontSize(7)
          .text(this.proposalSpacedCaps(label), x + 10, statY + 7, { width: statW - 28 })
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(10)
          .text(String(value), x + 10, statY + 19, { width: statW - 28 })
      })
      doc.y = statY + 52
    }

    if (proposal.paymentTerms) {
      this.drawProposalSubheading(doc, theme, 'Payment Terms')
      this.drawProposalText(doc, theme, proposal.paymentTerms, { size: 9.5, gapAfter: 12 })
    }

    if (schedule.length) {
      this.drawProposalSubheading(doc, theme, 'Payment Schedule')
      const rows = schedule.map(payment => ({
        stage: payment.stage || 'Payment',
        due: this.formatProposalDate(payment.dueDate),
        pct: payment.percentage !== undefined && payment.percentage !== null ? `${payment.percentage}%` : '',
        amount: this.formatProposalCurrency(payment.amount || 0),
        description: payment.description || ''
      }))
      rows.forEach((row, index) => {
        const descH = row.description ? this.proposalTextHeight(doc, row.description, 240, 8, 'Helvetica') : 0
        const rowH = Math.max(24, 12 + descH + 8)
        this.ensureProposalSpace(doc, theme, rowH + 6)
        const y = doc.y + 3
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(9).text(row.stage, 48, y, { width: 170 })
        doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text(row.due, 226, y + 1, { width: 100 })
        doc.text(row.pct, 334, y + 1, { width: 50, align: 'center' })
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(9).text(row.amount, 392, y, { width: 155, align: 'right' })
        if (row.description) {
          doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text(row.description, 226, y + 13, { width: 321 })
        }
        doc.moveTo(48, y + rowH - 2).lineTo(547, y + rowH - 2).lineWidth(0.4).stroke(theme.divider)
        doc.y = y + rowH + 4
      })
      doc.y += 8
    }

    if (proposal.termsAndConditions) {
      this.drawProposalSubheading(doc, theme, 'Terms & Conditions')
      const lines = String(proposal.termsAndConditions).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const alreadyNumbered = lines.some(line => /^\d+[.)]\s/.test(line))
      if (lines.length > 1 && !alreadyNumbered) {
        lines.forEach((line, index) => {
          this.drawProposalText(doc, theme, `${index + 1}.  ${line}`, { size: 8.5, gapAfter: 4 })
        })
        doc.y += 4
      } else {
        this.drawProposalText(doc, theme, proposal.termsAndConditions, { size: 8.5, gapAfter: 8 })
      }
    }

    if (proposal.notes) {
      this.drawProposalSubheading(doc, theme, 'Additional Notes')
      this.drawProposalText(doc, theme, proposal.notes, { size: 8.5, gapAfter: 8 })
    }
  }

  static drawProposalAcceptance(doc, proposal, company, theme) {
    this.proposalNewPage(doc, theme)
    this.ensureProposalSpace(doc, theme, 560)
    this.drawProposalHeading(doc, theme, 'Acceptance & Authorization', 'Review, sign and return this proposal to confirm')

    // Closing statement
    this.ensureProposalSpace(doc, theme, 60)
    doc.fillColor(theme.muted).font('Helvetica-Oblique').fontSize(10)
      .text('We look forward to building something exceptional together.', 100, doc.y + 8, { width: 399, align: 'center' })
    doc.y += 34

    // Signature panels
    this.ensureProposalSpace(doc, theme, 260)
    const panelY = doc.y + 12
    const panelH = 208
    const panelW = 230
    const gap = 39
    const customer = proposal.customerSnapshot || {}

    const drawPanel = (x, title, fill, lines) => {
      doc.rect(x, panelY, panelW, panelH).fill(fill).lineWidth(0.8).stroke(theme.divider)
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
        .text(this.proposalSpacedCaps(title), x + 16, panelY + 14, { width: panelW - 32 })
      let py = panelY + 34
      lines.forEach(line => {
        if (!line) return
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(line.bold ? 11 : 9)
          .text(line.text, x + 16, py, { width: panelW - 32 })
        py = doc.y + 4
      })
      // Signature area
      const sigY = panelY + panelH - 62
      doc.moveTo(x + 16, sigY).lineTo(x + panelW - 66, sigY).lineWidth(0.9).stroke(theme.primary)
      doc.moveTo(x + panelW - 50, sigY).lineTo(x + panelW - 16, sigY).lineWidth(0.9).stroke(theme.primary)
      doc.fillColor(theme.muted).font('Helvetica').fontSize(7)
        .text('Signature', x + 16, sigY + 5, { width: 120 })
        .text('Date', x + panelW - 50, sigY + 5, { width: 34, align: 'right' })
    }

    drawPanel(48, 'Client Acceptance', theme.background || '#FFFFFF', [
      { text: customer.companyName || 'Client Company', bold: true },
      { text: 'Authorized Person', bold: false },
      { text: customer.contactPerson || '', bold: false }
    ])
    drawPanel(48 + panelW + gap, 'Datawyn Technologies', theme.lightBackground, [
      { text: company?.companyName || 'Datawyn Technologies', bold: true },
      { text: company?.authorizedSignatory?.name || 'Authorized Person', bold: false },
      { text: company?.authorizedSignatory?.designation || '', bold: false }
    ])

    doc.y = panelY + panelH + 18
    const validUntil = this.formatProposalDate(proposal.validUntil)
    doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
      .text(validUntil ? `This proposal is valid until ${validUntil}.` : 'Thank you for considering Datawyn Technologies.', 48, doc.y, { width: 499, align: 'center' })
  }

  static drawProposalSectionDivider(doc, theme) {
    doc.moveTo(48, doc.y + 10).lineTo(547, doc.y + 10).lineWidth(0.7).stroke(theme.divider)
    doc.y += 24
  }

  static formatProposalDate(value) {
    if (!value) return ''
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  static formatProposalCurrency(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  static proposalLogoPath(company) {
    const logo = company?.logo
    if (!logo) return null
    if (logo.startsWith('data:image/')) {
      const match = logo.match(/^data:image\/(png|jpe?g);base64,(.+)$/i)
      if (!match) return null
      try {
        return Buffer.from(match[2], 'base64')
      } catch (_) {
        return null
      }
    }
    const clean = logo.replace(/^\/+/, '')
    if (!/\.(png|jpe?g)$/i.test(clean)) return null
    const candidates = [path.join(process.cwd(), clean), path.join(process.cwd(), 'server', clean), path.join(process.cwd(), 'server', 'uploads', path.basename(logo)), path.join(process.cwd(), 'uploads', path.basename(logo))]
    return candidates.find(candidate => fs.existsSync(candidate)) || null
  }

  static addProposalDetails(doc, proposal, textColor, startY = 0) {
    const customer = proposal.customerSnapshot || {}
    
    const detailsY = startY + 10
    
    // Add proposal number to the header box with better styling
    doc.fillColor('#111827')
      .fontSize(13)
      .font('Helvetica-Bold')
      .text(proposal.proposalNumber || 'N/A', 455, startY - 35, { width: 100, align: 'center' })
    
    // Add separator line for better visual separation
    doc.moveTo(40, detailsY)
      .lineTo(555, detailsY)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    // Proposal details section - two column layout
    let y = detailsY + 25
    
    // Left column - Proposal Details
    doc.fillColor('#374151')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('PROPOSAL DETAILS', 40, y)
    
    y += 25
    
    // Proposal No
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica')
      .text('Proposal No:', 40, y)
    doc.fillColor('#111827')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(proposal.proposalNumber || 'N/A', 120, y)
    y += 20
    
    // Proposal Date
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica')
      .text('Date:', 40, y)
    doc.fillColor('#111827')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(proposal.proposalDate ? new Date(proposal.proposalDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A', 120, y)
    y += 20
    
    // Valid Until
    if (proposal.validUntil) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text('Valid Until:', 40, y)
      doc.fillColor('#111827')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(new Date(proposal.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 120, y)
      y += 20
    }
    
    // Status
    doc.fillColor('#6b7280')
      .fontSize(10)
      .font('Helvetica')
      .text('Status:', 40, y)
    doc.fillColor('#111827')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(proposal.status ? proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1) : 'N/A', 120, y)
    
    // Right column - Bill To
    y = detailsY + 25
    const billToX = 320
    
    doc.fillColor('#374151')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('BILL TO', billToX, y)
    
    y += 25
    
    // Company Name
    doc.fillColor('#111827')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(customer.companyName || 'N/A', billToX, y)
    y += 20
    
    // Contact Person
    if (customer.contactPerson) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(customer.contactPerson, billToX, y)
      y += 18
    }
    
    // Email
    if (customer.email) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(customer.email, billToX, y)
      y += 18
    }
    
    // Phone
    if (customer.phone) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(customer.phone, billToX, y)
      y += 18
    }
    
    // Address
    if (customer.billingAddress) {
      const addr = customer.billingAddress
      const address = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(address, billToX, y, { width: 235 })
    } else if (customer.address) {
      const addr = customer.address
      const address = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(address, billToX, y, { width: 235 })
    }
    
    // GSTIN
    if (customer.gstin) {
      y += 18
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(`GSTIN: ${customer.gstin}`, billToX, y)
    }
    
    // Add separator line
    y += 25
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    return y + 20
  }

  static addProjectOverview(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const overviewY = startY + 20

    // Professional section heading with background
    doc.rect(40, overviewY, 515, 35)
      .fill('#F8F8F8')
    
    doc.fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('PROJECT OVERVIEW', 50, overviewY + 12)

    let y = overviewY + 50

    // Project Description - better spacing
    if (proposal.projectDescription) {
      doc.fillColor('#333333')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.projectDescription, 40, y, {
          width: 515,
          align: 'justify'
        })
      y += 30
    }

    // Objectives - better spacing
    if (proposal.objectives) {
      doc.fillColor('#666666')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('OBJECTIVES', 40, y)
      y += 15
      
      doc.fillColor('#333333')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.objectives, 40, y, {
          width: 515,
          align: 'justify'
        })
      y += 30
    }

    // Proposed Solution - better spacing
    if (proposal.proposedSolution) {
      doc.fillColor('#666666')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('PROPOSED SOLUTION', 40, y)
      y += 15

      doc.fillColor('#333333')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.proposedSolution, 40, y, {
          width: 515,
          align: 'justify'
        })
      y += 30
    }

    // Professional separator line
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#E5E5E5')

    return y + 25
  }

  static addProjectOverviewOld(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const overviewY = startY + 20

    // Add section header with better styling
    doc.fillColor('#374151')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('PROJECT OVERVIEW', 40, overviewY)

    let y = overviewY + 25

    // Project Title - improved styling with better colors
    doc.fillColor('#111827')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(proposal.projectTitle || 'Project Proposal', 40, y)

    y += 35

    // Project Subtitle
    if (proposal.projectSubtitle) {
      doc.fillColor('#6b7280')
        .fontSize(13)
        .font('Helvetica')
        .text(proposal.projectSubtitle, 40, y)
      y += 28
    }

    // Project Description with better formatting
    if (proposal.projectDescription) {
      doc.fillColor('#374151')
        .fontSize(11)
        .font('Helvetica-Bold')
      .text('Project Description:', 40, y)
      y += 18
      
      doc.fillColor('#4b5563')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.projectDescription, 40, y, {
          width: 515,
          align: 'justify'
        })
      y += 35
    }

    // Objectives with better formatting
    if (proposal.objectives) {
      doc.fillColor('#374151')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Project Objectives:', 40, y)
      y += 18
      
      doc.fillColor('#4b5563')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.objectives, 40, y, {
          width: 515,
          align: 'justify'
        })
      y += 35
    }

    // Proposed Solution with better formatting
    if (proposal.proposedSolution) {
      doc.fillColor('#374151')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Proposed Solution:', 40, y)
      y += 18

      doc.fillColor('#4b5563')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.proposedSolution, 40, y, {
          width: 515,
          align: 'justify'
        })
      y += 35
    }

    // Add separator line with better styling
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#e5e7eb')

    return y + 25
  }

  static addScopeOfWork(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const scopeY = startY + 20

    // Professional section heading with background
    doc.rect(40, scopeY, 515, 35)
      .fill('#F8F8F8')
    
    doc.fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('SCOPE OF WORK', 50, scopeY + 12)

    let y = scopeY + 50
    
    if (!proposal.scopeOfWork || proposal.scopeOfWork.length === 0) {
      doc.moveTo(40, y)
        .lineTo(555, y)
        .lineWidth(1)
        .stroke('#E5E5E5')
      return y + 25
    }
    
    proposal.scopeOfWork.forEach((scope, index) => {
      // Professional numbered item with card
      doc.rect(40, y, 515, 70)
        .fill('#FFFFFF')
        .lineWidth(1)
        .stroke('#E5E5E5')
      
      // Number circle
      doc.circle(65, y + 35, 15)
        .fill('#000000')
      
      doc.fillColor('#FFFFFF')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}`, 58, y + 28)
      
      // Item title
      doc.fillColor('#000000')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(scope.title, 90, y + 15, { width: 445 })
      
      // Description
      if (scope.description) {
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
          .text(scope.description, 90, y + 35, {
            width: 445,
            align: 'justify'
          })
      }
      
      // Bullet points
      if (scope.bulletPoints && Array.isArray(scope.bulletPoints) && scope.bulletPoints.length > 0) {
        let bulletY = y + 52
        scope.bulletPoints.forEach((point, i) => {
          if (i < 2) {
            doc.fillColor('#888888')
              .fontSize(8)
              .font('Helvetica')
              .text(`• ${point}`, 90, bulletY, {
                width: 445
              })
            bulletY += 12
          }
        })
      }
      
      y += 80
    })
    
    // Professional separator line
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#E5E5E5')

    return y + 25
  }

  static addScopeOfWorkOld(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const scopeY = startY + 20
    
    // Add section header with better styling
    doc.fillColor('#374151')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('SCOPE OF WORK', 40, scopeY)
    
    let y = scopeY + 25
    
    proposal.scopeOfWork.forEach((scope, index) => {
      // Add separator before each item (except first)
      if (index > 0) {
        doc.moveTo(40, y)
          .lineTo(555, y)
          .lineWidth(0.5)
          .stroke('#e5e7eb')
        y += 15
      }
      
      // Item title with better styling
      doc.fillColor('#111827')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${scope.title}`, 40, y)
      y += 20
      
      if (scope.description) {
        doc.fillColor('#4b5563')
          .fontSize(10)
          .font('Helvetica')
          .text(scope.description, 50, y, {
            width: 505,
            align: 'justify'
          })
        y += 20
      }
      
      if (scope.bulletPoints && scope.bulletPoints.length > 0) {
        scope.bulletPoints.forEach(point => {
          doc.fillColor('#4b5563')
            .fontSize(9)
            .font('Helvetica')
            .text(`• ${point}`, 50, y, {
              width: 505,
              align: 'justify'
            })
          y += 18
        })
      }
      
      y += 15
    })
    
    // Add separator line at the end
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    return y + 20
  }

  static addDeliverables(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const deliverablesY = startY + 20

    // Professional section heading with background
    doc.rect(40, deliverablesY, 515, 35)
      .fill('#F8F8F8')
    
    doc.fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('DELIVERABLES', 50, deliverablesY + 12)

    let y = deliverablesY + 50
    
    if (!proposal.deliverables || proposal.deliverables.length === 0) {
      doc.moveTo(40, y)
        .lineTo(555, y)
        .lineWidth(1)
        .stroke('#E5E5E5')
      return y + 25
    }
    
    proposal.deliverables.forEach((deliverable, index) => {
      // Professional deliverable card
      doc.rect(40, y, 515, 60)
        .fill('#FFFFFF')
        .lineWidth(1)
        .stroke('#E5E5E5')
      
      // Number circle
      doc.circle(65, y + 30, 15)
        .fill('#000000')
      
      doc.fillColor('#FFFFFF')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}`, 58, y + 23)
      
      // Item title
      doc.fillColor('#000000')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(deliverable.name, 90, y + 12, { width: 445 })
      
      // Description
      if (deliverable.description) {
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
          .text(deliverable.description, 90, y + 30, {
            width: 445,
            align: 'justify'
          })
      }
      
      // Quantity
      if (deliverable.quantity) {
        doc.fillColor('#888888')
          .fontSize(8)
          .font('Helvetica')
          .text(`Quantity: ${deliverable.quantity}`, 90, y + 45)
      }
      
      y += 70
    })
    
    // Professional separator line
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#E5E5E5')

    return y + 25
  }

  static addDeliverablesOld(doc, proposal, textColor, startY = 0) {
    const deliverablesY = startY + 20
    
    // Add section header with better styling
    doc.fillColor('#374151')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('DELIVERABLES', 40, deliverablesY)
    
    let y = deliverablesY + 25
    
    proposal.deliverables.forEach((deliverable, index) => {
      // Add separator before each item (except first)
      if (index > 0) {
        doc.moveTo(40, y)
          .lineTo(555, y)
          .lineWidth(0.5)
          .stroke('#e5e7eb')
        y += 15
      }
      
      // Item title with better styling
      doc.fillColor('#111827')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${deliverable.name}`, 40, y)
      y += 20
      
      if (deliverable.description) {
        doc.fillColor('#4b5563')
          .fontSize(10)
          .font('Helvetica')
          .text(deliverable.description, 50, y, {
            width: 505,
            align: 'justify'
          })
        y += 20
      }
      
      if (deliverable.quantity) {
        doc.fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text(`Quantity: ${deliverable.quantity}`, 50, y)
        y += 18
      }
      
      if (deliverable.notes) {
        doc.fillColor('#6b7280')
          .fontSize(9)
          .font('Helvetica')
          .text(`Notes: ${deliverable.notes}`, 50, y)
        y += 18
      }
      
      y += 15
    })
    
    // Add separator line at the end
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    return y + 20
  }

  static addTechnologyStack(doc, proposal, black, primaryText, veryLightGray, lightGray, startY = 0) {
    const techY = startY + 20

    // Professional section heading with background
    doc.rect(40, techY, 515, 35)
      .fill('#F8F8F8')
    
    doc.fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TECHNOLOGY STACK', 50, techY + 12)

    let y = techY + 50
    
    if (!proposal.technologyStack || proposal.technologyStack.length === 0) {
      doc.moveTo(40, y)
        .lineTo(555, y)
        .lineWidth(1)
        .stroke('#E5E5E5')
      return y + 25
    }
    
    // Professional grid of technologies
    const techPerRow = 3
    const techWidth = 165
    const techHeight = 35
    const techGap = 10
    
    proposal.technologyStack.forEach((tech, index) => {
      const col = index % techPerRow
      const row = Math.floor(index / techPerRow)
      
      const x = 40 + (col * (techWidth + techGap))
      const yPos = y + (row * (techHeight + techGap))
      
      // Professional technology box
      doc.rect(x, yPos, techWidth, techHeight)
        .fill('#FFFFFF')
        .lineWidth(1)
        .stroke('#E5E5E5')
      
      // Centered text
      doc.fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(tech, x + 10, yPos + 12, { width: techWidth - 20, align: 'center' })
    })
    
    const rows = Math.ceil(proposal.technologyStack.length / techPerRow)
    const finalY = y + (rows * (techHeight + techGap)) + 15
    
    // Professional separator line
    doc.moveTo(40, finalY)
      .lineTo(555, finalY)
      .lineWidth(1)
      .stroke('#E5E5E5')

    return finalY + 25
  }

  static addTechnologyStackOld(doc, proposal, textColor, startY = 0) {
    const techY = startY + 20
    
    // Add section header with better styling
    doc.fillColor('#374151')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TECHNOLOGY STACK', 40, techY)
    
    let y = techY + 25
    
    // Create a grid of technologies with better styling
    const techPerRow = 4
    const techWidth = 125
    const techHeight = 35
    
    proposal.technologyStack.forEach((tech, index) => {
      const col = index % techPerRow
      const row = Math.floor(index / techPerRow)
      
      const x = 40 + (col * (techWidth + 10))
      const yPos = y + (row * (techHeight + 10))
      
      // Better styled technology box
      doc.rect(x, yPos, techWidth, techHeight)
        .fill('#f9fafb')
        .lineWidth(1)
        .stroke('#d1d5db')
      
      // Better text positioning and styling
      doc.fillColor('#111827')
        .fontSize(10)
        .font('Helvetica')
        .text(tech, x + 10, yPos + 12, { width: techWidth - 20, align: 'center' })
    })
    
    const rows = Math.ceil(proposal.technologyStack.length / techPerRow)
    const finalY = y + (rows * (techHeight + 10)) + 15
    
    // Add separator line
    doc.moveTo(40, finalY)
      .lineTo(555, finalY)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    return finalY + 20
  }

  static addTimeline(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const timelineY = startY + 20

    // Professional section heading with background
    doc.rect(40, timelineY, 515, 35)
      .fill('#F8F8F8')
    
    doc.fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('PROJECT TIMELINE', 50, timelineY + 12)

    let y = timelineY + 50
    
    // Timeline summary box
    const timeline = proposal.timeline || {}
    
    doc.rect(40, y, 515, 40)
      .fill('#FFFFFF')
      .lineWidth(1)
      .stroke('#E5E5E5')
    
    let summaryY = y + 12
    let summaryX = 50
    
    if (timeline.startDate) {
      doc.fillColor('#666666')
        .fontSize(9)
        .font('Helvetica')
        .text('Start Date:', summaryX, summaryY)
      
      doc.fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(new Date(timeline.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), summaryX + 70, summaryY)
      
      summaryX += 180
    }
    
    if (timeline.estimatedCompletionDate) {
      doc.fillColor('#666666')
        .fontSize(9)
        .font('Helvetica')
        .text('Completion:', summaryX, summaryY)
      
      doc.fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(new Date(timeline.estimatedCompletionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), summaryX + 70, summaryY)
      
      summaryX += 180
    }
    
    if (timeline.duration) {
      doc.fillColor('#666666')
        .fontSize(9)
        .font('Helvetica')
        .text('Duration:', summaryX, summaryY)
      
      doc.fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(timeline.duration, summaryX + 70, summaryY)
    }
    
    y += 55
    
    // Professional milestones
    if (timeline.milestones && Array.isArray(timeline.milestones) && timeline.milestones.length > 0) {
      timeline.milestones.forEach((milestone, index) => {
        // Milestone card
        doc.rect(40, y, 515, 55)
          .fill('#FFFFFF')
          .lineWidth(1)
          .stroke('#E5E5E5')
        
        // Number circle
        doc.circle(65, y + 27, 12)
          .fill('#000000')
        
        doc.fillColor('#FFFFFF')
          .fontSize(10)
          .font('Helvetica-Bold')
        .text(`${index + 1}`, 59, y + 21)
        
        // Milestone title
        doc.fillColor('#000000')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(milestone.title || 'Milestone', 85, y + 10, { width: 450 })
        
        // Description
        if (milestone.description) {
          doc.fillColor('#666666')
            .fontSize(8)
            .font('Helvetica')
            .text(milestone.description, 85, y + 28, {
              width: 450,
              align: 'justify'
            })
        }
        
        // Expected date
        if (milestone.expectedDate) {
          doc.fillColor('#888888')
            .fontSize(8)
            .font('Helvetica')
            .text(`Expected: ${new Date(milestone.expectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 85, y + 42)
        }
        
        y += 65
      })
    }
    
    // Professional separator line
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#E5E5E5')

    return y + 25
  }

  static addProposalTable(doc, proposal, darkBlack, white, primaryText, veryLightGray, lightGray, startY = 0) {
    const tableTop = startY + 20
    const rowHeight = 35
    const items = proposal.items || []
    
    // Professional section heading with background
    doc.rect(40, tableTop, 515, 35)
      .fill('#F8F8F8')
    
    doc.fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('PRICING BREAKDOWN', 50, tableTop + 12)

    const actualTableTop = tableTop + 40
    
    // Handle missing items gracefully
    if (!items || items.length === 0) {
      doc.fillColor('#888888')
        .fontSize(10)
        .text('No items in this proposal', 40, actualTableTop + 15)
      return actualTableTop + 40
    }
    
    // Professional table header
    doc.rect(40, actualTableTop, 515, 30)
      .fill('#000000')
    
    // Table headers - white text
    doc.fillColor('#FFFFFF')
      .fontSize(10)
      .font('Helvetica-Bold')
    
    const headers = ['DESCRIPTION', 'QTY', 'RATE', 'TOTAL']
    const colWidths = [280, 80, 80, 105]
    let x = 50
    
    headers.forEach((header, i) => {
      doc.text(header, x, actualTableTop + 10)
      x += colWidths[i]
    })
    
    // Table rows - professional alternating colors
    let y = actualTableTop + rowHeight
    let alternateColor = false
    
    if (!items || items.length === 0) {
      return actualTableTop + 40
    }
    
    items.forEach((item, index) => {
      // Alternate row colors
      if (alternateColor) {
        doc.rect(40, y, 515, rowHeight)
          .fill('#F9F9F9')
      } else {
        doc.rect(40, y, 515, rowHeight)
          .fill('#FFFFFF')
      }
      alternateColor = !alternateColor
      
      // Item data - professional styling
      doc.fillColor('#333333')
        .fontSize(10)
        .font('Helvetica')
      
      x = 50
      
      // Description
      let desc = item.productSnapshot?.name || item.description || item.name || item.customName || 'N/A'
      if (!desc || desc === 'N/A') {
        desc = 'Product/Service'
      }
      doc.text(desc.substring(0, 50), x, y + 12)
      x += colWidths[0]
      
      // Quantity - properly centered
      const quantity = parseFloat(item.quantity) || 1
      doc.text(quantity.toString(), x + 40, y + 12, { align: 'center' })
      x += colWidths[1]
      
      // Rate - properly right aligned
      const rate = parseFloat(item.rate) || 0
      doc.text(`₹${rate.toFixed(2)}`, x + 40, y + 12, { align: 'right' })
      x += colWidths[2]
      
      // Total - properly right aligned
      const total = parseFloat(item.total) || (rate * quantity)
      doc.fillColor('#000000')
        .font('Helvetica-Bold')
        .text(`₹${total.toFixed(2)}`, x + 52, y + 12, { align: 'right' })
      
      y += rowHeight
    })
    
    // Professional table border
    doc.rect(40, actualTableTop, 515, y - actualTableTop)
      .lineWidth(1)
      .stroke('#E5E5E5')
    
    return y + 15
  }

  static addProposalSummary(doc, proposal, black, white, primaryText, secondaryText, startY = 0) {
    // Handle missing financial values with defaults
    const subtotal = parseFloat(proposal.subtotal) || 0
    const itemDiscount = parseFloat(proposal.itemDiscount) || 0
    const invoiceDiscount = parseFloat(proposal.invoiceDiscount) || 0
    const grandTotal = parseFloat(proposal.grandTotal) || 0
    
    // Professional summary section
    let y = startY + 20
    const summaryX = 350
    
    // Professional summary box
    doc.rect(summaryX, y, 205, 110)
      .fill('#F8F8F8')
      .lineWidth(1)
      .stroke('#E5E5E5')
    
    let innerY = y + 15
    
    // Sub Total
    doc.fillColor('#666666')
      .fontSize(10)
      .font('Helvetica')
      .text('Subtotal', summaryX + 15, innerY)
    
    doc.fillColor('#000000')
      .font('Helvetica-Bold')
      .text(`₹${subtotal.toFixed(2)}`, summaryX + 190, innerY, { align: 'right' })
    
    innerY += 22
    
    // Discount (if any)
    const totalDiscount = itemDiscount + invoiceDiscount
    if (totalDiscount > 0) {
      doc.fillColor('#666666')
        .font('Helvetica')
        .text('Discount', summaryX + 15, innerY)
      
      doc.fillColor('#000000')
        .font('Helvetica-Bold')
        .text(`-₹${totalDiscount.toFixed(2)}`, summaryX + 190, innerY, { align: 'right' })
      
      innerY += 22
    }
    
    innerY += 10
    
    // Professional black TOTAL box
    doc.rect(summaryX + 15, innerY, 175, 40)
      .fill('#000000')
    
    doc.fillColor('#FFFFFF')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('TOTAL INVESTMENT', summaryX + 25, innerY + 12)
    
    doc.fillColor('#FFFFFF')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(`₹${grandTotal.toFixed(2)}`, summaryX + 25, innerY + 25)
    
    return y + 130
  }

  static addProposalPaymentTerms(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const paymentTermsY = startY + 20

    // Professional section heading with background
    doc.rect(40, paymentTermsY, 515, 35)
      .fill('#F8F8F8')
    
    doc.fillColor('#000000')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('PAYMENT TERMS', 50, paymentTermsY + 12)

    let y = paymentTermsY + 50
    
    // Professional payment schedule
    if (proposal.paymentSchedule && Array.isArray(proposal.paymentSchedule) && proposal.paymentSchedule.length > 0) {
      const cardWidth = 165
      const cardGap = 10
      
      proposal.paymentSchedule.forEach((payment, index) => {
        const cardX = 40 + (index * (cardWidth + cardGap))
        
        // Professional payment card
        doc.rect(cardX, y, cardWidth, 75)
          .fill('#FFFFFF')
          .lineWidth(1)
          .stroke('#E5E5E5')
        
        // Percentage - centered
        doc.fillColor('#000000')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text(`${payment.percentage || 0}%`, cardX + 15, y + 15, { width: cardWidth - 30, align: 'center' })
        
        // Stage name - centered
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
          .text(payment.stage || 'Stage', cardX + 15, y + 40, { width: cardWidth - 30, align: 'center' })
        
        // Amount - centered
        const amount = payment.amount || 0
        doc.fillColor('#000000')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`₹${amount.toFixed(2)}`, cardX + 15, y + 55, { width: cardWidth - 30, align: 'center' })
      })
      
      y += 90
    } else if (proposal.paymentTerms) {
      // Professional fallback payment terms text
      doc.fillColor('#333333')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.paymentTerms, 40, y, {
          width: 515,
          align: 'justify'
        })
      y += 30
    }
    
    // Professional separator line
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#E5E5E5')

    return y + 25
  }

  static addProposalAmountInWords(doc, proposal, black, primaryText, veryLightGray, startY = 0) {
    const amountWordsY = startY + 20

    // Professional amount in words section
    doc.fillColor('#666666')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('AMOUNT IN WORDS', 40, amountWordsY)
    
    const amountWords = proposal.amountInWords || 'Rupees Only'
    doc.fillColor('#333333')
      .fontSize(10)
      .font('Helvetica')
      .text(amountWords, 40, amountWordsY + 15, {
        width: 515,
        align: 'justify'
      })
    
    return amountWordsY + 35
  }

  static addProposalNotes(doc, proposal, black, primaryText, secondaryText, startY = 0) {
    const notesY = startY + 20

    if (proposal.notes) {
      // Professional section heading with background
      doc.rect(40, notesY, 515, 35)
        .fill('#F8F8F8')
      
      doc.fillColor('#000000')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('NOTES', 50, notesY + 12)
      
      doc.fillColor('#333333')
        .fontSize(10)
        .font('Helvetica')
        .text(proposal.notes, 50, notesY + 50, {
          width: 495,
          align: 'justify'
        })
      
      return notesY + 70
    }
    return notesY
  }

  static addProposalTermsAndConditions(doc, proposal, black, primaryText, veryLightGray, startY = 0) {
    const termsY = startY + 20
    
    if (proposal.termsAndConditions) {
      doc.fillColor('#555555')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('TERMS & CONDITIONS', 40, termsY)
      
      doc.fillColor('#222222')
        .fontSize(9)
        .font('Helvetica')
        .text(proposal.termsAndConditions, 40, termsY + 15, {
          width: 515,
          align: 'justify'
        })
      
      return termsY + 40
    }
    return termsY
  }

  static addProposalBankDetails(doc, company, black, primaryText, secondaryText, startY = 0) {
    const bankY = startY + 20

    const safeCompany = company || {}
    const bankDetails = safeCompany.bankDetails || {}
    
    if (bankDetails.bankName || bankDetails.accountNumber || bankDetails.ifsc) {
      // Professional section heading with background
      doc.rect(40, bankY, 515, 35)
        .fill('#F8F8F8')
      
      doc.fillColor('#000000')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('BANK DETAILS', 50, bankY + 12)
      
      let y = bankY + 50
      
      // Professional bank details box
      doc.rect(40, y, 515, 80)
        .fill('#FFFFFF')
        .lineWidth(1)
        .stroke('#E5E5E5')
      
      let innerY = y + 15
      let col1X = 50
      let col2X = 280
      
      if (bankDetails.bankName) {
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
          .text('Bank Name', col1X, innerY)
        doc.fillColor('#000000')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.bankName, col1X, innerY + 12)
        innerY += 30
      }
      
      if (bankDetails.accountNumber) {
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
          .text('Account Number', col1X, innerY)
        doc.fillColor('#000000')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.accountNumber, col1X, innerY + 12)
        innerY += 30
      }
      
      innerY = y + 15
      
      if (bankDetails.ifsc) {
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
          .text('IFSC Code', col2X, innerY)
        doc.fillColor('#000000')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.ifsc, col2X, innerY + 12)
        innerY += 30
      }
      
      if (bankDetails.branch) {
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
          .text('Branch', col2X, innerY)
        doc.fillColor('#000000')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(bankDetails.branch, col2X, innerY + 12)
      }
      
      return bankY + 125
    }
    return bankY
  }

  static addProposalSignature(doc, proposal, company, black, primaryText, secondaryText, startY = 0) {
    const signatureY = startY + 20

    const safeCompany = company || {}
    
    // Professional separator line
    doc.moveTo(40, signatureY)
      .lineTo(555, signatureY)
      .lineWidth(1)
      .stroke('#E5E5E5')
    
    let currentY = signatureY + 20
    
    // Terms on left - professional
    if (proposal.termsAndConditions) {
      doc.fillColor('#666666')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('TERMS & CONDITIONS', 40, currentY)
      
      doc.fillColor('#333333')
        .fontSize(9)
        .font('Helvetica')
        .text(proposal.termsAndConditions.substring(0, 500) + '...', 40, currentY + 15, {
          width: 280,
          align: 'justify'
        })
    }
    
    // Signature on right - professional
    doc.rect(340, currentY, 200, 90)
      .fill('#FFFFFF')
      .lineWidth(1)
      .stroke('#E5E5E5')
    
    // Signature line
    doc.moveTo(350, currentY + 25)
      .lineTo(530, currentY + 25)
      .lineWidth(2)
      .stroke('#000000')
    
    // Signature details
    let sigY = currentY + 35
    
    if (safeCompany.authorizedSignatory?.name) {
      doc.fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(safeCompany.authorizedSignatory.name, 350, sigY, { width: 180 })
      sigY += 15
      
      if (safeCompany.authorizedSignatory?.designation) {
        doc.fillColor('#666666')
          .fontSize(9)
          .font('Helvetica')
        .text(safeCompany.authorizedSignatory.designation, 350, sigY, { width: 180 })
        sigY += 15
      }
    } else {
      doc.fillColor('#000000')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Authorized Signatory', 350, sigY, { width: 180 })
      sigY += 15
    }
    
    // Company name
    doc.fillColor('#888888')
      .fontSize(8)
      .font('Helvetica')
      .text(safeCompany.companyName || 'Datawyn Technologies', 350, sigY, { width: 180 })
    
    currentY += 100
    
    // Return the final Y position but cap it to avoid footer overlap
    return Math.min(currentY, 730)
  }

  static addProposalFooter(doc, company, black, mediumGray, startY = 750) {
    // Professional footer with background
    const footerY = Math.max(startY + 10, 750)
    const safeCompany = company || {}
    
    // Professional footer background
    doc.rect(0, footerY, 595.28, 60)
      .fill('#F8F8F8')
    
    // Professional separator line
    doc.moveTo(40, footerY)
      .lineTo(555, footerY)
      .lineWidth(1)
      .stroke('#E5E5E5')
    
    // Company details
    let footerTextY = footerY + 15
    
    doc.fillColor('#000000')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(safeCompany.companyName || 'DATAWYN TECHNOLOGIES', 40, footerTextY)
    
    footerTextY += 15
    
    // Contact details
    const contactInfo = [safeCompany.email, safeCompany.phone].filter(Boolean).join(' | ')
    if (contactInfo) {
      doc.fillColor('#666666')
        .fontSize(8)
        .font('Helvetica')
        .text(contactInfo, 40, footerTextY)
      footerTextY += 12
    }
    
    // Website if available
    if (safeCompany.website) {
      doc.fillColor('#666666')
        .fontSize(8)
        .font('Helvetica')
        .text(safeCompany.website, 40, footerTextY)
    }
    
    // Confidential notice and page number
    doc.fillColor('#888888')
      .fontSize(8)
      .font('Helvetica')
      .text('CONFIDENTIAL PROPOSAL', 40, footerY + 45)
    
    doc.fillColor('#888888')
      .fontSize(8)
      .font('Helvetica')
      .text('PAGE 1', 500, footerY + 45, { align: 'right' })
    
    return footerY + 65
  }

  static addTimelineOld(doc, proposal, textColor, startY = 0) {
    const timelineY = startY + 20
    
    // Add section header with better styling
    doc.fillColor('#374151')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('PROJECT TIMELINE', 40, timelineY)
    
    let y = timelineY + 25
    
    // Timeline summary with better formatting
    if (proposal.timeline.startDate) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text('Start Date:', 40, y)
      doc.fillColor('#111827')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(new Date(proposal.timeline.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 100, y)
      y += 18
    }
    
    if (proposal.timeline.estimatedCompletionDate) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text('Estimated Completion:', 40, y)
      doc.fillColor('#111827')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(new Date(proposal.timeline.estimatedCompletionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 100, y)
      y += 18
    }
    
    if (proposal.timeline.duration) {
      doc.fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text('Duration:', 40, y)
      doc.fillColor('#111827')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(proposal.timeline.duration, 100, y)
      y += 25
    }
    
    // Milestones with better formatting
    if (proposal.timeline.milestones && proposal.timeline.milestones.length > 0) {
      doc.fillColor('#374151')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Milestones:', 40, y)
      y += 20
      
      proposal.timeline.milestones.forEach((milestone, index) => {
        // Add separator before each milestone (except first)
        if (index > 0) {
          doc.moveTo(40, y)
            .lineTo(555, y)
            .lineWidth(0.5)
            .stroke('#e5e7eb')
          y += 15
        }
        
        doc.fillColor('#111827')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`${index + 1}. ${milestone.title}`, 50, y)
        y += 18
        
        if (milestone.description) {
          doc.fillColor('#4b5563')
            .fontSize(9)
            .font('Helvetica')
            .text(milestone.description, 50, y, {
              width: 505,
              align: 'justify'
            })
          y += 18
        }
        
        if (milestone.expectedDate) {
          doc.fillColor('#6b7280')
            .fontSize(9)
            .font('Helvetica')
            .text(`Expected: ${new Date(milestone.expectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 50, y)
          y += 18
        }
        
        if (milestone.duration) {
          doc.fillColor('#6b7280')
            .fontSize(9)
            .font('Helvetica')
            .text(`Duration: ${milestone.duration}`, 50, y)
          y += 18
        }
        
        y += 15
      })
    }
    
    // Add separator line at the end
    doc.moveTo(40, y)
      .lineTo(555, y)
      .lineWidth(1)
      .stroke('#e5e7eb')
    
    return y + 20
  }
}
