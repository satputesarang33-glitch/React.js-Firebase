import asyncHandler from "express-async-handler";
import { User } from "../Models/UserModels.js";
import { generateToken } from "../Utils/generateToken.js";
import { sendEmailOTP, verifySmtpConnection } from "../Utils/sendEmail.js";
import {
  checkTwilioVerifyOTP,
  normalizeMobile,
  sendMobileOTP,
} from "../Utils/sendMobile.js";

// Public User Object for API Response without sensitive data like password, otpCode, otpExpires, etc.
function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile || null,
    role: user.role,
    storeName: user.storeName,
    sellerStatus: user.sellerStatus,
    isEmailVerified: user.isEmailVerified,
    isMobileVerified: user.isMobileVerified,
    isVerified: user.isVerified,
  };
}

// Dispatch OTP to user based on the method
async function dispatchOTP(user, method, otp, purpose = "verify") {
  if (method === "email") {
    return sendEmailOTP(user.email, otp, user.name, purpose);
  }

  const result = await sendMobileOTP(user.mobile, otp, purpose);
  // When Twilio Verify owns the code, clear local OTP so verify uses Twilio check.
  if (result.channel === "twilio_verify") {
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
  }
  return result;
}

async function findUserByEmailOrMobile({ email, mobile, verifyMethod }) {
  let user;

  if (email) {
    user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+otpCode +otpExpires +passwordResetVerifiedUntil",
    );
  } else if (mobile) {
    const phone = normalizeMobile(mobile);
    if (!phone) {
      return { user: null, method: verifyMethod || "mobile" };
    }
    user = await User.findOne({ mobile: phone }).select(
      "+otpCode +otpExpires +passwordResetVerifiedUntil",
    );
  }

  const method =
    verifyMethod || (email ? "email" : mobile ? "mobile" : undefined);

  return { user, method };
}

function clearOTP(user) {
  user.set("otpCode", undefined);
  user.set("otpExpires", undefined);
}

async function validateUserOTP(user, method, otp) {
  let valid = false;

  if (
    method === "mobile" &&
    user.mobile &&
    (!user.otpCode || !user.otpExpires)
  ) {
    const twilioOk = await checkTwilioVerifyOTP(user.mobile, String(otp));
    valid = twilioOk === true;
  } else {
    if (!user.otpCode || !user.otpExpires) {
      return {
        valid: false,
        error: "No OTP pending. Please request a new one",
      };
    }
    if (user.otpExpires.getTime() < Date.now()) {
      return {
        valid: false,
        error: "OTP has expired. Please request a new one",
      };
    }
    valid = user.otpCode === String(otp).trim();
  }

  if (!valid) {
    return { valid: false, error: "Invalid OTP" };
  }

  return { valid: true };
}

function devDeliveryPayload(delivery, otp) {
  if (!(delivery?.devMode && process.env.NODE_ENV === "development")) {
    return {};
  }
  return {
    devOTP: otp,
    ...(delivery.previewUrl ? { emailPreviewUrl: delivery.previewUrl } : {}),
  };
}

// Register a new user
export const register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    mobile,
    verifyMethod = "email",
    accountType = "buyer",
    storeName,
  } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  if (!["email", "mobile"].includes(verifyMethod)) {
    res.status(400);
    throw new Error("verifyMethod must be 'email' or 'mobile'");
  }

  if (password.length < 8) {
    res.status(400);
    throw new Error("Password must contain at least 8 characters");
  }

  if (!["buyer", "seller"].includes(accountType)) {
    res.status(400);
    throw new Error("Invalid account type");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone =
    verifyMethod === "mobile" || mobile ? normalizeMobile(mobile) : null;

  if (verifyMethod === "mobile" && !normalizedPhone) {
    res.status(400);
    throw new Error(
      "A valid mobile number is required for mobile verification",
    );
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }

  if (normalizedPhone) {
    const existingMobile = await User.findOne({ mobile: normalizedPhone });
    if (existingMobile) {
      res.status(409);
      throw new Error("An account with this mobile number already exists");
    }
  }

  if (accountType === "seller" && !storeName?.trim()) {
    res.status(400);
    throw new Error("Store name is required for sellers");
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    mobile: normalizedPhone || undefined,
    password,
    role: accountType,
    storeName: accountType === "seller" ? storeName.trim() : undefined,
    sellerStatus: accountType === "seller" ? "pending" : "not_applicable",
    verificationMethod: verifyMethod,
  });

  const otp = user.createOTP();
  await user.save({ validateBeforeSave: false });

  const delivery = await dispatchOTP(user, verifyMethod, otp);

  res.status(201).json({
    message:
      verifyMethod === "email"
        ? "Registered successfully. Please verify your email with the OTP sent."
        : "Registered successfully. Please verify your mobile with the OTP sent.",
    verifyMethod,
    user: publicUser(user),
    ...devDeliveryPayload(delivery, otp),
  });
});

