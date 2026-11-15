import express from 'express'
import {
  getPublicProposal,
  getPublicProposalPDF,
  respondToPublicProposal
} from '../controllers/proposalController.js'

const router = express.Router()
router.get('/:token', getPublicProposal)
router.get('/:token/pdf', getPublicProposalPDF)
router.post('/:token/:action', respondToPublicProposal)
export default router
