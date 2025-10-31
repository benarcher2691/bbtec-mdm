const { verifyToken } = require('@clerk/backend');

/**
 * Authentication middleware using Clerk
 * Verifies that the user is authenticated before allowing access to protected routes
 */
const requireAuth = async (req, res, next) => {
  try {
    // Get the session token from the Authorization header
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    // Verify the session token with Clerk
    try {
      const payload = await verifyToken(sessionToken, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      if (!payload) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or expired session',
        });
      }

      // Attach user info to request object
      req.auth = {
        userId: payload.sub,
        sessionId: payload.sid,
        claims: payload,
      };

      next();
    } catch (error) {
      console.error('Clerk verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid authentication token',
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
};

/**
 * Optional authentication middleware
 * Checks for authentication but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (sessionToken) {
      try {
        const payload = await verifyToken(sessionToken, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });

        if (payload) {
          req.auth = {
            userId: payload.sub,
            sessionId: payload.sid,
            claims: payload,
          };
        }
      } catch (error) {
        // Ignore errors for optional auth
        console.log('Optional auth failed:', error.message);
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
};
