import jwt from "jsonwebtoken";

export const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "No valid authorization header provided",
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const jwtSecret = process.env.JWT_SECRET;

    if (!token || !jwtSecret) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token or JWT secret not provided",
      });
    }

    const decoded = jwt.verify(token, jwtSecret);
    
    // Verify that the token has admin role
    if (decoded.role !== "admin") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Admin access required",
      });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token has expired",
      });
    } else if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token",
      });
    } else {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Authentication error",
      });
    }
  }
};
