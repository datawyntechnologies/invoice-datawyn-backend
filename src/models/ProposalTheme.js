import mongoose from 'mongoose'

const proposalThemeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  isDefault: { type: Boolean, default: false },
  isPreset: { type: Boolean, default: false },
  config: {
    themeId: String,
    primaryColor: { type: String, default: '#111111' },
    secondaryColor: { type: String, default: '#333333' },
    accentColor: { type: String, default: '#111111' },
    backgroundColor: { type: String, default: '#FFFFFF' },
    textColor: { type: String, default: '#222222' },
    mutedTextColor: { type: String, default: '#6B7280' },
    dividerColor: { type: String, default: '#D1D5DB' },
    lightBackground: { type: String, default: '#F4F4F4' },
    fontFamily: { type: String, default: 'Helvetica' },
    bodyFontFamily: { type: String, default: 'Helvetica' },
    headingStyle: { type: String, enum: ['uppercase', 'title'], default: 'uppercase' },
    headerStyle: { type: String, enum: ['compact', 'split'], default: 'split' },
    footerStyle: { type: String, enum: ['minimal', 'branded'], default: 'branded' },
    showLogo: { type: Boolean, default: true },
    showPageNumbers: { type: Boolean, default: true },
    showCompanyBranding: { type: Boolean, default: true },
    coverBackground: String,
    coverTextColor: String,
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

const ProposalTheme = mongoose.model('ProposalTheme', proposalThemeSchema)
export default ProposalTheme
