import PaymentPlan from '../models/PaymentPlan.js'
import PaymentInstallment from '../models/PaymentInstallment.js'

class PaymentPlanService {
  /**
   * Generate payment schedule based on plan type
   */
  static generatePaymentSchedule(planType, paymentMethod, totalAmount, options = {}) {
    const { invoiceDate, paymentSchedule, emiDetails, recurringDetails } = options

    switch (planType) {
      case 'full_payment':
        return this.generateFullPaymentSchedule(totalAmount, invoiceDate)

      case 'advance_50':
        return this.generateAdvance50Schedule(totalAmount, invoiceDate, options.balanceDueDate)

      case 'custom_fixed':
        return this.generateFixedAmountSchedule(paymentSchedule)

      case 'custom_percentage':
        return this.generatePercentageSchedule(totalAmount, paymentSchedule)

      case 'emi':
        return this.generateEMISchedule(totalAmount, emiDetails)

      case 'recurring':
        return this.generateRecurringSchedule(recurringDetails)

      case 'custom_payment':
        // Handle custom_payment plan type from frontend
        if (paymentMethod === 'fixed_amount') {
          return this.generateFixedAmountSchedule(paymentSchedule)
        }
        if (paymentMethod === 'percentage_based') {
          return this.generatePercentageSchedule(totalAmount, paymentSchedule)
        }
        if (paymentMethod === 'emi') {
          return this.generateEMISchedule(totalAmount, emiDetails)
        }
        throw new Error(`Invalid payment method for custom_payment: ${paymentMethod}`)

      default:
        throw new Error(`Invalid plan type: ${planType}`)
    }
  }
  
  /**
   * Full Payment - Single payment for full amount
   */
  static generateFullPaymentSchedule(totalAmount, invoiceDate) {
    return [
      {
        paymentName: 'Full Payment',
        paymentType: 'other',
        amount: totalAmount,
        percentage: 100,
        dueDate: invoiceDate || new Date(),
      }
    ]
  }
  
  /**
   * 50% Advance - Two payments: 50% advance, 50% balance
   */
  static generateAdvance50Schedule(totalAmount, invoiceDate, balanceDueDate) {
    const advanceAmount = totalAmount * 0.5
    const balanceAmount = totalAmount * 0.5
    
    return [
      {
        paymentName: 'Advance Payment',
        paymentType: 'advance',
        amount: advanceAmount,
        percentage: 50,
        dueDate: invoiceDate || new Date(),
      },
      {
        paymentName: 'Remaining Balance',
        paymentType: 'balance',
        amount: balanceAmount,
        percentage: 50,
        dueDate: balanceDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      }
    ]
  }
  
  /**
   * Fixed Amount - Custom payment stages with fixed amounts
   */
  static generateFixedAmountSchedule(paymentSchedule) {
    if (!paymentSchedule || paymentSchedule.length === 0) {
      throw new Error('Payment schedule is required for fixed amount plan')
    }
    
    return paymentSchedule.map((item, index) => ({
      paymentName: item.paymentName || `Payment ${index + 1}`,
      paymentType: item.paymentType || 'milestone',
      amount: item.amount,
      percentage: null,
      dueDate: item.dueDate,
    }))
  }
  
