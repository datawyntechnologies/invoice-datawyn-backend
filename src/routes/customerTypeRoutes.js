import express from 'express'
import {
  getCustomerTypes,
  createCustomerType,
  updateCustomerType,
  deleteCustomerType
} from '../controllers/customerTypeController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/permissionMiddleware.js'

const router = express.Router()

router.use(authMiddleware)

router.route('/')
  .get(requirePermission('customers.view'), getCustomerTypes)
  .post(requirePermission('customers.edit'), createCustomerType)

router.route('/:id')
  .put(requirePermission('customers.edit'), updateCustomerType)
  .delete(requirePermission('customers.delete'), deleteCustomerType)

export default router
