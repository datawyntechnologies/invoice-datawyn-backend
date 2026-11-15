import { config } from '../config/env.js'
import crypto from 'crypto'
import mongoose from 'mongoose'
import Proposal from '../models/Proposal.js'
import Customer from '../models/Customer.js'
import CompanySettings from '../models/CompanySettings.js'
import ProposalTheme from '../models/ProposalTheme.js'
import { generateProposalNumber } from '../utils/generateInvoiceNumber.js'
import { CalculationService } from '../services/calculationService.js'
import { PDFService } from '../services/pdfService.js'
import { EmailService } from '../services/emailService.js'
import { normalizeProposalTheme } from '../utils/proposalThemes.js'
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js'

export const getProposals = async (req, res, next) => {
  try {
    await Proposal.updateMany(
      { status: { $in: ['sent', 'viewed', 'under_review', 'changes_requested'] }, validUntil: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    )
    const { page = 1, limit = 10, search, status, customer } = req.query
    
    const query = {}
    
    if (search) {
      query.$or = [
        { proposalNumber: { $regex: search, $options: 'i' } },
        { 'customerSnapshot.companyName': { $regex: search, $options: 'i' } },
        { projectTitle: { $regex: search, $options: 'i' } }
      ]
    }
    
    if (status) {
      query.status = status
    }
    
    if (customer) {
      query.customer = customer
    }
    
    const skip = (page - 1) * limit
    
    const [proposals, total] = await Promise.all([
      Proposal.find(query)
        .select('-sharing.tokenHash -versionHistory.snapshot')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('customer', 'companyName')
        .populate('createdBy', 'name'),
      Proposal.countDocuments(query)
    ])
    
    paginatedResponse(res, proposals, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    })
  } catch (error) {
    next(error)
  }
}

export const getProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .select('-sharing.tokenHash -versionHistory.snapshot')
      .populate('customer', 'companyName')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
    
    if (!proposal) {
      return errorResponse(res, 'Proposal not found', [], 404)
    }
    
    successResponse(res, proposal)
  } catch (error) {
    next(error)
  }
}

export const createProposal = async (req, res, next) => {
  try {
    const { customer, items, scopeOfWork, deliverables, timeline, technologyStack, ...proposalData } = req.body
    
    // Validate customer
    if (!customer) {
      return errorResponse(res, 'Customer is required')
    }
    
    if (!items || items.length === 0) {
      return errorResponse(res, 'At least one item is required')
    }
    
    if (!proposalData.projectTitle) {
      return errorResponse(res, 'Project title is required')
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
      
      const isCustom = item.isCustom || false
      
      if (isCustom) {
        return {
          ...item,
          quantity,
          rate,
          discount,
          gstRate,
          isCustom: true,
          customName: item.customName || 'Custom Item',
          customDescription: item.customDescription || '',
          productSnapshot: {
            code: '',
            name: item.customName || 'Custom Item',
            description: item.customDescription || '',
            unit: '',
            hsnSacCode: ''
          },
          customerStateCode: customerDoc.billingAddress?.stateCode || ''
        }
      } else {
        return {
          ...item,
          quantity,
          rate,
          discount,
          gstRate,
          isCustom: false,
          productSnapshot: {
            code: product?.code || '',
            name: product?.name || '',
            description: product?.description || '',
            unit: product?.unit || '',
            hsnSacCode: product?.hsnSacCode || ''
          },
          customerStateCode: customerDoc.billingAddress?.stateCode || ''
        }
      }
    }))
    
    // Calculate proposal totals
    const calculations = CalculationService.calculateInvoice(
      { items: itemsWithSnapshots, ...proposalData, enableGST: proposalData.enableGST !== undefined ? proposalData.enableGST : true },
      companyStateCode
    )
    
    // Generate proposal number
    const proposalNumber = await generateProposalNumber('PROP')
    
    // Create proposal
    const proposal = await Proposal.create({
      proposalNumber,
      customer,
      customerSnapshot,
      items: calculations.items,
      scopeOfWork: scopeOfWork || [],
      deliverables: deliverables || [],
      technologyStack: technologyStack || [],
      timeline: timeline || {},
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
      ...proposalData
    })
    
    snapshotProposal(proposal, req.user._id, 'Initial proposal version')
    await proposal.save()
    successResponse(res, proposal, 'Proposal created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateProposal = async (req, res, next) => {
  try {
    const { customer, items, scopeOfWork, deliverables, timeline, technologyStack, ...proposalData } = req.body
    
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) {
      return errorResponse(res, 'Proposal not found', [], 404)
    }
    
    // Get company settings
    const companySettings = await CompanySettings.findOne()
    const companyStateCode = companySettings?.address?.stateCode || ''
    
    // Recalculate if items provided
    let calculations
    if (items && items.length > 0) {
      const customerDoc = await Customer.findById(customer || proposal.customer)
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
        
        const isCustom = item.isCustom || false
        
        if (isCustom) {
          return {
            ...item,
            isCustom: true,
            customName: item.customName || 'Custom Item',
            customDescription: item.customDescription || '',
            productSnapshot: {
              code: '',
              name: item.customName || 'Custom Item',
              description: item.customDescription || '',
              unit: '',
              hsnSacCode: ''
            },
            customerStateCode: customerDoc.billingAddress?.stateCode
          }
        } else {
          return {
            ...item,
            isCustom: false,
            productSnapshot: {
              code: product?.code,
              name: product?.name,
              description: product?.description,
              unit: product?.unit,
              hsnSacCode: product?.hsnSacCode
            },
            customerStateCode: customerDoc.billingAddress?.stateCode
          }
        }
      }))
      
      calculations = CalculationService.calculateInvoice(
        { items: itemsWithSnapshots, ...proposalData, enableGST: proposalData.enableGST !== undefined ? proposalData.enableGST : true },
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
      scopeOfWork,
      deliverables,
      technologyStack,
      timeline,
      updatedBy: req.user._id,
      ...proposalData
    } : {
      scopeOfWork,
      deliverables,
      technologyStack,
      timeline,
      updatedBy: req.user._id,
      ...proposalData
    }
    
    const updatedProposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('customer', 'companyName')
    
    snapshotProposal(updatedProposal, req.user._id, 'Proposal updated')
    await updatedProposal.save()
    successResponse(res, updatedProposal, 'Proposal updated successfully')
  } catch (error) {
    next(error)
  }
}

