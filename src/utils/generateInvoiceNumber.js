import ProformaInvoice from '../models/ProformaInvoice.js'
import Invoice from '../models/Invoice.js'
import Proposal from '../models/Proposal.js'

// Finds the highest sequence number used this year so deleted documents
// don't cause duplicate invoice numbers (count + 1 breaks when gaps exist)
const getNextSequence = async (Model, field, prefix, year) => {
  const pattern = new RegExp(`^${prefix}-${year}-`)
  const docs = await Model.find({ [field]: pattern }).select(field).lean()

  const max = docs.reduce((highest, doc) => {
    const seq = parseInt(String(doc[field]).split('-').pop(), 10)
    return Number.isNaN(seq) ? highest : Math.max(highest, seq)
  }, 0)

  return max + 1
}

export const generateProformaInvoiceNumber = async (prefix = 'PI') => {
  const year = new Date().getFullYear()
  const nextNumber = await getNextSequence(ProformaInvoice, 'invoiceNumber', prefix, year)
  return `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`
}

export const generateInvoiceNumber = async (prefix = 'INV') => {
  const year = new Date().getFullYear()
  const nextNumber = await getNextSequence(Invoice, 'invoiceNumber', prefix, year)
  return `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`
}

export const generateProposalNumber = async (prefix = 'PROP') => {
  const year = new Date().getFullYear()
  const nextNumber = await getNextSequence(Proposal, 'proposalNumber', prefix, year)
  return `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`
}
