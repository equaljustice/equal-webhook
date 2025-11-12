import jwt from "jsonwebtoken";

export const jwtAuth = async (req, res, next) => {
  const token = req.header("jwt-token");
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) {
    return res
      .status(401)
      .json({ message: "Unauthorized Access: No jwt-token or secret" });
  }
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized Access: Invalid jwt-token" });
  }
};