export const deleteProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findByIdAndDelete(req.params.id)
    
    if (!proposal) {
      return errorResponse(res, 'Proposal not found', [], 404)
    }
    
    successResponse(res, null, 'Proposal deleted successfully')
  } catch (error) {
    next(error)
  }
}

export const duplicateProposal = async (req, res, next) => {
  try {
    const originalProposal = await Proposal.findById(req.params.id)
    
    if (!originalProposal) {
      return errorResponse(res, 'Proposal not found', [], 404)
    }
    
    // Generate new proposal number
    const proposalNumber = await generateProposalNumber('PROP')
    
    // Create duplicate
    const duplicate = await Proposal.create({
      ...originalProposal.toObject(),
      _id: undefined,
      proposalNumber,
      proposalDate: new Date(),
      validUntil: null,
      status: 'draft',
      createdBy: req.user._id,
      updatedBy: undefined,
      statusHistory: [],
      versionHistory: [],
      sharing: { enabled: false },
      clientDecision: undefined
    })
    snapshotProposal(duplicate, req.user._id, 'Duplicated proposal version')
    await duplicate.save()
    
    successResponse(res, duplicate, 'Proposal duplicated successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const updateProposalStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) {
      return errorResponse(res, 'Proposal not found', [], 404)
    }
    
    const validStatuses = ['draft', 'sent', 'viewed', 'under_review', 'changes_requested', 'accepted', 'rejected', 'expired']
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid proposal status')
    }
    
    // Add to status history
    proposal.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date()
    })
    
    proposal.status = status
    proposal.updatedBy = req.user._id
    await proposal.save()
    
    successResponse(res, proposal, 'Proposal status updated successfully')
  } catch (error) {
    next(error)
  }
}

export const downloadPDF = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return errorResponse(res, 'Proposal not found', [], 404)
    const [companySettings, theme] = await Promise.all([CompanySettings.findOne(), getProposalThemeForRequest(req, proposal)])
    const pdfBuffer = await PDFService.generateProposal(preparePublicProposal(proposal.toObject()), companySettings, theme)
    const filename = proposalFilename(proposal)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('X-Proposal-Filename', encodeURIComponent(filename))
    res.send(pdfBuffer)
  } catch (error) {
    console.error('PDF generation error:', error)
    return errorResponse(res, `Failed to generate PDF: ${error.message}`, [], 500)
  }
}

