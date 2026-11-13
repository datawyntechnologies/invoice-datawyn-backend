import express from 'express'
import {
  getStats,
  getCharts,
  getRevenueChart
} from '../controllers/dashboardController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/permissionMiddleware.js'

const router = express.Router()

router.use(authMiddleware)

router.get('/stats', requirePermission('dashboard.view'), getStats)
router.get('/charts', requirePermission('dashboard.view'), getCharts)
router.get('/revenue-chart', requirePermission('dashboard.view_revenue_chart'), getRevenueChart)

export default router
