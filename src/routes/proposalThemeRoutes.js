import express from 'express'
import { getThemes, getTheme, createTheme, updateTheme, deleteTheme } from '../controllers/proposalThemeController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requirePermission } from '../middleware/permissionMiddleware.js'

const router = express.Router()
router.use(authMiddleware)
router.get('/', requirePermission('settings.view'), getThemes)
router.get('/:id', requirePermission('settings.view'), getTheme)
router.post('/', requirePermission('settings.edit'), createTheme)
router.put('/:id', requirePermission('settings.edit'), updateTheme)
router.delete('/:id', requirePermission('settings.edit'), deleteTheme)
export default router
