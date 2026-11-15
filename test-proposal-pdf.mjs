import fs from 'fs'
import path from 'path'
import { PDFService } from './src/services/pdfService.js'
import { normalizeProposalTheme, PROPOSAL_THEME_PRESETS } from './src/utils/proposalThemes.js'

const company = {
  companyName: 'Datawyn Technologies',
  logo: 'logo.png',
  email: 'hello@datawyn.com',
  phone: '+91 98765 43210',
  website: 'www.datawyn.com',
  address: { street: '42 Tech Park, MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
  authorizedSignatory: { name: 'Innamul Hasan', designation: 'Founder & CEO' }
}

const baseProposal = {
  proposalNumber: 'PROP-2026-0042',
  proposalDate: new Date('2026-11-01'),
  validUntil: new Date('2026-12-15'),
  projectTitle: 'Enterprise CRM & Client Portal',
  projectSubtitle: 'End-to-end digital transformation for sales and support operations',
  projectDescription: 'Datawyn Technologies proposes to design, build and deploy a modern CRM platform integrated with a client-facing portal. The solution will centralize customer data, automate proposal and invoice workflows, and provide real-time analytics for the leadership team.',
  objectives: 'Improve sales conversion through faster proposal turnaround\nReduce manual data entry across departments\nProvide clients with a self-service portal for proposals and invoices\nEstablish a single source of truth for customer information',
  proposedSolution: 'A cloud-native web application built on a modern JavaScript stack with a responsive UI, role-based access control, automated PDF generation, and secure REST APIs. The platform will be delivered in phased sprints with weekly demos.',
  customerSnapshot: {
    companyName: 'Apex Retail Group',
    contactPerson: 'Priya Sharma',
    email: 'priya@apexretail.in',
    phone: '+91 90000 11111',
    gstin: '29ABCDE1234F1Z5',
    billingAddress: { street: '12 MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
  },
  scopeOfWork: [
    { title: 'Discovery & Requirements', description: 'Stakeholder interviews, process mapping and finalization of functional and non-functional requirements.', bulletPoints: ['Workshop sessions with key users', 'Current-state process documentation', 'Signed-off requirements traceability matrix'] },
    { title: 'UI/UX Design', description: 'Wireframes, visual design system and interactive prototypes for all modules.', bulletPoints: ['Design system with Datawyn brand guidelines', 'Responsive desktop and mobile layouts', 'Usability review sessions'] },
    { title: 'Frontend Development', description: 'React based single page application with reusable component library.', bulletPoints: ['Redux state management', 'Form validation and error handling', 'Accessibility compliance (WCAG 2.1)'] },
    { title: 'Backend Development', description: 'Node.js REST APIs with authentication, authorization and audit logging.', bulletPoints: ['JWT based authentication', 'Role based access control', 'Rate limiting and security headers'] },
    { title: 'Database & Migration', description: 'MongoDB schema design, indexing strategy and data migration tooling.', bulletPoints: ['Schema design and validation', 'Migration scripts with rollback', 'Backup and restore procedures'] },
    { title: 'QA & Testing', description: 'Comprehensive test plan covering unit, integration and UAT.', bulletPoints: ['Automated test suite', 'Performance and load testing', 'UAT support and defect triage'] },
    { title: 'Deployment & Training', description: 'Production deployment on cloud infrastructure with handover documentation.', bulletPoints: ['CI/CD pipeline setup', 'Admin and user training sessions', '30 days post-launch hypercare support'] }
  ],
  deliverables: [
    { name: 'CRM Web Application', description: 'Fully functional CRM with dashboard, customers, proposals, invoices and reports.', quantity: 1 },
    { name: 'Client Portal', description: 'Secure portal for clients to view proposals, accept/reject and download documents.', quantity: 1 },
    { name: 'User Manual & Admin Guide', description: 'Comprehensive documentation for end users and administrators.', quantity: 1 },
    { name: 'Source Code Repository', description: 'Complete handover of source code with setup documentation.', quantity: 1 },
    { name: 'Post-Launch Support', description: '30 days of bug-fix support after go-live.', quantity: 1 }
  ],
  technologyStack: ['React', 'Node.js', 'Express', 'MongoDB', 'JWT', 'Redux', 'Tailwind CSS', 'PDFKit', 'Docker', 'AWS'],
  timeline: {
    startDate: new Date('2026-12-01'),
    estimatedCompletionDate: new Date('2027-03-31'),
    duration: '16 weeks',
    milestones: [
      { title: 'Project Kickoff', description: 'Kickoff meeting, environment setup and access provisioning.', expectedDate: new Date('2026-12-01'), duration: '1 week' },
      { title: 'Design Sign-off', description: 'UI/UX designs approved by stakeholders.', expectedDate: new Date('2026-12-19'), duration: '3 weeks' },
      { title: 'MVP Release', description: 'Core CRM modules functional in staging.', expectedDate: new Date('2027-01-30'), duration: '6 weeks' },
      { title: 'Client Portal Beta', description: 'Portal available for internal beta testing.', expectedDate: new Date('2027-02-27'), duration: '4 weeks' },
      { title: 'UAT & Bug Fixes', description: 'User acceptance testing and remediation.', expectedDate: new Date('2027-03-20'), duration: '3 weeks' },
      { title: 'Go-Live & Handover', description: 'Production deployment, training and documentation handover.', expectedDate: new Date('2027-03-31'), duration: '2 weeks' }
    ]
  },
  items: [
    { isCustom: true, customName: 'CRM Platform Development', customDescription: 'End-to-end design, development and deployment of the CRM platform including all modules.', quantity: 1, rate: 450000, gstRate: 18, total: 531000 },
    { isCustom: true, customName: 'Client Portal Module', customDescription: 'Secure client-facing portal with document access and e-acceptance workflow.', quantity: 1, rate: 150000, gstRate: 18, total: 177000 },
    { isCustom: true, customName: 'Data Migration Services', customDescription: 'Migration of existing customer and invoice data with validation reports.', quantity: 1, rate: 50000, gstRate: 18, total: 59000 },
    { isCustom: true, customName: 'Training & Documentation', customDescription: 'On-site training for admin and end users plus documentation pack.', quantity: 2, rate: 15000, gstRate: 18, total: 35400 },
    { isCustom: true, customName: 'AMC - Year 1', customDescription: '12 months of maintenance, updates and priority support.', quantity: 1, rate: 120000, gstRate: 18, total: 141600 }
  ],
  subtotal: 815000,
  itemDiscount: 0,
  invoiceDiscount: 25000,
  taxableAmount: 790000,
  cgst: 0,
  sgst: 0,
  igst: 142200,
  totalTax: 142200,
  roundOff: 0,
  grandTotal: 932200,
  amountInWords: 'Rupees Nine Lakh Thirty Two Thousand Two Hundred Only',
  paymentTerms: '50% advance before project kickoff, 30% on MVP delivery and 20% on final go-live. All payments are non-refundable once the corresponding phase has commenced.',
  paymentSchedule: [
    { stage: 'Advance', dueDate: new Date('2026-11-20'), percentage: 50, amount: 466100, description: 'Payable before project kickoff' },
    { stage: 'MVP Delivery', dueDate: new Date('2027-01-30'), percentage: 30, amount: 279660, description: 'Payable on MVP sign-off' },
    { stage: 'Go-Live', dueDate: new Date('2027-03-31'), percentage: 20, amount: 186440, description: 'Final payment on handover' }
  ],
  advanceAmount: 466100,
  balanceAmount: 466100,
  termsAndConditions: '1. This proposal is valid until the date mentioned above.\n2. Scope changes will be handled through a formal change request process.\n3. Timeline estimates are indicative and may vary based on feedback turnaround from the client.\n4. Source code ownership transfers to the client upon full payment.\n5. Third-party licensing costs, if any, are excluded from this proposal.\n6. Either party may terminate with 30 days written notice; work completed till date becomes payable.',
  notes: 'We are excited about the opportunity to partner with Apex Retail Group. Our team has delivered 40+ enterprise projects and would love to bring that experience to your organization.',
  preparedBy: 'Innamul Hasan',
  internalNotes: 'INTERNAL: discount approved by director on 30 Oct'
}

const longProposal = JSON.parse(JSON.stringify(baseProposal))
longProposal.proposalNumber = 'PROP-2026-0099'
longProposal.projectTitle = 'National E-Governance Platform with AI Analytics, Multi-Tenant Architecture and 99.99% Uptime SLA Across Twelve Regional Territories'
longProposal.scopeOfWork = Array.from({ length: 14 }, (_, i) => ({
  title: `Workstream ${i + 1}: Enterprise Module ${i + 1} Implementation and Integration`,
  description: `This workstream covers the detailed implementation, configuration, testing and integration of module ${i + 1} including all dependent services, APIs and data pipelines required for production rollout.`,
  bulletPoints: [`Requirement gathering and solution design for module ${i + 1}`, `Development and code review cycles`, `Integration testing with upstream and downstream systems`, `Documentation and handover artifacts`]
}))
longProposal.timeline.milestones = Array.from({ length: 12 }, (_, i) => ({
  title: `Phase ${i + 1} Milestone`,
  description: `Completion of phase ${i + 1} deliverables including development, testing and stakeholder review before proceeding to the next phase.`,
  expectedDate: new Date(2026, 11 + i, 15),
  duration: `${(i + 1) * 2} weeks`
}))
longProposal.deliverables = Array.from({ length: 10 }, (_, i) => ({
  name: `Deliverable Package ${i + 1}`,
  description: `Complete delivery package including source code, deployment scripts, test evidence and operational runbooks for component ${i + 1}.`,
  quantity: i + 1
}))
longProposal.technologyStack = ['React', 'Next.js', 'Node.js', 'Express', 'NestJS', 'MongoDB', 'PostgreSQL', 'Redis', 'RabbitMQ', 'Docker', 'Kubernetes', 'Terraform', 'AWS', 'Azure', 'GraphQL', 'TypeScript', 'Tailwind CSS', 'Jest', 'Cypress', 'Datadog', 'Elastic Stack', 'Kubernetes']
longProposal.items = Array.from({ length: 15 }, (_, i) => ({
  isCustom: true,
  customName: `Service Line Item ${i + 1}: ${'Very Long Service Name That May Wrap '.repeat(2)}`,
  customDescription: `Detailed scope description for service line ${i + 1} covering requirements, implementation, testing and deployment activities across the project lifecycle.`,
  quantity: (i % 3) + 1,
  rate: 25000 + i * 5000,
  gstRate: 18,
  total: ((i % 3) + 1) * (25000 + i * 5000) * 1.18
}))
longProposal.subtotal = 1000000
longProposal.invoiceDiscount = 50000
longProposal.totalTax = 171000
longProposal.grandTotal = 1121000
longProposal.amountInWords = 'Rupees Eleven Lakh Twenty One Thousand Only'

const minimalProposal = {
  proposalNumber: 'PROP-2026-0007',
  proposalDate: new Date('2026-11-10'),
  projectTitle: 'Landing Page Redesign',
  customerSnapshot: { companyName: 'Sunrise Bakery' },
  scopeOfWork: [{ title: 'Design & Build', description: 'Single page marketing site.' }],
  items: [{ isCustom: true, customName: 'Website Design', quantity: 1, rate: 25000, total: 29500 }],
  subtotal: 25000,
  totalTax: 4500,
  igst: 4500,
  grandTotal: 29500,
  amountInWords: 'Rupees Twenty Nine Thousand Five Hundred Only'
}

const outDir = path.join(process.cwd(), 'test-output')
fs.mkdirSync(outDir, { recursive: true })

const theme = normalizeProposalTheme(PROPOSAL_THEME_PRESETS[0].config)
const grayTheme = normalizeProposalTheme(PROPOSAL_THEME_PRESETS[1].config)
const darkTheme = normalizeProposalTheme(PROPOSAL_THEME_PRESETS[2].config)
const lightTheme = normalizeProposalTheme(PROPOSAL_THEME_PRESETS[3].config)

const jobs = [
  ['proposal-standard.pdf', baseProposal, theme],
  ['proposal-long.pdf', longProposal, theme],
  ['proposal-minimal.pdf', minimalProposal, theme],
  ['proposal-gray.pdf', baseProposal, grayTheme],
  ['proposal-dark.pdf', baseProposal, darkTheme],
  ['proposal-light.pdf', baseProposal, lightTheme]
]

for (const [filename, proposal, t] of jobs) {
  const buffer = await PDFService.generateProposal(proposal, company, t)
  fs.writeFileSync(path.join(outDir, filename), buffer)
  console.log(`${filename}: ${buffer.length} bytes`)
}
console.log('done')
