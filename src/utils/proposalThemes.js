export const PROPOSAL_THEME_PRESETS = [
  {
    name: 'Minimal Black & White',
    slug: 'minimal-black-white',
    isDefault: true,
    config: {
      themeId: 'minimal-black-white', primaryColor: '#111111', secondaryColor: '#333333', accentColor: '#111111',
      backgroundColor: '#FFFFFF', textColor: '#222222', mutedTextColor: '#6B7280', dividerColor: '#D1D5DB',
      lightBackground: '#F4F4F4', fontFamily: 'Helvetica', bodyFontFamily: 'Helvetica', headingStyle: 'uppercase',
      headerStyle: 'split', footerStyle: 'minimal', showLogo: true, showPageNumbers: true, showCompanyBranding: true
    }
  },
  {
    name: 'Professional Gray',
    slug: 'professional-gray',
    isDefault: false,
    config: {
      themeId: 'professional-gray', primaryColor: '#374151', secondaryColor: '#6B7280', accentColor: '#111827',
      backgroundColor: '#FFFFFF', textColor: '#1F2937', mutedTextColor: '#6B7280', dividerColor: '#D1D5DB',
      lightBackground: '#F4F4F4', fontFamily: 'Helvetica', bodyFontFamily: 'Helvetica', headingStyle: 'uppercase',
      headerStyle: 'split', footerStyle: 'branded', showLogo: true, showPageNumbers: true, showCompanyBranding: true
    }
  },
  {
    name: 'Modern Dark',
    slug: 'modern-dark',
    isDefault: false,
    config: {
      themeId: 'modern-dark', primaryColor: '#FFFFFF', secondaryColor: '#D1D5DB', accentColor: '#A3A3A3',
      backgroundColor: '#FFFFFF', textColor: '#222222', mutedTextColor: '#6B7280', dividerColor: '#D1D5DB',
      lightBackground: '#F4F4F4', fontFamily: 'Helvetica', bodyFontFamily: 'Helvetica', headingStyle: 'uppercase',
      headerStyle: 'split', footerStyle: 'minimal', showLogo: true, showPageNumbers: true, showCompanyBranding: true,
      coverBackground: '#111111', coverTextColor: '#FFFFFF'
    }
  },
  {
    name: 'Elegant Light',
    slug: 'elegant-light',
    isDefault: false,
    config: {
      themeId: 'elegant-light', primaryColor: '#525252', secondaryColor: '#737373', accentColor: '#404040',
      backgroundColor: '#FFFFFF', textColor: '#262626', mutedTextColor: '#737373', dividerColor: '#E5E5E5',
      lightBackground: '#FAFAFA', fontFamily: 'Helvetica', bodyFontFamily: 'Helvetica', headingStyle: 'title',
      headerStyle: 'compact', footerStyle: 'minimal', showLogo: true, showPageNumbers: true, showCompanyBranding: true
    }
  }
]

export const PROPOSAL_THEME_DEFAULTS = PROPOSAL_THEME_PRESETS[0].config

export const getProposalTheme = async (ProposalTheme) => {
  let theme = await ProposalTheme.findOne({ isDefault: true }).lean()
  if (!theme) {
    theme = await ProposalTheme.create({ ...PROPOSAL_THEME_PRESETS[0], isPreset: true, isDefault: true })
    theme = theme.toObject()
  }
  return { ...PROPOSAL_THEME_PRESETS[0].config, ...(theme.config || {}) }
}

export const normalizeProposalTheme = (config = {}) => ({
  ...PROPOSAL_THEME_DEFAULTS,
  ...config,
  themeId: config.themeId || PROPOSAL_THEME_DEFAULTS.themeId
})
