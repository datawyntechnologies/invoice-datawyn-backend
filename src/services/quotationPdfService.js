import PDFKit from 'pdfkit'
import { PDFService } from './pdfService.js'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 842
const MARGIN = 48
const CONTENT_WIDTH = 499
const CONTENT_RIGHT = MARGIN + CONTENT_WIDTH
const BODY_BOTTOM = 776

// Premium black-and-white quotation theme (fixed, matching Datawyn branding)
const THEME = {
  primary: '#111111',
  secondary: '#333333',
  accent: '#111111',
  background: '#FFFFFF',
  text: '#222222',
  muted: '#6B7280',
  divider: '#D1D5DB',
  light: '#F4F4F4',
  lightBackground: '#F7F7F7',
  coverBackground: '#111111',
  coverText: '#FFFFFF',
  coverMuted: '#D1D5DB'
}

export class QuotationPdfService {
  static async generateQuotation(quotation, companySettings) {
    return new Promise((resolve, reject) => {
      try {
        const theme = THEME
        const doc = new PDFKit({ margin: MARGIN, size: 'A4', bufferPages: true, autoFirstPage: false })
        PDFService.patchProposalTextEncoder(doc)
        const chunks = []
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const originalAddPage = doc.addPage.bind(doc)
        doc.addPage = (...args) => {
          const page = originalAddPage(...args)
          doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(theme.background)
          doc.y = 98
          doc.x = MARGIN
          return page
        }

        this.drawQuotationHeader(doc, quotation, companySettings, theme)
        this.drawClientAndProject(doc, quotation, theme)
        this.drawScopeTable(doc, quotation, theme)
        this.drawPricingSummary(doc, quotation, theme)
        this.drawProjectDetails(doc, quotation, theme)
        this.drawTermsAndApproval(doc, quotation, companySettings, theme)

        const range = doc.bufferedPageRange()
        for (let i = range.start; i < range.start + range.count; i += 1) {
          doc.switchToPage(i)
          this.drawQuotationPageChrome(doc, companySettings, quotation, theme, i + 1, range.count)
        }
        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  // ---------- Layout helpers ----------

  static newPage(doc) {
    doc.addPage()
  }

  static ensureSpace(doc, needed = 90) {
    if (doc.y + needed > BODY_BOTTOM) {
      this.newPage(doc)
      return true
    }
    return false
  }

  static heading(doc, theme, title, subtitle = '') {
    this.ensureSpace(doc, subtitle ? 110 : 80)
    const y = doc.y + 14
    doc.rect(MARGIN, y + 3, 30, 3).fill(theme.accent)
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(16)
      .text(title.toUpperCase(), 88, y, { width: CONTENT_WIDTH - 40 })
    let bottom = y + 24
    if (subtitle) {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8.5)
        .text(subtitle, MARGIN, bottom, { width: CONTENT_WIDTH })
      bottom += 15
    }
    doc.y = bottom + 16
  }

  static subheading(doc, theme, text) {
    this.ensureSpace(doc, 80)
    const y = doc.y + 10
    doc.rect(MARGIN, y + 2, 18, 2).fill(theme.accent)
    doc.fillColor(theme.secondary).font('Helvetica-Bold').fontSize(9)
      .text(String(text).toUpperCase(), 76, y - 2, { width: CONTENT_WIDTH - 28 })
    doc.y = y + 18
  }

  static textHeight(doc, text, width, size = 9.5, font = 'Helvetica') {
    return PDFService.proposalTextHeight(doc, text, width, size, font)
  }

  static drawText(doc, theme, text, options = {}) {
    return PDFService.drawProposalText(doc, theme, text, options)
  }

  static spacedCaps(text) {
    return PDFService.proposalSpacedCaps(text)
  }

  static formatDate(value) {
    return PDFService.formatProposalDate(value)
  }

  static formatCurrency(value) {
    return PDFService.formatProposalCurrency(value)
  }

  // ---------- Chrome (header/footer on continuation pages, footer on all) ----------

  static drawQuotationPageChrome(doc, company, quotation, theme, pageNumber, pageCount) {
    const safeCompany = company || {}
    if (pageNumber > 1) {
      const logo = PDFService.proposalLogoPath(safeCompany)
      let nameX = MARGIN
      if (logo) {
        try {
          doc.image(logo, MARGIN, 30, { width: 30, height: 15, fit: [30, 15] })
          nameX = MARGIN + 36
        } catch (_) {}
      }
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(8.5)
        .text(safeCompany.companyName || 'Datawyn Technologies', nameX, 32, { width: 280 })
      doc.fillColor(theme.muted).font('Helvetica').fontSize(7)
        .text('QUOTATION', 360, 34, { width: 187, align: 'right' })
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(8)
        .text(quotation?.quotationNumber || '', 360, 45, { width: 187, align: 'right' })
      doc.moveTo(MARGIN, 62).lineTo(CONTENT_RIGHT, 62).lineWidth(0.7).stroke(theme.divider)
    }

    // Footer on every page
    doc.page.margins.bottom = 8
    const fy = 786
    doc.moveTo(MARGIN, fy).lineTo(CONTENT_RIGHT, fy).lineWidth(0.7).stroke(theme.divider)
    doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
      .text('Confidential', MARGIN, fy + 8)
    const validUntil = this.formatDate(quotation?.validUntil)
    const rightParts = [quotation?.quotationNumber, validUntil ? `Valid until ${validUntil}` : '', `Page ${pageNumber} of ${pageCount}`].filter(Boolean)
    doc.text(rightParts.join('  ·  '), 250, fy + 8, { width: 297, align: 'right' })
  }

  // ---------- Page 1: Header ----------

  static drawQuotationHeader(doc, quotation, company, theme) {
    doc.addPage()
    const safeCompany = company || {}
    const headerY = doc.y

    // Logo block
    const logo = PDFService.proposalLogoPath(safeCompany)
    let logoLoaded = false
    if (logo) {
      try {
        doc.rect(MARGIN, headerY, 84, 60).lineWidth(1).stroke(theme.divider)
        doc.image(logo, MARGIN + 5, headerY + 5, { width: 74, height: 50, fit: [74, 50] })
        logoLoaded = true
      } catch (_) {}
    }

    const textX = logoLoaded ? MARGIN + 100 : MARGIN
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(20)
      .text(safeCompany.companyName || 'Datawyn Technologies', textX, headerY + 4, { width: 300 })
    doc.fillColor(theme.muted).font('Helvetica').fontSize(9)
      .text('Digital Solutions That Build And Scale', textX, headerY + 30, { width: 300 })

    const address = safeCompany.address || {}
    let ay = headerY + 46
    const addressLines = [
      [address.street, address.city, address.state, address.pincode].filter(Boolean).join(', '),
      safeCompany.email,
      safeCompany.phone,
      safeCompany.gstin ? `GSTIN: ${safeCompany.gstin}` : ''
    ].filter(Boolean)
    addressLines.forEach(line => {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text(line, textX, ay, { width: 300 })
      ay = doc.y + 2
    })

    // QUOTATION badge + meta box (right side)
    const boxX = 380
    const boxW = CONTENT_RIGHT - boxX
    doc.rect(boxX, headerY, boxW, 34).fill(theme.primary)
    doc.fillColor(theme.background).font('Helvetica-Bold').fontSize(15)
      .text('QUOTATION', boxX, headerY + 9, { width: boxW, align: 'center' })

    doc.rect(boxX, headerY + 38, boxW, 58).lineWidth(1).stroke(theme.divider)
    const meta = [
      ['Quotation No', quotation.quotationNumber || 'N/A'],
      ['Date', this.formatDate(quotation.quotationDate)],
      ['Valid Until', this.formatDate(quotation.validUntil) || 'N/A']
    ]
    meta.forEach(([label, value], i) => {
      const my = headerY + 44 + i * 17
      doc.fillColor(theme.muted).font('Helvetica').fontSize(7)
        .text(this.spacedCaps(label), boxX + 10, my, { width: 90 })
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(8.5)
        .text(String(value), boxX + 105, my - 1, { width: boxW - 115 })
    })

    doc.y = headerY + 110
    doc.moveTo(MARGIN, doc.y).lineTo(CONTENT_RIGHT, doc.y).lineWidth(0.8).stroke(theme.divider)
    doc.y += 18
  }

  // ---------- Page 1: Client + Project info ----------

  static drawClientAndProject(doc, quotation, theme) {
    const customer = quotation.customerSnapshot || {}
    const addressSource = quotation.billingAddress || customer.billingAddress || customer.address
    const addressText = typeof addressSource === 'string'
      ? addressSource
      : [addressSource?.street, addressSource?.city, addressSource?.state, addressSource?.pincode].filter(Boolean).join(', ')

    this.ensureSpace(doc, 200)
    let y = doc.y + 6

    // Two-column: CLIENT | PROJECT
    const colW = (CONTENT_WIDTH - 20) / 2

    // Client card
    const clientLines = [
      customer.contactPerson || quotation.contactPerson,
      customer.email || quotation.email,
      customer.phone || quotation.phone,
      customer.gstin ? `GSTIN: ${customer.gstin}` : '',
      addressText
    ].filter(Boolean)

    const clientH = 20 + (customer.companyName || quotation.projectName ? 16 : 0) + clientLines.length * 13 + 14
    doc.rect(MARGIN, y, colW, clientH).fill(theme.lightBackground).lineWidth(0.6).stroke(theme.divider)
    doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
      .text(this.spacedCaps('Client'), MARGIN + 12, y + 10)
    let cy = y + 26
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(11)
      .text(customer.companyName || 'Client', MARGIN + 12, cy, { width: colW - 24 })
    cy = doc.y + 3
    clientLines.forEach(line => {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text(line, MARGIN + 12, cy, { width: colW - 24 })
      cy = doc.y + 2
    })

    // Project card
    const px = MARGIN + colW + 20
    const projLines = [
      quotation.projectCategory,
      quotation.projectDescription
    ].filter(Boolean)
    const projDescH = quotation.projectDescription
      ? this.textHeight(doc, quotation.projectDescription, colW - 24, 8, 'Helvetica') : 0
    const projH = Math.max(clientH, 30 + projDescH + (quotation.projectCategory ? 14 : 0) + 14)
    doc.rect(px, y, colW, projH).fill(theme.lightBackground).lineWidth(0.6).stroke(theme.divider)
    doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
      .text(this.spacedCaps('Project'), px + 12, y + 10)
    let py = y + 26
    doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(11)
      .text(quotation.projectName || 'Project', px + 12, py, { width: colW - 24 })
    py = doc.y + 3
    if (quotation.projectCategory) {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text(quotation.projectCategory, px + 12, py, { width: colW - 24 })
      py = doc.y + 2
    }
    if (quotation.projectDescription) {
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(8)
        .text(quotation.projectDescription, px + 12, py, { width: colW - 24, align: 'justify' })
    }

    doc.y = y + Math.max(clientH, projH) + 20
  }

  // ---------- Page 1: Scope of Work priced table ----------

  static drawScopeTable(doc, quotation, theme) {
    const items = quotation.items || []
    if (!items.length) return

    this.heading(doc, theme, 'Scope of Work', `${items.length} service${items.length === 1 ? '' : 's'} included`)

    // Column layout: S.No | Service / Description | Qty | Unit | Unit Price | Discount | Total
    const widths = [34, 190, 36, 52, 70, 60, 57]
    const colX = []
    let accX = MARGIN
    widths.forEach(w => { colX.push(accX); accX += w })

    const drawTableHeader = () => {
      const headerY = doc.y
      doc.rect(MARGIN, headerY, CONTENT_WIDTH, 26).fill(theme.primary)
      const headers = ['S.No', 'Service / Description', 'Qty', 'Unit', 'Unit Price', 'Discount', 'Total']
      headers.forEach((header, i) => {
        const isNumeric = i >= 2
        doc.fillColor(theme.background).font('Helvetica-Bold').fontSize(7.5)
        doc.text(header.toUpperCase(), colX[i] + 5, headerY + 8, { width: widths[i] - 10, align: isNumeric ? 'right' : 'left' })
      })
      return headerY + 26
    }

    this.ensureSpace(doc, 90)
    let rowY = drawTableHeader()

    const prepared = items.map((item, index) => {
      const name = item.serviceName || 'Service'
      const description = String(item.description || '').slice(0, 800)
      const nameH = this.textHeight(doc, name, widths[1] - 14, 8.5, 'Helvetica-Bold')
      const descH = description ? this.textHeight(doc, description, widths[1] - 14, 7.5, 'Helvetica') : 0
      const rowH = Math.max(30, nameH + descH + 16)
      return { item, index, name, description, nameH, rowH }
    })

    prepared.forEach(({ item, index, name, description, nameH, rowH }) => {
      if (rowY + rowH > BODY_BOTTOM) {
        this.newPage(doc)
        rowY = drawTableHeader()
      }
      doc.rect(MARGIN, rowY, CONTENT_WIDTH, rowH).fill(index % 2 ? theme.lightBackground : theme.background)
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(8)
        .text(String(index + 1), colX[0] + 5, rowY + 10, { width: widths[0] - 10 })
      doc.fillColor(theme.text).font('Helvetica-Bold').fontSize(8.5)
        .text(name, colX[1] + 6, rowY + 8, { width: widths[1] - 12 })
      if (description) {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
          .text(description, colX[1] + 6, rowY + 8 + nameH + 2, { width: widths[1] - 12 })
      }
      const qty = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const discount = Number(item.discount) || 0
      const discountText = discount > 0
        ? (item.discountType === 'percentage' ? `${discount}%` : this.formatCurrency(discount))
        : '-'
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(8)
        .text(String(qty), colX[2] + 5, rowY + 10, { width: widths[2] - 10, align: 'right' })
        .text(item.unit || '', colX[3] + 5, rowY + 10, { width: widths[3] - 10 })
        .text(this.formatCurrency(unitPrice), colX[4] + 5, rowY + 10, { width: widths[4] - 10, align: 'right' })
        .text(discountText, colX[5] + 5, rowY + 10, { width: widths[5] - 10, align: 'right' })
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(8.5)
        .text(this.formatCurrency(item.total ?? qty * unitPrice), colX[6] + 5, rowY + 10, { width: widths[6] - 10, align: 'right' })
      doc.moveTo(MARGIN, rowY + rowH).lineTo(CONTENT_RIGHT, rowY + rowH).lineWidth(0.5).stroke(theme.divider)
      rowY += rowH
    })
    doc.y = rowY + 10
  }

  // ---------- Page 1: Pricing summary ----------

  static drawPricingSummary(doc, quotation, theme) {
    const subtotal = Number(quotation.subtotal) || 0
    const discountAmount = Number(quotation.discountAmount) || 0
    const additionalCharges = Number(quotation.additionalCharges) || 0
    const taxAmount = Number(quotation.taxAmount) || 0
    const taxRate = Number(quotation.taxRate) || 0
    const grandTotal = Number(quotation.grandTotal) || 0

    const rows = [
      ['Subtotal', this.formatCurrency(subtotal)],
      ...(discountAmount > 0 ? [['Discount', `- ${this.formatCurrency(discountAmount)}`]] : []),
      ...(additionalCharges > 0 ? [['Additional Charges', this.formatCurrency(additionalCharges)]] : []),
      ...(taxAmount > 0 ? [[taxRate ? `GST (${taxRate}%)` : 'Tax', this.formatCurrency(taxAmount)]] : []),
    ]

    const wordsText = quotation.amountInWords ? String(quotation.amountInWords) : ''
    const wordsMeasure = wordsText ? this.textHeight(doc, wordsText, 193, 8, 'Helvetica') : 0
    const rowsH = rows.length * 19
    const stripH = 44
    const wordsBlockH = wordsText ? 12 + wordsMeasure + 10 : 0
    const panelH = 18 + rowsH + 10 + stripH + (wordsBlockH ? 10 + wordsBlockH : 0) + 10

    if (doc.y + 20 + panelH > BODY_BOTTOM) {
      this.newPage(doc)
      this.subheading(doc, theme, 'Commercial Summary')
    }
    const panelY = doc.y + 18
    doc.rect(CONTENT_RIGHT - 220, panelY, 220, panelH).fill(theme.lightBackground).lineWidth(0.7).stroke(theme.divider)

    let sy = panelY + 18
    rows.forEach(([label, value]) => {
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8.5).text(label, CONTENT_RIGHT - 206, sy, { width: 110 })
      doc.fillColor(theme.text).font('Helvetica').fontSize(9).text(value, CONTENT_RIGHT - 67, sy, { width: 155, align: 'right' })
      sy += 19
    })

    const totalY = panelY + 18 + rowsH + 10
    doc.rect(CONTENT_RIGHT - 219, totalY, 218, stripH).fill(theme.primary)
    doc.fillColor(theme.background).font('Helvetica-Bold').fontSize(8)
      .text('GRAND TOTAL', CONTENT_RIGHT - 206, totalY + 14, { width: 120 })
    doc.fontSize(13)
      .text(this.formatCurrency(grandTotal), CONTENT_RIGHT - 206, totalY + 24, { width: 193, align: 'right' })

    if (wordsText) {
      const wy = totalY + stripH + 10
      doc.fillColor(theme.muted).font('Helvetica').fontSize(7).text('AMOUNT IN WORDS', CONTENT_RIGHT - 206, wy, { width: 193 })
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(8)
        .text(wordsText, CONTENT_RIGHT - 206, wy + 11, { width: 193 })
    }
    doc.y = panelY + panelH + 24
  }

  // ---------- Page 2: Project details ----------

  static drawProjectDetails(doc, quotation, theme) {
    const inclusions = (quotation.inclusions || []).filter(Boolean)
    const exclusions = (quotation.exclusions || []).filter(Boolean)
    const additionalCharges = Number(quotation.additionalCharges) || 0
    const timeline = quotation.timeline || {}
    const milestones = timeline.milestones || []
    const payments = quotation.paymentTerms || []
    const hasContent = inclusions.length || exclusions.length || additionalCharges > 0 ||
      timeline.estimatedStartDate || timeline.estimatedDuration || timeline.deliveryDate ||
      milestones.length || payments.length
    if (!hasContent) return

    this.newPage(doc)
    this.heading(doc, theme, 'Project Details', 'Deliverables, timeline, charges and payment schedule')

    // Included / Excluded two-column lists
    if (inclusions.length || exclusions.length) {
      this.subheading(doc, theme, 'Scope Boundaries')
      const colW = (CONTENT_WIDTH - 20) / 2
      const listH = (arr) => arr.reduce((sum, item) => sum + this.textHeight(doc, `-  ${item}`, colW - 24, 8.5, 'Helvetica') + 4, 0)
      const boxH = Math.max(30, Math.max(listH(inclusions), listH(exclusions)) + 30)
      this.ensureSpace(doc, boxH + 16)
      const y = doc.y + 4

      const drawList = (x, title, arr) => {
        doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
          .text(this.spacedCaps(title), x + 12, y + 10)
        let ly = y + 26
        arr.forEach(item => {
          doc.fillColor(theme.secondary).font('Helvetica').fontSize(8.5)
            .text(`-  ${item}`, x + 12, ly, { width: colW - 24 })
          ly = doc.y + 4
        })
      }

      doc.rect(MARGIN, y, colW, boxH).fill(theme.lightBackground).lineWidth(0.6).stroke(theme.divider)
      doc.rect(MARGIN + colW + 20, y, colW, boxH).fill(theme.lightBackground).lineWidth(0.6).stroke(theme.divider)
      if (inclusions.length) drawList(MARGIN, 'Included', inclusions)
      else doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text('None specified', MARGIN + 12, y + 26)
      if (exclusions.length) drawList(MARGIN + colW + 20, 'Excluded', exclusions)
      else doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text('None specified', MARGIN + colW + 32, y + 26)
      doc.y = y + boxH + 16
    }

    // Timeline
    if (timeline.estimatedStartDate || timeline.estimatedDuration || timeline.deliveryDate || milestones.length) {
      this.subheading(doc, theme, 'Project Timeline')
      const dateRows = [
        ['Estimated Start', this.formatDate(timeline.estimatedStartDate)],
        ['Estimated Duration', timeline.estimatedDuration],
        ['Delivery Date', this.formatDate(timeline.deliveryDate)]
      ].filter(([, v]) => v)

      if (dateRows.length) {
        this.ensureSpace(doc, 40 + dateRows.length * 20)
        const y = doc.y + 4
        dateRows.forEach(([label, value], i) => {
          const ry = y + i * 20
          doc.fillColor(theme.muted).font('Helvetica').fontSize(8).text(this.spacedCaps(label), MARGIN + 12, ry, { width: 200 })
          doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(9).text(String(value), MARGIN + 220, ry, { width: 200 })
          doc.moveTo(MARGIN + 12, ry + 16).lineTo(CONTENT_RIGHT - 12, ry + 16).lineWidth(0.4).stroke(theme.divider)
        })
        doc.y = y + dateRows.length * 20 + 12
      }

      milestones.forEach((milestone, index) => {
        const descH = milestone.description ? this.textHeight(doc, milestone.description, 330, 8, 'Helvetica') : 0
        const rowH = Math.max(26, descH + 22)
        this.ensureSpace(doc, rowH + 8)
        const y = doc.y + 4
        doc.circle(MARGIN + 12, y + 10, 9).fill(theme.primary)
        doc.fillColor(theme.background).font('Helvetica-Bold').fontSize(8)
          .text(String(index + 1), MARGIN + 5, y + 6, { width: 14, align: 'center' })
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(9.5)
          .text(milestone.title || 'Milestone', MARGIN + 30, y, { width: 240 })
        const meta = [milestone.expectedDate ? this.formatDate(milestone.expectedDate) : '', milestone.duration || ''].filter(Boolean).join('  ·  ')
        if (meta) {
          doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
            .text(meta, MARGIN + 330, y + 1, { width: 190, align: 'right' })
        }
        if (milestone.description) {
          doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
            .text(milestone.description, MARGIN + 30, y + 15, { width: 430 })
        }
        doc.moveTo(MARGIN, y + rowH).lineTo(CONTENT_RIGHT, y + rowH).lineWidth(0.4).stroke(theme.divider)
        doc.y = y + rowH + 8
      })
      doc.y += 6
    }

    // Additional charges
    if (additionalCharges > 0) {
      this.subheading(doc, theme, 'Additional Charges')
      this.ensureSpace(doc, 40)
      const y = doc.y + 4
      doc.rect(MARGIN, y, CONTENT_WIDTH, 34).fill(theme.lightBackground).lineWidth(0.6).stroke(theme.divider)
      doc.fillColor(theme.secondary).font('Helvetica').fontSize(9).text('Miscellaneous / Additional Charges', MARGIN + 14, y + 11)
      doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(10)
        .text(this.formatCurrency(additionalCharges), CONTENT_RIGHT - 120, y + 10, { width: 100, align: 'right' })
      doc.y = y + 46
    }

    // Payment schedule
    if (payments.length) {
      this.subheading(doc, theme, 'Payment Schedule')
      payments.forEach((payment, index) => {
        const descH = payment.description ? this.textHeight(doc, payment.description, 300, 8, 'Helvetica') : 0
        const rowH = Math.max(26, descH + 20)
        this.ensureSpace(doc, rowH + 6)
        const y = doc.y + 3
        doc.fillColor(index % 2 ? theme.lightBackground : theme.background)
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowH).fill(theme.lightBackground).lineWidth(0.4).stroke(theme.divider)
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(9)
          .text(payment.stage || 'Payment', MARGIN + 12, y + 8, { width: 200 })
        const pct = payment.percentage !== undefined && payment.percentage !== null ? `${payment.percentage}%` : ''
        const meta = [pct, payment.dueDate ? this.formatDate(payment.dueDate) : ''].filter(Boolean).join('  ·  ')
        if (meta) {
          doc.fillColor(theme.muted).font('Helvetica').fontSize(7.5)
            .text(meta, MARGIN + 230, y + 9, { width: 120 })
        }
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(9.5)
          .text(this.formatCurrency(payment.amount), CONTENT_RIGHT - 140, y + 8, { width: 120, align: 'right' })
        if (payment.description) {
          doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
            .text(payment.description, MARGIN + 12, y + 20, { width: 460 })
        }
        doc.y = y + rowH + 5
      })
      doc.y += 8
    }
  }

  // ---------- Final page: Terms & Approval ----------

  static drawTermsAndApproval(doc, quotation, company, theme) {
    const terms = quotation.termsAndConditions
    const notes = quotation.notes
    const hasTerms = terms || notes

    this.newPage(doc)
    this.heading(doc, theme, 'Terms & Approval', 'Terms, conditions and client acceptance')

    if (hasTerms) {
      if (terms) {
        this.subheading(doc, theme, 'Terms & Conditions')
        const lines = String(terms).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        const alreadyNumbered = lines.some(line => /^\d+[.)]\s/.test(line))
        if (lines.length > 1 && !alreadyNumbered) {
          lines.forEach((line, index) => {
            this.drawText(doc, theme, `${index + 1}.  ${line}`, { size: 8.5, gapAfter: 4 })
          })
          doc.y += 4
        } else {
          this.drawText(doc, theme, terms, { size: 8.5, gapAfter: 8 })
        }
      }
      if (notes) {
        this.subheading(doc, theme, 'Notes')
        this.drawText(doc, theme, notes, { size: 8.5, gapAfter: 8 })
      }
    }

    // Acceptance statement + signature panels
    this.ensureSpace(doc, 300)
    doc.fillColor(theme.muted).font('Helvetica-Oblique').fontSize(10)
      .text('We look forward to working with you.', MARGIN + 100, doc.y + 8, { width: CONTENT_WIDTH - 100, align: 'center' })
    doc.y += 34

    this.ensureSpace(doc, 260)
    const panelY = doc.y + 12
    const panelH = 200
    const panelW = 230
    const gap = 39
    const customer = quotation.customerSnapshot || {}

    const drawPanel = (x, title, fill, lines) => {
      doc.rect(x, panelY, panelW, panelH).fill(fill).lineWidth(0.8).stroke(theme.divider)
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
        .text(this.spacedCaps(title), x + 16, panelY + 14, { width: panelW - 32 })
      let py = panelY + 34
      lines.forEach(line => {
        if (!line) return
        doc.fillColor(theme.primary).font('Helvetica-Bold').fontSize(line.bold ? 11 : 9)
          .text(line.text, x + 16, py, { width: panelW - 32 })
        py = doc.y + 4
      })
      const sigY = panelY + panelH - 62
      doc.moveTo(x + 16, sigY).lineTo(x + panelW - 66, sigY).lineWidth(0.9).stroke(theme.primary)
      doc.moveTo(x + panelW - 50, sigY).lineTo(x + panelW - 16, sigY).lineWidth(0.9).stroke(theme.primary)
      doc.fillColor(theme.muted).font('Helvetica').fontSize(7)
        .text('Signature', x + 16, sigY + 5, { width: 120 })
        .text('Date', x + panelW - 50, sigY + 5, { width: 34, align: 'right' })
    }

    drawPanel(MARGIN, 'Client Acceptance', theme.background, [
      { text: customer.companyName || 'Client Company', bold: true },
      { text: 'Authorized Person', bold: false },
      { text: customer.contactPerson || '', bold: false }
    ])
    drawPanel(MARGIN + panelW + gap, 'Datawyn Technologies', theme.lightBackground, [
      { text: company?.companyName || 'Datawyn Technologies', bold: true },
      { text: company?.authorizedSignatory?.name || 'Authorized Person', bold: false },
      { text: company?.authorizedSignatory?.designation || '', bold: false }
    ])

    doc.y = panelY + panelH + 18
    const validUntil = this.formatDate(quotation.validUntil)
    doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
      .text(validUntil ? `This quotation is valid until ${validUntil}.` : 'Thank you for considering Datawyn Technologies.', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' })

    // Contact footer strip
    const safeCompany = company || {}
    const contact = [safeCompany.email, safeCompany.phone].filter(Boolean).join('  ·  ')
    if (contact) {
      doc.y += 10
      doc.fillColor(theme.muted).font('Helvetica').fontSize(8)
        .text(contact, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' })
    }
  }
}
