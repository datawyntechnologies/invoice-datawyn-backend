import ProposalTheme from '../models/ProposalTheme.js'
import Proposal from '../models/Proposal.js'
import { errorResponse, successResponse } from '../utils/response.js'
import { normalizeProposalTheme, PROPOSAL_THEME_PRESETS } from '../utils/proposalThemes.js'

const ensurePresets = async () => {
  await Promise.all(PROPOSAL_THEME_PRESETS.map(async (preset) => {
    await ProposalTheme.updateOne(
      { slug: preset.slug },
      { $setOnInsert: { ...preset, isPreset: true } },
      { upsert: true }
    )
  }))
}

export const getThemes = async (req, res, next) => {
  try {
    await ensurePresets()
    const themes = await ProposalTheme.find().sort({ isDefault: -1, name: 1 })
    successResponse(res, themes)
  } catch (error) { next(error) }
}

export const getTheme = async (req, res, next) => {
  try {
    const theme = await ProposalTheme.findOne({ $or: [{ _id: req.params.id }, { slug: req.params.id }] })
    if (!theme) return errorResponse(res, 'Theme not found', [], 404)
    successResponse(res, theme)
  } catch (error) { next(error) }
}

export const createTheme = async (req, res, next) => {
  try {
    const { name, config } = req.body
    if (!name?.trim()) return errorResponse(res, 'Theme name is required')
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const theme = await ProposalTheme.create({
      name: name.trim(), slug, config: normalizeProposalTheme(config), updatedBy: req.user._id
    })
    successResponse(res, theme, 'Theme created successfully', 201)
  } catch (error) {
    if (error.code === 11000) return errorResponse(res, 'A theme with this name already exists')
    next(error)
  }
}

export const updateTheme = async (req, res, next) => {
  try {
    const theme = await ProposalTheme.findById(req.params.id)
    if (!theme) return errorResponse(res, 'Theme not found', [], 404)
    const { name, config, isDefault } = req.body
    if (name) theme.name = name.trim()
    if (config) theme.config = normalizeProposalTheme(config)
    if (typeof isDefault === 'boolean') theme.isDefault = isDefault
    theme.updatedBy = req.user._id
    await theme.save()
    if (theme.isDefault) {
      await ProposalTheme.updateMany({ _id: { $ne: theme._id } }, { $set: { isDefault: false } })
    }
    successResponse(res, theme, 'Theme updated successfully')
  } catch (error) {
    next(error)
  }
}

export const deleteTheme = async (req, res, next) => {
  try {
    const theme = await ProposalTheme.findById(req.params.id)
    if (!theme) return errorResponse(res, 'Theme not found', [], 404)
    if (theme.isDefault || theme.isPreset) return errorResponse(res, 'Preset and default themes cannot be deleted')
    await Proposal.updateMany({ 'sharing.pdfTheme.slug': theme.slug }, { $unset: { 'sharing.pdfTheme': '' } })
    await theme.deleteOne()
    successResponse(res, null, 'Theme deleted successfully')
  } catch (error) { next(error) }
}
