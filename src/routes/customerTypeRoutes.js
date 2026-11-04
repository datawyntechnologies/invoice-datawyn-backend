import express from 'express'
import {
  getAllCustomerTypes,
  getCustomerType,
  createCustomerType,
  updateCustomerType,
  deleteCustomerType
} from '../controllers/customerTypeController'
import { protect } from '../middleware/authMiddleware'

const router = express.Router()

router.use(protect)

router.route('/')
  .get(getAllCustomerTypes)
  .post(createCustomerType)

router.route('/:id')
  .get(getCustomerType)
  .put(updateCustomerType)
  .delete(deleteCustomerType)

export default router
