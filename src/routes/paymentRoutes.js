import express from 'express'
import {
  createPaymentPlan,
  getPaymentPlanByInvoice,
  recordPayment,
  addManualInstallment,
  importPaymentSchedule,
  getPaymentHistory,
  updatePaymentPlan,
  deletePaymentPlan,
  getCustomerPaymentSummary,
  getAllPaymentPlans,
} from '../controllers/paymentController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/permissionMiddleware.js'
import upload from '../config/multer.js'

const router = express.Router()

router.use(authMiddleware)

// Payment Plan CRUD
// TODO: Re-enable permission checks after running addPaymentPermissions.js on production
router.post('/', /* requirePermission('payment.create'), */ createPaymentPlan)
router.get('/', /* requirePermission('payment.view'), */ getAllPaymentPlans)
router.get('/invoice/:invoiceType/:invoiceId', /* requirePermission('payment.view'), */ getPaymentPlanByInvoice)
router.put('/:id', /* requirePermission('payment.edit'), */ updatePaymentPlan)
router.delete('/:id', /* requirePermission('payment.delete'), */ deletePaymentPlan)

// Payment Operations
router.post('/record', /* requirePermission('payment.edit'), */ recordPayment)
router.post('/installments', /* requirePermission('payment.edit'), */ addManualInstallment)
router.post('/schedule/import', /* requirePermission('payment.edit'), */ upload.single('file'), importPaymentSchedule)
router.get('/history/:customer', /* requirePermission('payment.view'), */ getPaymentHistory)
router.get('/summary/:customer', /* requirePermission('payment.view'), */ getCustomerPaymentSummary)

export default router