  /**
   * Percentage-Based - Calculate amounts from percentages
   */
  static generatePercentageSchedule(totalAmount, paymentSchedule) {
    if (!paymentSchedule || paymentSchedule.length === 0) {
      throw new Error('Payment schedule is required for percentage-based plan')
    }
    
    // Validate total percentage equals 100
    const totalPercentage = paymentSchedule.reduce((sum, item) => sum + (item.percentage || 0), 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Total percentage (${totalPercentage}%) must equal 100%`)
    }
    
    return paymentSchedule.map((item, index) => {
      const amount = (totalAmount * item.percentage) / 100
      return {
        paymentName: item.paymentName || `Payment ${index + 1}`,
        paymentType: item.paymentType || 'milestone',
        amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
        percentage: item.percentage,
        dueDate: item.dueDate,
      }
    })
  }
  
  /**
   * EMI - Generate monthly installments
   */
  static generateEMISchedule(totalAmount, emiDetails) {
    const { numberOfMonths, startDate, paymentDay } = emiDetails
    
    if (!numberOfMonths || numberOfMonths < 1) {
      throw new Error('Number of months is required for EMI plan')
    }
    
    const monthlyAmount = Math.floor(totalAmount / numberOfMonths)
    const remainder = totalAmount - (monthlyAmount * (numberOfMonths - 1))
    
    const schedule = []
    const start = new Date(startDate || new Date())
    
    for (let i = 0; i < numberOfMonths; i++) {
      const dueDate = new Date(start)
      dueDate.setMonth(dueDate.getMonth() + i)
      
      // Set payment day if specified
      if (paymentDay && paymentDay >= 1 && paymentDay <= 31) {
        dueDate.setDate(paymentDay)
      }
      
      // Last installment gets the remainder to ensure total matches
      const amount = i === numberOfMonths - 1 ? remainder : monthlyAmount
      
      schedule.push({
        paymentName: `EMI Installment ${i + 1}`,
        paymentType: 'emi',
        amount: amount,
        percentage: null,
        dueDate: dueDate,
      })
    }
    
    return schedule
  }
  
  /**
   * Recurring - Generate installments at a fixed frequency until the end date
   */
  static generateRecurringSchedule(recurringDetails = {}) {
    const { amount, frequency, startDate, endDate } = recurringDetails

    if (!amount || amount <= 0) {
      throw new Error('Recurring payment amount is required')
    }
    if (!['monthly', 'quarterly', 'yearly'].includes(frequency)) {
      throw new Error('Recurring frequency must be monthly, quarterly, or yearly')
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start) || isNaN(end)) {
      throw new Error('Valid service start date and due date are required')
    }
    if (start > end) {
      throw new Error('Service start date cannot be after the due date')
    }

    const monthsStep = { monthly: 1, quarterly: 3, yearly: 12 }[frequency]
    const frequencyLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1)

    const schedule = []
    const dueDate = new Date(start)
    let guard = 0
    while (dueDate <= end && guard < 1000) {
      schedule.push({
        paymentName: `${frequencyLabel} Payment`,
        paymentType: 'recurring',
        amount,
        percentage: null,
        dueDate: new Date(dueDate),
      })
      dueDate.setMonth(dueDate.getMonth() + monthsStep)
      guard++
    }

    if (schedule.length === 0) {
      throw new Error('No payments fall within the selected period')
    }

    return schedule
  }

  /**
   * Validate payment schedule against invoice amount
   */
  static validatePaymentSchedule(schedule, totalAmount, allowPastDates = false) {
    if (!schedule || schedule.length === 0) {
      return { valid: false, error: 'Payment schedule is empty' }
    }

    const totalScheduled = schedule.reduce((sum, item) => sum + (item.amount || 0), 0)

    // Allow small rounding differences for percentage-based plans
    if (Math.abs(totalScheduled - totalAmount) > 1) {
      return {
        valid: false,
        error: `Total scheduled amount (${totalScheduled}) must equal invoice amount (${totalAmount})`
      }
    }

    // Validate due dates - only enforce past date check for new invoices
    if (!allowPastDates) {
      const now = new Date()
      now.setHours(0, 0, 0, 0) // Set to start of day for comparison
      for (const item of schedule) {
        if (!item.dueDate) {
          return { valid: false, error: 'All payments must have a due date' }
        }
        const dueDate = new Date(item.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        if (dueDate < now) {
          return { valid: false, error: 'Due dates cannot be in the past' }
        }
      }
    } else {
      // When allowing past dates, just ensure dates exist
      for (const item of schedule) {
        if (!item.dueDate) {
          return { valid: false, error: 'All payments must have a due date' }
        }
      }
    }

    return { valid: true }
  }
  
  /**
   * Calculate payment summary
   */
  static calculatePaymentSummary(installments) {
    const totalScheduled = installments.reduce((sum, inst) => sum + inst.scheduledAmount, 0)
    const totalPaid = installments.reduce((sum, inst) => sum + inst.amountPaid, 0)
    const totalRemaining = installments.reduce((sum, inst) => sum + inst.remainingAmount, 0)
    
    const pending = installments.filter(inst => inst.status === 'pending').length
    const paid = installments.filter(inst => inst.status === 'paid').length
    const partial = installments.filter(inst => inst.status === 'partial').length
    const overdue = installments.filter(inst => inst.isOverdue).length
    
    const nextPayment = installments
      .filter(inst => inst.status === 'pending' && !inst.isOverdue)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0]
    
    return {
      totalScheduled,
      totalPaid,
      totalRemaining,
      pending,
      paid,
      partial,
      overdue,
      nextPayment,
      progressPercentage: totalScheduled > 0 ? (totalPaid / totalScheduled) * 100 : 0,
    }
  }
}

export default PaymentPlanService