// Verify OTP for email or mobile verification 
export const verifyOTP = asyncHandler(async (req, res) => {
  const { email, mobile, otp, verifyMethod } = req.body;

  if (!otp) {
    res.status(400);
    throw new Error("OTP is required");
  }

  if (!email && !mobile) {
    res.status(400);
    throw new Error("Email or mobile is required");
  }

  const { user, method: resolvedMethod } = await findUserByEmailOrMobile({
    email,
    mobile,
    verifyMethod,
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.isVerified) {
    return res.json({
      message: "Account already verified",
      token: generateToken(user._id),
      user: publicUser(user),
    });
  }

  const method = resolvedMethod || user.verificationMethod || "email";
  const check = await validateUserOTP(user, method, otp);
  if (!check.valid) {
    res.status(400);
    throw new Error(check.error);
  }

  if (method === "email") {
    user.isEmailVerified = true;
  } else {
    user.isMobileVerified = true;
  }
  user.isVerified = true;
  clearOTP(user);
  await user.save({ validateBeforeSave: false });

  res.json({
    message:
      method === "email"
        ? "Email verified successfully"
        : "Mobile number verified successfully",
    token: generateToken(user._id),
    user: publicUser(user),
  });
});

// Resend OTP for email or mobile verification 
export const resendOTP = asyncHandler(async (req, res) => {
  const { email, mobile, verifyMethod } = req.body;

  if (!email && !mobile) {
    res.status(400);
    throw new Error("Email or mobile is required");
  }

  const { user, method: resolvedMethod } = await findUserByEmailOrMobile({
    email,
    mobile,
    verifyMethod,
  });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error("Account is already verified");
  }

  const method = resolvedMethod || user.verificationMethod || "email";

  if (method === "mobile" && !user.mobile) {
    res.status(400);
    throw new Error("No mobile number on this account");
  }

  user.verificationMethod = method;
  const otp = user.createOTP();
  await user.save({ validateBeforeSave: false });

  const delivery = await dispatchOTP(user, method, otp);

  res.json({
    message:
      method === "email"
        ? "OTP resent to your email"
        : "OTP resent to your mobile",
    verifyMethod: method,
    ...devDeliveryPayload(delivery, otp),
  });
});

// Login with email or mobile + password
export const login = asyncHandler(async (req, res) => {
  const { email, mobile, password } = req.body;

  if (!password) {
    res.status(400);
    throw new Error("Password is required");
  }

  if (!email && !mobile) {
    res.status(400);
    throw new Error("Email or mobile is required");
  }

  let user;
  if (email) {
    user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+password",
    );
  } else {
    const phone = normalizeMobile(mobile);
    if (!phone) {
      res.status(400);
      throw new Error("A valid mobile number is required");
    }
    user = await User.findOne({ mobile: phone }).select("+password");
  }

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error(
      email ? "Invalid email or password" : "Invalid mobile or password",
    );
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been disabled");
  }

  if (!user.isVerified) {
    res.status(403);
    throw new Error(
      "Please verify your email or mobile number before logging in",
    );
  }

  res.json({ token: generateToken(user._id), user: publicUser(user) });
});

async function sendPasswordResetOTP(user, method) {
  if (method === "mobile" && !user.mobile) {
    const err = new Error("No mobile number on this account");
    err.statusCode = 400;
    throw err;
  }

  if (method === "email" && !user.email) {
    const err = new Error("No email on this account");
    err.statusCode = 400;
    throw err;
  }

  user.passwordResetVerifiedUntil = undefined;
  const otp = user.createOTP();
  await user.save({ validateBeforeSave: false });

  const delivery = await dispatchOTP(user, method, otp, "reset");
  return { otp, delivery };
}

