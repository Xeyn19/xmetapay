import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

export type PaymentReminderTerm = {
  name: string;
  billed: string;
  paid: string;
  balance: string;
  scheduleDate: string;
  status: string;
};

export type PaymentReminderFee = {
  name: string;
  category: "tuition" | "other" | "allowance";
  billed: string;
  paid: string;
  balance: string;
  balanceAmount: number;
  officialDueDate: string;
  officialDueDateValue: Date | null;
  status: string;
  terms: PaymentReminderTerm[];
};

type PaymentReminderEmail = {
  parentEmail: string;
  parentName: string;
  studentName: string;
  studentReference: string;
  outstandingBalance: string;
  earliestDueDate: string;
  fees: PaymentReminderFee[];
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
  const subject = `${reminder.schoolName}: ${reminder.reminderType} for ${reminder.studentName}`;

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
  const feeDetails = reminder.fees.flatMap((fee) => [
    `${fee.name} (${categoryLabel(fee.category)})`,
    `  Billed: ${fee.billed}`,
    `  Paid: ${fee.paid}`,
    `  Balance: ${fee.balance}`,
    `  Official due date: ${fee.officialDueDate}`,
    `  Status: ${fee.status}`,
    ...fee.terms.flatMap((term) => [
      `  Installment: ${term.name}`,
      `    Billed: ${term.billed}`,
      `    Paid: ${term.paid}`,
      `    Balance: ${term.balance}`,
      `    Schedule date: ${term.scheduleDate}`,
      `    Status: ${term.status}`,
    ]),
    "",
  ]);

  return [
    "XMETA Pay payment reminder",
    `${reminder.schoolName} - ${reminder.schoolYearName}`,
    "",
    `Hello ${reminder.parentName},`,
    "",
    reminder.messageBody,
    "",
    `Student: ${reminder.studentName}`,
    `Student reference: ${reminder.studentReference}`,
    `Total outstanding: ${reminder.outstandingBalance}`,
    `Earliest official due date: ${reminder.earliestDueDate}`,
    "",
    "Fee details",
    ...feeDetails,
    "Term dates are installment schedule information. The fee due date is the official parent deadline.",
    "",
    `Sign in to review and pay: ${parentPortalUrl}`,
    "For questions about this balance, contact your school finance office.",
    "",
    "This is an automated payment reminder from XMETA Pay.",
  ].join("\n");
}

function paymentReminderHtml(reminder: PaymentReminderEmail, parentPortalUrl: string) {
  const parentName = escapeHtml(reminder.parentName);
  const studentName = escapeHtml(reminder.studentName);
  const studentReference = escapeHtml(reminder.studentReference);
  const balance = escapeHtml(reminder.outstandingBalance);
  const earliestDueDate = escapeHtml(reminder.earliestDueDate);
  const schoolName = escapeHtml(reminder.schoolName);
  const schoolYearName = escapeHtml(reminder.schoolYearName);
  const message = escapeHtml(reminder.messageBody).replace(/\r?\n/g, "<br />");
  const portalUrl = escapeHtml(parentPortalUrl);
  const reminderType = escapeHtml(reminder.reminderType);
  const feeCards = reminder.fees.map((fee) => feeCardHtml(fee)).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#0f1117;">
    <div style="padding:24px 12px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#0f1117;padding:18px 24px;color:#ffffff;">
          <strong style="font-size:18px;">XMETA Pay</strong>
          <div style="margin-top:4px;color:#c7cad1;font-size:13px;">${schoolName} &middot; ${schoolYearName}</div>
        </div>
        <div style="padding:24px;">
          <div style="margin:0 0 16px;color:#e64a19;font-size:12px;font-weight:700;text-transform:uppercase;">${reminderType}</div>
          <p style="margin:0 0 16px;line-height:1.6;">Hello ${parentName},</p>
          <p style="margin:0 0 20px;line-height:1.6;">${message}</p>
          <div style="margin:0 0 20px;padding:16px;background:#f8f8f7;border:1px solid #eceef1;border-radius:8px;">
            ${summaryRowHtml("Student", studentName, true)}
            ${summaryRowHtml("Student reference", studentReference)}
            ${summaryRowHtml("Total outstanding", balance, true, "#c62828")}
            ${summaryRowHtml("Earliest official due date", earliestDueDate)}
          </div>
          <h2 style="margin:0 0 12px;font-size:16px;line-height:1.4;">Fee details</h2>
          ${feeCards || '<p style="margin:0 0 20px;color:#5a6070;">No fee details are available.</p>'}
          <p style="margin:4px 0 20px;color:#5a6070;font-size:12px;line-height:1.6;">Term dates are installment schedule information. The fee due date is the official parent deadline.</p>
          <a href="${portalUrl}" style="display:inline-block;background:#ef4b1a;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:6px;">Sign in to review and pay</a>
          <p style="margin:20px 0 0;color:#5a6070;font-size:13px;line-height:1.6;">For questions about this balance, contact your school finance office.</p>
          <p style="margin:12px 0 0;color:#747b89;font-size:12px;line-height:1.5;">This is an automated payment reminder from XMETA Pay.</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function feeCardHtml(fee: PaymentReminderFee) {
  const terms = fee.terms.length > 0
    ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #eceef1;">
        <div style="margin-bottom:8px;color:#5a6070;font-size:12px;font-weight:700;text-transform:uppercase;">Installment schedule</div>
        ${fee.terms.map(termRowHtml).join("")}
      </div>`
    : "";

  return `<div style="margin:0 0 12px;padding:16px;border:1px solid #dfe2e7;border-radius:8px;">
    <div style="margin-bottom:12px;font-size:15px;font-weight:700;">${escapeHtml(fee.name)} <span style="color:#747b89;font-size:12px;font-weight:400;">(${escapeHtml(categoryLabel(fee.category))})</span></div>
    ${summaryRowHtml("Billed", escapeHtml(fee.billed))}
    ${summaryRowHtml("Paid", escapeHtml(fee.paid), false, "#2e7d32")}
    ${summaryRowHtml("Balance", escapeHtml(fee.balance), true, "#c62828")}
    ${summaryRowHtml("Official due date", escapeHtml(fee.officialDueDate))}
    ${summaryRowHtml("Status", escapeHtml(fee.status))}
    ${terms}
  </div>`;
}

function termRowHtml(term: PaymentReminderTerm) {
  return `<div style="margin-top:8px;padding:10px 12px;background:#f8f8f7;border-radius:6px;font-size:12px;line-height:1.6;">
    <div style="font-weight:700;">${escapeHtml(term.name)} &middot; ${escapeHtml(term.status)}</div>
    <div style="color:#5a6070;">Schedule date: ${escapeHtml(term.scheduleDate)}</div>
    <div style="color:#5a6070;">Billed ${escapeHtml(term.billed)} &middot; Paid ${escapeHtml(term.paid)} &middot; Balance <strong style="color:#c62828;">${escapeHtml(term.balance)}</strong></div>
  </div>`;
}

function summaryRowHtml(label: string, value: string, strong = false, color = "#0f1117") {
  return `<div style="display:flex;justify-content:space-between;gap:16px;padding:5px 0;font-size:13px;line-height:1.5;">
    <span style="color:#5a6070;">${escapeHtml(label)}</span>
    <span style="text-align:right;color:${color};font-weight:${strong ? "700" : "400"};">${value}</span>
  </div>`;
}

function categoryLabel(category: PaymentReminderFee["category"]) {
  if (category === "tuition") return "Tuition";
  if (category === "other") return "Other fee";
  return "Allowance";
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
