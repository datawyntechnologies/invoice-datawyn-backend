import CustomerType from '../models/CustomerType'

// Get all customer types
export const getAllCustomerTypes = async (req, res) => {
  try {
    const customerTypes = await CustomerType.find({ isActive: true })
      .sort({ name: 1 })

    res.json({
      success: true,
      data: customerTypes
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer types',
      error: error.message
    })
  }
}

// Get single customer type
export const getCustomerType = async (req, res) => {
  try {
    const customerType = await CustomerType.findById(req.params.id)

    if (!customerType) {
      return res.status(404).json({
        success: false,
        message: 'Customer type not found'
      })
    }

    res.json({
      success: true,
      data: customerType
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer type',
      error: error.message
    })
  }
}

// Create customer type
export const createCustomerType = async (req, res) => {
  try {
    const { name, description } = req.body

    const customerType = await CustomerType.create({
      name,
      description,
      createdBy: req.user.id
    })

    res.status(201).json({
      success: true,
      data: customerType,
      message: 'Customer type created successfully'
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Customer type with this name already exists'
      })
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create customer type',
      error: error.message
    })
  }
}

// Update customer type
export const updateCustomerType = async (req, res) => {
  try {
    const { name, description, isActive } = req.body

    const customerType = await CustomerType.findByIdAndUpdate(
      req.params.id,
      { name, description, isActive },
      { new: true, runValidators: true }
    )

    if (!customerType) {
      return res.status(404).json({
        success: false,
        message: 'Customer type not found'
      })
    }

    res.json({
      success: true,
      data: customerType,
      message: 'Customer type updated successfully'
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Customer type with this name already exists'
      })
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update customer type',
      error: error.message
    })
  }
}

// Delete customer type
export const deleteCustomerType = async (req, res) => {
  try {
    const customerType = await CustomerType.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )

    if (!customerType) {
      return res.status(404).json({
        success: false,
        message: 'Customer type not found'
      })
    }

    res.json({
      success: true,
      message: 'Customer type deleted successfully'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer type',
      error: error.message
    })
  }
}
