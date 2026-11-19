import express from 'express'
import {
  getQuotations,
  getQuotationStats,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  duplicateQuotation,
  updateQuotationStatus,
  downloadQuotationPDF,
  sendQuotationEmail
} from '../controllers/quotationController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/permissionMiddleware.js'

const router = express.Router()

router.use(authMiddleware)

router.route('/')
  .get(requirePermission('quotations.view'), getQuotations)
  .post(requirePermission('quotations.create'), createQuotation)

router.get('/stats', requirePermission('quotations.view'), getQuotationStats)

router.route('/:id')
  .get(requirePermission('quotations.view'), getQuotation)
  .put(requirePermission('quotations.edit'), updateQuotation)
  .delete(requirePermission('quotations.delete'), deleteQuotation)

router.post('/:id/duplicate', requirePermission('quotations.create'), duplicateQuotation)
router.patch('/:id/status', requirePermission('quotations.edit'), updateQuotationStatus)
router.get('/:id/pdf', requirePermission('quotations.view'), downloadQuotationPDF)
router.post('/:id/send-email', requirePermission('quotations.edit'), sendQuotationEmail)

export default router
