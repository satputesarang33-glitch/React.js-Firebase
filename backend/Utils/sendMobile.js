import twilio from "twilio";

function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } =
    process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    return null;
  }

  return {
    client: twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
    serviceSid: TWILIO_VERIFY_SERVICE_SID,
  };
}

/** Normalize to E.164-ish; prepend +91 if 10-digit Indian number. */
export function normalizeMobile(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!digits) return null;
  if (String(mobile).trim().startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}
// Send OTP to mobile number using Twilio Verify
export async function sendMobileOTP(mobile, otp, purpose = "verify") {
  const twilioCfg = getTwilioClient();
  const action = purpose === "reset" ? "password reset" : "verification";

  if (!twilioCfg) {
    console.log(`[DEV] Mobile OTP (${purpose}) for ${mobile}: ${otp}`);
    return { queued: false, devMode: true, channel: "sms" };
  }

  // Prefer Twilio Verify when configured (Twilio generates its own code).
  // Callers still store a local OTP for a consistent verify API in this app.
  // If Verify is used, we also send our OTP via SMS using Messages API fallback pattern:
  // For simplicity with a single verifyOTP endpoint, send the app OTP via SMS.
  const { client } = twilioCfg;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!from) {
    // Fallback: start Verify challenge (Twilio owns the code).
    await client.verify.v2
      .services(twilioCfg.serviceSid)
      .verifications.create({ to: mobile, channel: "sms" });
    return { queued: true, devMode: false, channel: "twilio_verify" };
  }

  await client.messages.create({
    from,
    to: mobile,
    body: `Your ${action} code is ${otp}. It expires in 10 minutes.`,
  });

  return { queued: true, devMode: false, channel: "sms" };
}

export async function checkTwilioVerifyOTP(mobile, code) {
  const twilioCfg = getTwilioClient();
  if (!twilioCfg) return null;

  const result = await twilioCfg.client.verify.v2
    .services(twilioCfg.serviceSid)
    .verificationChecks.create({ to: mobile, code });

  return result.status === "approved";
}