const preparePublicProposal = (proposal) => ({
  ...proposal,
  scopeOfWork: proposal.scopeOfWork || [],
  deliverables: proposal.deliverables || [],
  technologyStack: proposal.technologyStack || [],
  items: proposal.items || [],
  timeline: proposal.timeline || {},
  paymentSchedule: proposal.paymentSchedule || [],
  internalNotes: undefined,
  customer: undefined,
  createdBy: undefined,
  updatedBy: undefined,
  sharing: undefined,
  clientDecision: undefined,
  versionHistory: undefined,
  statusHistory: undefined
})

const getProposalThemeForRequest = async (req, proposal) => {
  if (proposal?.sharing?.pdfTheme?.config) return normalizeProposalTheme(proposal.sharing.pdfTheme.config)
  const themeId = req.body?.themeId || req.query?.themeId
  if (themeId && mongoose.isValidObjectId(themeId)) {
    const theme = await ProposalTheme.findById(themeId)
    if (theme) return normalizeProposalTheme(theme.config)
  }
  const theme = await ProposalTheme.findOne({ isDefault: true }).lean()
  return normalizeProposalTheme(theme?.config)
}

const proposalFilename = (proposal) => {
  const client = proposal.customerSnapshot?.companyName || 'Client'
  const safeClient = client.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `Datawyn_Proposal_${proposal.proposalNumber}_${safeClient}.pdf`
}

const addStatusHistory = (proposal, status, userId, notes = '') => {
  proposal.statusHistory.push({ status, changedBy: userId, changedAt: new Date(), notes })
  proposal.status = status
}

const snapshotProposal = (proposal, userId, reason) => {
  const currentVersion = proposal.versionHistory?.length || 0
  proposal.versionHistory = [...(proposal.versionHistory || []), {
    version: currentVersion + 1,
    snapshot: preparePublicProposal(proposal.toObject ? proposal.toObject() : proposal),
    changedBy: userId,
    changedAt: new Date(),
    reason
  }]
  proposal.clientDecision = { ...(proposal.clientDecision || {}), acceptedVersion: currentVersion + 1 }
}

export const generateProposalPDF = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return errorResponse(res, 'Proposal not found', [], 404)
    const [companySettings, theme] = await Promise.all([CompanySettings.findOne(), getProposalThemeForRequest(req, proposal)])
    const pdfBuffer = await PDFService.generateProposal(preparePublicProposal(proposal.toObject()), companySettings, theme)
    successResponse(res, { filename: proposalFilename(proposal), generatedAt: new Date(), themeId: theme.themeId })
  } catch (error) { next(error) }
}

export const sendProposal = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return errorResponse(res, 'Proposal not found', [], 404)
    const email = req.body.email || proposal.customerSnapshot?.email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse(res, 'A valid client email is required')
    const [companySettings, theme] = await Promise.all([CompanySettings.findOne(), getProposalThemeForRequest(req, proposal)])
    const pdfBuffer = await PDFService.generateProposal(preparePublicProposal(proposal.toObject()), companySettings, theme)
    const share = await ensureShareLink(proposal, req.user._id, req.body.expiresInDays)
    await EmailService.sendProposal(proposal.toObject(), { ...req.body, email }, pdfBuffer, companySettings, theme, share.url)
    addStatusHistory(proposal, 'sent', req.user._id, 'Proposal sent by email')
    proposal.sentAt = new Date()
    await proposal.save()
    successResponse(res, { shareUrl: share.url, status: proposal.status }, 'Proposal email sent successfully')
  } catch (error) {
    console.error('Proposal email error:', error)
    return errorResponse(res, `Failed to send proposal: ${error.message}`, [], 500)
  }
}

const ensureShareLink = async (proposal, userId, expiresInDays = 30) => {
  const token = crypto.randomBytes(32).toString('base64url')
  proposal.sharing = {
    ...(proposal.sharing || {}),
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    tokenVersion: (proposal.sharing?.tokenVersion || 0) + 1,
    enabled: true,
    expiresAt: new Date(Date.now() + Math.min(Math.max(Number(expiresInDays) || 30, 1), 365) * 86400000),
    revokedAt: null,
    pdfTheme: proposal.sharing?.pdfTheme || undefined
  }
  await proposal.save()
  const base = (config.clientUrl?.[0] || process.env.CLIENT_URL || '').replace(/\/$/, '')
  return { token, url: `${base}/proposal/view/${token}` }
}

