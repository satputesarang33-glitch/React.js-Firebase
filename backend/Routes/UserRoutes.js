import express from "express";
import {
  forgotPassword,
  getMe,
  login,
  register,
  resendOTP,
  resendResetOTP,
  resetPassword,
  testSmtp,
  verifyOTP,
  verifyResetOTP,
} from "../ControllerMethod/UserController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOTP);
router.post("/resend-reset-otp", resendResetOTP);
router.post("/reset-password", resetPassword);
router.get("/test-smtp", testSmtp);
router.get("/me", protect, getMe);

export default router;