// Step 1: Request forgot-password OTP via email or mobile
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, mobile, verifyMethod = "email" } = req.body;

  if (!email && !mobile) {
    res.status(400);
    throw new Error("Email or mobile is required");
  }

  if (!["email", "mobile"].includes(verifyMethod)) {
    res.status(400);
    throw new Error("verifyMethod must be 'email' or 'mobile'");
  }

  const { user } = await findUserByEmailOrMobile({ email, mobile });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been disabled");
  }

  try {
    const { otp, delivery } = await sendPasswordResetOTP(user, verifyMethod);
    res.json({
      message:
        verifyMethod === "email"
          ? "Password reset OTP sent to your email"
          : "Password reset OTP sent to your mobile",
      verifyMethod,
      ...devDeliveryPayload(delivery, otp),
    });
  } catch (err) {
    if (err.statusCode) {
      res.status(err.statusCode);
      throw new Error(err.message);
    }
    throw err;
  }
});

// Step 2: Verify forgot-password OTP (email or mobile)
export const verifyResetOTP = asyncHandler(async (req, res) => {
  const { email, mobile, otp, verifyMethod } = req.body;

  if (!otp) {
    res.status(400);
    throw new Error("OTP is required");
  }

  if (!email && !mobile) {
    res.status(400);
    throw new Error("Email or mobile is required");
  }

  const { user, method: resolvedMethod } = await findUserByEmailOrMobile({
    email,
    mobile,
    verifyMethod,
  });
  const method = resolvedMethod || "email";

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const check = await validateUserOTP(user, method, otp);
  if (!check.valid) {
    res.status(400);
    throw new Error(check.error);
  }

  clearOTP(user);
  // Allow reset password for the next 15 minutes
  user.passwordResetVerifiedUntil = new Date(Date.now() + 15 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  res.json({
    message:
      method === "email"
        ? "Email OTP verified. You can now reset your password"
        : "Mobile OTP verified. You can now reset your password",
    verifyMethod: method,
    resetAllowed: true,
    resetExpiresInMinutes: 15,
  });
});

// Resend forgot-password OTP via email or mobile
export const resendResetOTP = asyncHandler(async (req, res) => {
  const { email, mobile, verifyMethod = "email" } = req.body;

  if (!email && !mobile) {
    res.status(400);
    throw new Error("Email or mobile is required");
  }

  if (!["email", "mobile"].includes(verifyMethod)) {
    res.status(400);
    throw new Error("verifyMethod must be 'email' or 'mobile'");
  }

  const { user } = await findUserByEmailOrMobile({ email, mobile });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been disabled");
  }

  try {
    const { otp, delivery } = await sendPasswordResetOTP(user, verifyMethod);
    res.json({
      message:
        verifyMethod === "email"
          ? "Password reset OTP resent to your email"
          : "Password reset OTP resent to your mobile",
      verifyMethod,
      ...devDeliveryPayload(delivery, otp),
    });
  } catch (err) {
    if (err.statusCode) {
      res.status(err.statusCode);
      throw new Error(err.message);
    }
    throw err;
  }
});

// Step 3: Set a new password after OTP verification
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, mobile, newPassword, password } = req.body;
  const nextPassword = newPassword || password;

  if (!email && !mobile) {
    res.status(400);
    throw new Error("Email or mobile is required");
  }

  if (!nextPassword) {
    res.status(400);
    throw new Error("New password is required");
  }

  if (nextPassword.length < 8) {
    res.status(400);
    throw new Error("Password must contain at least 8 characters");
  }

  const { user } = await findUserByEmailOrMobile({ email, mobile });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (
    !user.passwordResetVerifiedUntil ||
    user.passwordResetVerifiedUntil.getTime() < Date.now()
  ) {
    res.status(400);
    throw new Error("Password reset not allowed. Please verify OTP again");
  }

  user.password = nextPassword;
  user.passwordResetVerifiedUntil = undefined;
  clearOTP(user);
  await user.save();

  res.json({
    message: "Password reset successfully. You can now log in",
    user: publicUser(user),
  });
});

// Get the current user's profile data for authenticated users
export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Check whether Gmail/SMTP is configured and reachable
export const testSmtp = asyncHandler(async (req, res) => {
  try {
    const result = await verifySmtpConnection();
    res.status(result.ok ? 200 : 200).json(result);
  } catch (err) {
    res.status(400).json({
      ok: false,
      mode: "smtp",
      message: err.message || "SMTP connection failed",
    });
  }
});
