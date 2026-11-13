import express from 'express'
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerInvoices,
  importCustomers
} from '../controllers/customerController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/permissionMiddleware.js'
import upload from '../config/multer.js'

const router = express.Router()

router.use(authMiddleware)

router.route('/')
  .get(requirePermission('customers.view'), getCustomers)
  .post(requirePermission('customers.create'), createCustomer)

router.route('/import')
  .post(requirePermission('customers.create'), upload.single('file'), importCustomers)

router.route('/:id')
  .get(requirePermission('customers.view'), getCustomer)
  .put(requirePermission('customers.edit'), updateCustomer)
  .delete(requirePermission('customers.delete'), deleteCustomer)

router.get('/:id/invoices', requirePermission('customers.view'), getCustomerInvoices)

export default router
