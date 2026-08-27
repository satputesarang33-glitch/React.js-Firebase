import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import { User } from "../Models/UserModels.js";

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized, token missing");
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401);
      throw new Error("Not authorized");
    }
    req.user = user;
    next();
  } catch {
    res.status(401);
    throw new Error("Not authorized, token invalid");
  }
});