export const createShareLink = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return errorResponse(res, 'Proposal not found', [], 404)
    const share = await ensureShareLink(proposal, req.user._id, req.body.expiresInDays)
    successResponse(res, { url: share.url, expiresAt: proposal.sharing.expiresAt }, 'Proposal link created')
  } catch (error) { next(error) }
}

export const revokeShareLink = async (req, res, next) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
    if (!proposal) return errorResponse(res, 'Proposal not found', [], 404)
    proposal.sharing.enabled = false
    proposal.sharing.revokedAt = new Date()
    proposal.sharing.tokenHash = undefined
    await proposal.save()
    successResponse(res, null, 'Proposal link revoked')
  } catch (error) { next(error) }
}

const findPublicProposal = async (token) => {
  if (!token || token.length < 20) return null
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const proposal = await Proposal.findOne({ 'sharing.tokenHash': hash, 'sharing.enabled': true }).select('+sharing.tokenHash')
  if (!proposal || proposal.sharing.revokedAt || (proposal.sharing.expiresAt && proposal.sharing.expiresAt < new Date())) return null
  return proposal
}

export const getPublicProposal = async (req, res, next) => {
  try {
    const proposal = await findPublicProposal(req.params.token)
    if (!proposal) return errorResponse(res, 'This proposal link is invalid or has expired', [], 404)
    const company = await CompanySettings.findOne().select('companyName logo website email phone address authorizedSignatory')
    const firstView = !proposal.sharing.lastViewedAt
    if (firstView) {
      addStatusHistory(proposal, 'viewed', undefined, 'Client opened secure proposal link')
    }
    proposal.sharing.lastViewedAt = new Date()
    await proposal.save()
    successResponse(res, { proposal: preparePublicProposal(proposal.toObject()), company, viewedAt: proposal.sharing.lastViewedAt })
  } catch (error) { next(error) }
}

export const getPublicProposalPDF = async (req, res, next) => {
  try {
    const proposal = await findPublicProposal(req.params.token)
    if (!proposal) return errorResponse(res, 'This proposal link is invalid or has expired', [], 404)
    const [company, theme] = await Promise.all([CompanySettings.findOne(), ProposalTheme.findOne({ isDefault: true })])
    const pdfBuffer = await PDFService.generateProposal(preparePublicProposal(proposal.toObject()), company, normalizeProposalTheme(theme?.config))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${proposalFilename(proposal)}"`)
    res.send(pdfBuffer)
  } catch (error) { next(error) }
}

export const respondToPublicProposal = async (req, res, next) => {
  try {
    const proposal = await findPublicProposal(req.params.token)
    if (!proposal) return errorResponse(res, 'This proposal link is invalid or has expired', [], 404)
    const action = req.params.action
    const allowed = ['accept', 'reject', 'request-changes']
    if (!allowed.includes(action)) return errorResponse(res, 'Unsupported proposal action')
    if (['accepted', 'rejected'].includes(proposal.status)) return errorResponse(res, 'This proposal has already been finalized', [], 409)
    const statusMap = { accept: 'accepted', reject: 'rejected', 'request-changes': 'changes_requested' }
    const status = statusMap[action]
    proposal.statusHistory.push({ status, changedAt: new Date(), notes: req.body.message || req.body.changeRequest || '' })
    proposal.status = status
    proposal.clientDecision = {
      ...(proposal.clientDecision || {}),
      acceptedAt: action === 'accept' ? new Date() : undefined,
      rejectedAt: action === 'reject' ? new Date() : undefined,
      changesRequestedAt: action === 'request-changes' ? new Date() : undefined,
      changesRequestedBy: req.body.name || proposal.customerSnapshot?.contactPerson,
      changeRequest: req.body.message || req.body.changeRequest,
      acceptedBy: action === 'accept' ? (req.body.name || proposal.customerSnapshot?.contactPerson) : undefined,
      acceptedVersion: action === 'accept' ? (proposal.versionHistory?.length || 1) : proposal.clientDecision?.acceptedVersion
    }
    await proposal.save()
    successResponse(res, { status }, 'Proposal response recorded')
  } catch (error) { next(error) }
}
