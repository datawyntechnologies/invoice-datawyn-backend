import User from '../models/User.js'

// Single query that loads the user with role + all permissions populated
const getUserWithPermissions = (userId) =>
  User.findById(userId)
    .populate({ path: 'role', populate: { path: 'permissions' } })
    .populate('permissions')

const getEffectivePermissionNames = (user) => {
  const names = new Set()
  user.permissions?.forEach((p) => p.name && names.add(p.name))
  user.role?.permissions?.forEach((p) => p.name && names.add(p.name))
  return names
}

// authMiddleware already loads user + role + permissions populated;
// only hit the DB again if the request user isn't fully populated
const resolveUser = async (req) => {
  const user = req.user
  if (!user) return null

  const rolePopulated = user.role && typeof user.role === 'object' && Array.isArray(user.role.permissions)
  const directPopulated = Array.isArray(user.permissions) &&
    (user.permissions.length === 0 || typeof user.permissions[0] === 'object')

  if (rolePopulated && directPopulated) return user
  return getUserWithPermissions(user._id || user.id)
}

/**
 * Check if user has a specific permission
 * @param {string} permissionName - The permission name to check (e.g., 'users.create')
 */
export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        })
      }

      const user = await resolveUser(req)

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        })
      }

      if (!getEffectivePermissionNames(user).has(permissionName)) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: ${permissionName} required`
        })
      }

      next()
    } catch (error) {
      console.error('Permission check error:', error)
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      })
    }
  }
}

/**
 * Check if user has any of the specified permissions
 * @param {string[]} permissionNames - Array of permission names (user needs at least one)
 */
export const requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        })
      }

      const user = await resolveUser(req)

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        })
      }

      const effectivePermissions = getEffectivePermissionNames(user)
      const hasPermission = permissionNames.some((name) => effectivePermissions.has(name))

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: One of ${permissionNames.join(', ')} required`
        })
      }

      next()
    } catch (error) {
      console.error('Permission check error:', error)
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      })
    }
  }
}

/**
 * Check if user has all specified permissions
 * @param {string[]} permissionNames - Array of permission names (user needs all of them)
 */
export const requireAllPermissions = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        })
      }

      const user = await resolveUser(req)

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        })
      }

      const effectivePermissions = getEffectivePermissionNames(user)
      const hasAllPermissions = permissionNames.every((name) => effectivePermissions.has(name))

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: All of ${permissionNames.join(', ')} required`
        })
      }

      next()
    } catch (error) {
      console.error('Permission check error:', error)
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      })
    }
  }
}

/**
 * Check if user is an admin (has Admin role)
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    const user = await User.findById(req.user._id).populate('role')

    if (!user || !user.role) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
    }

    // Check if role name contains 'admin' (case-insensitive)
    const isAdmin = user.role.name.toLowerCase().includes('admin')
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
    }

    next()
  } catch (error) {
    console.error('Admin check error:', error)
    return res.status(500).json({
      success: false,
      message: 'Error checking admin status'
    })
  }
}
