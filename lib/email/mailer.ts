import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

type PaymentReminderEmail = {
  parentEmail: string;
  parentName: string;
  studentName: string;
  outstandingBalance: string;
  schoolName: string;
  schoolYearName: string;
  reminderType: string;
  messageBody: string;
};

type EmailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  parentPortalUrl: string;
};

let transporter: Transporter | null = null;
let configuration: EmailConfiguration | null = null;
let verification: Promise<void> | null = null;

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

export async function verifyEmailTransport() {
  const emailTransport = getTransporter();

  if (!verification) {
    verification = emailTransport.verify().then(() => undefined).catch((error: unknown) => {
      verification = null;
      throw new EmailConfigurationError(safeSmtpError(error));
    });
  }

  await verification;
}

export async function sendPaymentReminderEmail(reminder: PaymentReminderEmail) {
  const emailTransport = getTransporter();
  const config = getEmailConfiguration();
  const subject = `${reminder.reminderType}: ${reminder.studentName}`;

  await emailTransport.sendMail({
    from: {
      name: config.fromName,
      address: config.fromEmail,
    },
    to: {
      name: reminder.parentName,
      address: reminder.parentEmail,
    },
    subject,
    text: paymentReminderText(reminder, config.parentPortalUrl),
    html: paymentReminderHtml(reminder, config.parentPortalUrl),
  });
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const config = getEmailConfiguration();
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    rateDelta: 1_000,
    rateLimit: 5,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  return transporter;
}

function getEmailConfiguration() {
  if (configuration) {
    return configuration;
  }

  const host = requiredEnvironmentValue("SMTP_HOST");
  const portText = requiredEnvironmentValue("SMTP_PORT");
  const port = Number(portText);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new EmailConfigurationError("SMTP_PORT must be a valid port number.");
  }

  const secureText = (process.env.SMTP_SECURE ?? "true").trim().toLowerCase();

  if (secureText !== "true" && secureText !== "false") {
    throw new EmailConfigurationError("SMTP_SECURE must be true or false.");
  }

  const user = requiredEnvironmentValue("SMTP_USER");
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim() || user;
  const appBaseUrl = requiredEnvironmentValue("APP_BASE_URL");
  let parentPortalUrl: string;

  try {
    parentPortalUrl = new URL("/parent/login", appBaseUrl).toString();
  } catch {
    throw new EmailConfigurationError("APP_BASE_URL must be a valid absolute URL.");
  }

  configuration = {
    host,
    port,
    secure: secureText === "true",
    user,
    password: requiredEnvironmentValue("SMTP_PASSWORD"),
    fromEmail,
    fromName: (process.env.SMTP_FROM_NAME ?? "XMETA Pay").trim() || "XMETA Pay",
    parentPortalUrl,
  };

  return configuration;
}

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new EmailConfigurationError(`${name} is not configured.`);
  }

  return value;
}

function paymentReminderText(reminder: PaymentReminderEmail, parentPortalUrl: string) {
  return [
    `Hello ${reminder.parentName},`,
    "",
    reminder.messageBody,
    "",
    `Student: ${reminder.studentName}`,
    `Outstanding balance: ${reminder.outstandingBalance}`,
    `School: ${reminder.schoolName}`,
    `School year: ${reminder.schoolYearName}`,
    "",
    `Review the account: ${parentPortalUrl}`,
    "",
    "This is an automated payment reminder from XMETA Pay.",
  ].join("\n");
}

function paymentReminderHtml(reminder: PaymentReminderEmail, parentPortalUrl: string) {
  const parentName = escapeHtml(reminder.parentName);
  const studentName = escapeHtml(reminder.studentName);
  const balance = escapeHtml(reminder.outstandingBalance);
  const schoolName = escapeHtml(reminder.schoolName);
  const schoolYearName = escapeHtml(reminder.schoolYearName);
  const message = escapeHtml(reminder.messageBody).replace(/\r?\n/g, "<br />");
  const portalUrl = escapeHtml(parentPortalUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#0f1117;">
    <div style="padding:24px 12px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#0f1117;padding:18px 24px;color:#ffffff;">
          <strong style="font-size:18px;">XMETA Pay</strong>
          <div style="margin-top:4px;color:#c7cad1;font-size:13px;">School payment reminder</div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;line-height:1.6;">Hello ${parentName},</p>
          <p style="margin:0 0 20px;line-height:1.6;">${message}</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
            <tr><td style="padding:9px 0;color:#5a6070;">Student</td><td style="padding:9px 0;text-align:right;font-weight:700;">${studentName}</td></tr>
            <tr><td style="padding:9px 0;border-top:1px solid #eceef1;color:#5a6070;">Outstanding balance</td><td style="padding:9px 0;border-top:1px solid #eceef1;text-align:right;font-weight:700;color:#d32f2f;">${balance}</td></tr>
            <tr><td style="padding:9px 0;border-top:1px solid #eceef1;color:#5a6070;">School</td><td style="padding:9px 0;border-top:1px solid #eceef1;text-align:right;">${schoolName}</td></tr>
            <tr><td style="padding:9px 0;border-top:1px solid #eceef1;color:#5a6070;">School year</td><td style="padding:9px 0;border-top:1px solid #eceef1;text-align:right;">${schoolYearName}</td></tr>
          </table>
          <a href="${portalUrl}" style="display:inline-block;background:#ef4b1a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px;">Open parent portal</a>
          <p style="margin:22px 0 0;color:#747b89;font-size:12px;line-height:1.5;">This is an automated payment reminder from XMETA Pay.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return entities[character] ?? character;
  });
}

function safeSmtpError(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    if (error.code === "EAUTH") {
      return "SMTP authentication failed. Check the sender email and Google App Password.";
    }

    if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT" || error.code === "ESOCKET") {
      return "The SMTP service could not be reached. Check the host, port, and network access.";
    }
  }

  return "The SMTP configuration could not be verified.";
}
