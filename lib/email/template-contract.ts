export const paymentReminderTypes = ["tuition_due", "overdue_notice", "final_notice"] as const;

export type PaymentReminderType = (typeof paymentReminderTypes)[number];

export const emailTemplateVariableKeys = [
  "parent_name",
  "student_name",
  "student_reference",
  "school_name",
  "school_year",
  "total_outstanding",
  "earliest_due_date",
  "parent_portal_url",
] as const;

export type EmailTemplateVariableKey = (typeof emailTemplateVariableKeys)[number];
export type EmailTemplateValues = Record<EmailTemplateVariableKey, string>;

export type SchoolEmailTemplate = {
  reference: string;
  id: number | null;
  source: "builtin" | "school";
  reminderType: PaymentReminderType;
  name: string;
  subjectTemplate: string;
  messageTemplate: string;
  status: "active" | "inactive";
  isDefault: boolean;
  editable: boolean;
  updatedAt: string | null;
};

export const sampleEmailTemplateValues: EmailTemplateValues = {
  parent_name: "Maria Santos",
  student_name: "Alex Santos",
  student_reference: "XMETA-2026-001",
  school_name: "Sample Academy",
  school_year: "2026-2027",
  total_outstanding: "₱8,500.00",
  earliest_due_date: "August 31, 2026",
  parent_portal_url: "https://example.com/parent/login",
};

export const builtInPaymentReminderTemplates: SchoolEmailTemplate[] = [
  {
    reference: "builtin:tuition_due",
    id: null,
    source: "builtin",
    reminderType: "tuition_due",
    name: "Friendly payment reminder",
    subjectTemplate: "{{school_name}}: Payment reminder for {{student_name}}",
    messageTemplate:
      "Hello {{parent_name}}, this is a friendly reminder that {{student_name}} has an outstanding school balance of {{total_outstanding}}. Please review the details below and sign in to XMETA Pay when convenient.",
    status: "active",
    isDefault: true,
    editable: false,
    updatedAt: null,
  },
  {
    reference: "builtin:overdue_notice",
    id: null,
    source: "builtin",
    reminderType: "overdue_notice",
    name: "Overdue payment notice",
    subjectTemplate: "{{school_name}}: Overdue balance for {{student_name}}",
    messageTemplate:
      "Hello {{parent_name}}, the school balance for {{student_name}} is overdue. The current outstanding amount is {{total_outstanding}}. Please review the itemized statement below or contact the school finance office if you need assistance.",
    status: "active",
    isDefault: true,
    editable: false,
    updatedAt: null,
  },
  {
    reference: "builtin:final_notice",
    id: null,
    source: "builtin",
    reminderType: "final_notice",
    name: "Final payment notice",
    subjectTemplate: "{{school_name}}: Final payment notice for {{student_name}}",
    messageTemplate:
      "Hello {{parent_name}}, this is a final payment notice for {{student_name}}. The outstanding school balance is {{total_outstanding}}. Please settle the balance or contact the school finance office as soon as possible.",
    status: "active",
    isDefault: true,
    editable: false,
    updatedAt: null,
  },
];

export function renderEmailTemplateText(template: string, values: EmailTemplateValues) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (token, key: string) =>
    emailTemplateVariableKeys.includes(key as EmailTemplateVariableKey)
      ? values[key as EmailTemplateVariableKey]
      : token,
  );
}

export function unsupportedEmailTemplateVariables(template: string) {
  const unsupported = new Set<string>();
  const withoutCompletePlaceholders = template.replace(/{{\s*([^{}]+?)\s*}}/g, "");

  for (const match of template.matchAll(/{{\s*([^{}]+?)\s*}}/g)) {
    const key = match[1]?.trim() ?? "";
    if (!emailTemplateVariableKeys.includes(key as EmailTemplateVariableKey)) {
      unsupported.add(key || "empty placeholder");
    }
  }

  if (withoutCompletePlaceholders.includes("{{") || withoutCompletePlaceholders.includes("}}")) {
    unsupported.add("malformed placeholder");
  }

  return [...unsupported];
}

export function labelForPaymentReminderType(type: PaymentReminderType) {
  if (type === "overdue_notice") return "Overdue notice";
  if (type === "final_notice") return "Final notice";
  return "Tuition due reminder";
}

export function isPaymentReminderType(value: string): value is PaymentReminderType {
  return paymentReminderTypes.includes(value as PaymentReminderType);
}
