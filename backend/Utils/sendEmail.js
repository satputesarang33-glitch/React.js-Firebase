import nodemailer from "nodemailer";

let etherealAccountPromise = null;

function hasRealSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  // Gmail App Passwords are often pasted with spaces — strip them
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "").trim();
  return Boolean(host && user && pass);
}

function createSmtpTransporter() {
  const port = Number(process.env.SMTP_PORT) || 587;
  const isSecure = port === 465;
  const user = process.env.SMTP_USER.trim();
  const pass = process.env.SMTP_PASS.replace(/\s+/g, "").trim();

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port,
    secure: isSecure,
    auth: { user, pass },
    requireTLS: !isSecure,
    tls: {
      minVersion: "TLSv1.2",
    },
  });
}

async function getTransporter() {
  if (hasRealSmtpConfig()) {
    return {
      transporter: createSmtpTransporter(),
      isEthereal: false,
      provider: process.env.SMTP_HOST.trim(),
    };
  }

  // Development fallback: Ethereal fake SMTP (viewable preview URL)
  if (process.env.NODE_ENV === "development") {
    if (!etherealAccountPromise) {
      etherealAccountPromise = nodemailer.createTestAccount();
    }
    const account = await etherealAccountPromise;
    return {
      transporter: nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      }),
      isEthereal: true,
      provider: "ethereal",
    };
  }

  return { transporter: null, isEthereal: false, provider: null };
}

/** Verify SMTP login works (Gmail App Password, etc.). */
export async function verifySmtpConnection() {
  if (!hasRealSmtpConfig()) {
    return {
      ok: false,
      mode: "dev-ethereal",
      message:
        "SMTP_USER / SMTP_PASS not set. Using Ethereal preview emails in development.",
    };
  }

  const transporter = createSmtpTransporter();
  await transporter.verify();
  return {
    ok: true,
    mode: "smtp",
    message: `SMTP connected: ${process.env.SMTP_HOST} as ${process.env.SMTP_USER}`,
  };
}

export async function sendEmailOTP(
  email,
  otp,
  name = "User",
  purpose = "verify",
) {
  const isReset = purpose === "reset";
  const subject = isReset ? "Reset your password" : "Verify your email";
  const action = isReset ? "password reset" : "verification";
  const text = `Hi ${name},\n\nYour ${action} code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
  const html = `
    <p>Hi ${name},</p>
    <p>Your ${action} code is <strong style="font-size:20px;letter-spacing:4px">${otp}</strong>.</p>
    <p>It expires in 10 minutes.</p>
    <p>If you did not request this, ignore this email.</p>
  `;

  const { transporter, isEthereal, provider } = await getTransporter();

  if (!transporter) {
    console.log(`[DEV] Email OTP (${purpose}) for ${email}: ${otp}`);
    return { queued: false, devMode: true };
  }

  const from =
    process.env.MAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "noreply@example.com";

  const info = await transporter.sendMail({
    from,
    to: email,
    subject,
    text,
    html,
  });

  const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) {
    console.log(`[DEV] Email OTP (${purpose}) for ${email}: ${otp}`);
    console.log(`[DEV] Email preview URL: ${previewUrl}`);
  } else {
    console.log(`[SMTP:${provider}] OTP email sent to ${email}`);
  }

  return {
    queued: true,
    devMode: isEthereal,
    previewUrl: previewUrl || undefined,
  };
}
