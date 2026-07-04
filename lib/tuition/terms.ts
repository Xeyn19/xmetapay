import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type TuitionTermInput = {
  name: string;
  amount: number;
  dueDate: string;
};

export type ParsedTuitionTerm = {
  id: number;
  name: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: string;
  payable: boolean;
};

export type ParentPayableTuitionTerm = RowDataPacket & {
  id: number;
  student_fee_assignment_id: number;
  amount_due: number | string;
  amount_paid: number | string;
  due_date: Date | string | null;
  status: string;
  term_name: string;
  fee_name: string;
  category: "tuition";
  student_id: number;
  school_id?: number;
  student_reference: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type SaveTuitionTermScheduleParams = {
  schoolId: number;
  schoolYearId: number;
  assignmentId: number;
  terms: TuitionTermInput[];
};

type SaveFeeTypeTermTemplateParams = {
  feeTypeId: number;
  terms: TuitionTermInput[];
};

type CreateTuitionTermsFromTemplateParams = {
  assignmentIds: number[];
  templateTerms: TuitionTermInput[];
  amountDue: number;
};

type ApplyTuitionTermPaymentParams = {
  parentUserId: number;
  tuitionTermIds: number[];
  channel: string;
  makeReferenceNumber: (prefix: "PAY" | "RCT") => string;
};

export class TuitionTermsError extends Error {}

export function parseTuitionTermInputs(formData: FormData) {
  const names = formData.getAll("termName");
  const amounts = formData.getAll("termAmount");
  const dueDates = formData.getAll("termDueDate");
  const count = Math.min(names.length, amounts.length, dueDates.length, 12);
  const seen = new Set<string>();
  const terms: TuitionTermInput[] = [];

  for (let index = 0; index < count; index += 1) {
    const name = field(names[index]);
    const amount = amountField(amounts[index]);
    const dueDate = field(dueDates[index]);

    if (!name && amount === null && !dueDate) {
      continue;
    }

    if (!name || amount === null || amount <= 0 || !validDate(dueDate)) {
      throw new TuitionTermsError("Each term needs a name, amount greater than zero, and a valid due date.");
    }

    const normalized = name.toLowerCase();

    if (seen.has(normalized)) {
      throw new TuitionTermsError("Term names must be unique for this tuition assignment.");
    }

    seen.add(normalized);
    terms.push({ name, amount: roundMoney(amount), dueDate });
  }

  return terms;
}

export function parseTuitionTermsBlob(value: string | null): ParsedTuitionTerm[] {
  if (!value) {
    return [];
  }

  return value
    .split("||")
    .map((term) => {
      const [id, name, amountDue, amountPaid, dueDate, status] = term.split("~");
      const due = decimalValue(amountDue);
      const paid = decimalValue(amountPaid);
      const balance = Math.max(due - paid, 0);

      return {
        id: Number(id),
        name,
        amountDue: due,
        amountPaid: paid,
        balance,
        dueDate,
        status,
        payable: isTuitionTermPayable(status, balance),
      };
    })
    .filter((term) => Number.isInteger(term.id) && term.id > 0);
}

export function getTuitionTermSummary(termCount: number | string, paidCount: number | string, openCount: number | string) {
  const total = numberValue(termCount);

  if (total === 0) {
    return "No terms";
  }

  const paid = numberValue(paidCount);
  const open = numberValue(openCount);

  if (paid === total) {
    return `${total} terms paid`;
  }

  if (paid > 0) {
    return `${paid}/${total} terms paid`;
  }

  return `${open} open term${open === 1 ? "" : "s"}`;
}

export function isTuitionTermPayable(status: string, balance: number) {
  return balance > 0 && (status === "open" || status === "partial");
}

export function validateTuitionTermSchedule(terms: TuitionTermInput[], remainingBalance: number) {
  if (terms.length === 0) {
    throw new TuitionTermsError("Add at least one payment term.");
  }

  const totalTerms = roundMoney(terms.reduce((sum, term) => sum + term.amount, 0));

  if (remainingBalance <= 0 || totalTerms !== remainingBalance) {
    throw new TuitionTermsError(`Term amounts must total the remaining tuition balance of ${money(remainingBalance)}.`);
  }

  return totalTerms;
}

export async function saveFeeTypeTermTemplate(
  connection: PoolConnection,
  params: SaveFeeTypeTermTemplateParams,
) {
  if (params.terms.length === 0) {
    return 0;
  }

  const values = params.terms
    .map((_, index) => `(:feeTypeId, :termName${index}, :sortOrder${index}, :amountDue${index}, :dueDate${index})`)
    .join(", ");
  const queryParams = params.terms.reduce<Record<string, string | number>>((next, term, index) => {
    next[`termName${index}`] = term.name;
    next[`sortOrder${index}`] = index + 1;
    next[`amountDue${index}`] = term.amount;
    next[`dueDate${index}`] = term.dueDate;
    return next;
  }, { feeTypeId: params.feeTypeId });

  await connection.execute<ResultSetHeader>(
    `INSERT INTO fee_type_term_templates (
       fee_type_id, term_name, sort_order, amount_due, due_date
     )
     VALUES ${values}`,
    queryParams,
  );

  return params.terms.length;
}

export async function getFeeTypeTermTemplate(connection: PoolConnection, feeTypeId: number) {
  const [rows] = await connection.execute<FeeTypeTermTemplateRow[]>(
    `SELECT term_name, amount_due, due_date
     FROM fee_type_term_templates
     WHERE fee_type_id = :feeTypeId
     ORDER BY sort_order ASC`,
    { feeTypeId },
  );

  return rows.map((row) => ({
    name: row.term_name,
    amount: decimalValue(row.amount_due),
    dueDate: formatDateForInput(row.due_date),
  }));
}

export async function createTuitionTermsFromTemplate(
  connection: PoolConnection,
  params: CreateTuitionTermsFromTemplateParams,
) {
  if (params.assignmentIds.length === 0 || params.templateTerms.length === 0) {
    return 0;
  }

  const scaledTerms = scaleTuitionTermTemplate(params.templateTerms, params.amountDue);
  let createdCount = 0;

  for (const assignmentId of params.assignmentIds) {
    const [existingRows] = await connection.execute<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM tuition_payment_terms
       WHERE student_fee_assignment_id = :assignmentId`,
      { assignmentId },
    );

    if (numberValue(existingRows[0]?.total) > 0) {
      continue;
    }

    const values = scaledTerms
      .map((_, index) =>
        `(:assignmentId, :termName${index}, :sortOrder${index}, :amountDue${index}, 0.00, :dueDate${index}, 'open')`,
      )
      .join(", ");
    const queryParams = scaledTerms.reduce<Record<string, string | number>>((next, term, index) => {
      next[`termName${index}`] = term.name;
      next[`sortOrder${index}`] = index + 1;
      next[`amountDue${index}`] = term.amount;
      next[`dueDate${index}`] = term.dueDate;
      return next;
    }, { assignmentId });

    await connection.execute<ResultSetHeader>(
      `INSERT INTO tuition_payment_terms (
         student_fee_assignment_id, term_name, sort_order, amount_due, amount_paid, due_date, status
       )
       VALUES ${values}`,
      queryParams,
    );
    createdCount += scaledTerms.length;
  }

  return createdCount;
}

export function scaleTuitionTermTemplate(terms: TuitionTermInput[], amountDue: number) {
  if (terms.length === 0) {
    return [];
  }

  const totalCents = Math.round(roundMoney(amountDue) * 100);

  if (totalCents < terms.length) {
    throw new TuitionTermsError("Custom amount is too small for this tuition term template.");
  }

  const templateTotalCents = terms.reduce((sum, term) => sum + Math.round(term.amount * 100), 0);

  if (templateTotalCents <= 0) {
    throw new TuitionTermsError("Tuition term template amounts must be greater than zero.");
  }

  let allocatedCents = 0;

  return terms.map((term, index) => {
    const remainingTerms = terms.length - index;
    const remainingCents = totalCents - allocatedCents;
    const cents = index === terms.length - 1
      ? remainingCents
      : Math.max(1, Math.min(remainingCents - (remainingTerms - 1), Math.round((Math.round(term.amount * 100) / templateTotalCents) * totalCents)));

    allocatedCents += cents;

    return {
      ...term,
      amount: roundMoney(cents / 100),
    };
  });
}

export async function saveTuitionTermSchedule(
  connection: PoolConnection,
  params: SaveTuitionTermScheduleParams,
) {
  const assignment = await getLockedTuitionAssignment(connection, params);

  if (!assignment) {
    throw new TuitionTermsError("Choose a valid tuition assignment from this school year.");
  }

  if (assignment.status === "paid" || decimalValue(assignment.amount_paid) >= decimalValue(assignment.amount_due)) {
    throw new TuitionTermsError("Paid tuition assignments cannot be split into new terms.");
  }

  const [paidTermRows] = await connection.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM tuition_payment_terms
     WHERE student_fee_assignment_id = :assignmentId
       AND amount_paid > 0`,
    { assignmentId: params.assignmentId },
  );

  if (Number(paidTermRows[0]?.total ?? 0) > 0) {
    throw new TuitionTermsError("This tuition already has paid terms. Keep the current schedule for audit safety.");
  }

  const remainingBalance = roundMoney(decimalValue(assignment.amount_due) - decimalValue(assignment.amount_paid));
  validateTuitionTermSchedule(params.terms, remainingBalance);

  await connection.execute<ResultSetHeader>(
    `DELETE FROM tuition_payment_terms
     WHERE student_fee_assignment_id = :assignmentId`,
    { assignmentId: params.assignmentId },
  );

  const values = params.terms
    .map((_, index) =>
      `(:assignmentId, :termName${index}, :sortOrder${index}, :amountDue${index}, 0.00, :dueDate${index}, 'open')`,
    )
    .join(", ");
  const queryParams = params.terms.reduce<Record<string, string | number>>((next, term, index) => {
    next[`termName${index}`] = term.name;
    next[`sortOrder${index}`] = index + 1;
    next[`amountDue${index}`] = term.amount;
    next[`dueDate${index}`] = term.dueDate;
    return next;
  }, { assignmentId: params.assignmentId });

  await connection.execute<ResultSetHeader>(
    `INSERT INTO tuition_payment_terms (
       student_fee_assignment_id, term_name, sort_order, amount_due, amount_paid, due_date, status
     )
     VALUES ${values}`,
    queryParams,
  );

  return params.terms.length;
}

export async function getParentPayableTuitionTerms(parentUserId: number) {
  const [rows] = await pool.execute<ParentPayableTuitionTerm[]>(
    `SELECT tpt.id, tpt.student_fee_assignment_id, tpt.amount_due, tpt.amount_paid, tpt.due_date, tpt.status, tpt.term_name,
       ft.name AS fee_name, ft.category,
       st.id AS student_id, st.student_reference, st.first_name, st.middle_name, st.last_name
     FROM student_guardians sg
     JOIN students st ON st.id = sg.student_id
     JOIN student_fee_assignments sfa ON sfa.student_id = st.id
     JOIN fee_types ft ON ft.id = sfa.fee_type_id AND ft.category = 'tuition'
     JOIN tuition_payment_terms tpt ON tpt.student_fee_assignment_id = sfa.id
     WHERE sg.parent_user_id = :parentUserId
       AND tpt.status IN ('open', 'partial')
       AND tpt.amount_due > tpt.amount_paid
     ORDER BY st.last_name ASC, st.first_name ASC, tpt.due_date ASC, tpt.sort_order ASC`,
    { parentUserId },
  );

  return rows;
}

export async function applyTuitionTermPayment(
  connection: PoolConnection,
  params: ApplyTuitionTermPaymentParams,
) {
  const terms = await getLockedParentPayableTuitionTerms(connection, params.parentUserId, params.tuitionTermIds);

  if (terms.length !== params.tuitionTermIds.length) {
    throw new TuitionTermsError("Some selected tuition terms are no longer payable. Refresh and try again.");
  }

  const studentIds = new Set(terms.map((term) => term.student_id));

  if (studentIds.size !== 1) {
    throw new TuitionTermsError("Pay one student's tuition terms at a time.");
  }

  const schoolIds = new Set(terms.map((term) => term.school_id));

  if (schoolIds.size !== 1) {
    throw new TuitionTermsError("Selected terms must belong to one school.");
  }

  const schoolId = terms[0]?.school_id;

  if (typeof schoolId !== "number") {
    throw new TuitionTermsError("Selected terms must belong to one school.");
  }

  const total = roundMoney(
    terms.reduce((sum, term) => sum + Math.max(decimalValue(term.amount_due) - decimalValue(term.amount_paid), 0), 0),
  );

  if (total <= 0) {
    throw new TuitionTermsError("The selected tuition terms are already paid.");
  }

  const referenceNumber = params.makeReferenceNumber("PAY");
  const receiptNumber = params.makeReferenceNumber("RCT");
  const [paymentResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO payments (school_id, payer_user_id, student_id, reference_number, channel, amount, status, paid_at)
     VALUES (:schoolId, :payerUserId, :studentId, :referenceNumber, :channel, :amount, 'paid', NOW())`,
    {
      schoolId,
      payerUserId: params.parentUserId,
      studentId: terms[0].student_id,
      referenceNumber,
      channel: params.channel,
      amount: total,
    },
  );
  const paymentId = paymentResult.insertId;

  for (const term of terms) {
    const balance = roundMoney(Math.max(decimalValue(term.amount_due) - decimalValue(term.amount_paid), 0));

    await connection.execute<ResultSetHeader>(
      `INSERT INTO payment_term_allocations (payment_id, tuition_payment_term_id, amount)
       VALUES (:paymentId, :tuitionPaymentTermId, :amount)`,
      {
        paymentId,
        tuitionPaymentTermId: term.id,
        amount: balance,
      },
    );
    await connection.execute<ResultSetHeader>(
      `UPDATE tuition_payment_terms
       SET amount_paid = LEAST(amount_due, amount_paid + :amount),
         status = CASE
           WHEN amount_paid + :amount >= amount_due THEN 'paid'
           ELSE 'partial'
         END
       WHERE id = :tuitionPaymentTermId`,
      {
        tuitionPaymentTermId: term.id,
        amount: balance,
      },
    );
  }

  const assignmentIds = [...new Set(terms.map((term) => term.student_fee_assignment_id))];

  for (const assignmentId of assignmentIds) {
    await recalculateTuitionAssignmentFromTerms(connection, assignmentId);
  }

  const [receiptResult] = await connection.execute<ResultSetHeader>(
    `INSERT INTO receipts (payment_id, receipt_number)
     VALUES (:paymentId, :receiptNumber)`,
    {
      paymentId,
      receiptNumber,
    },
  );

  return receiptResult.insertId;
}

export async function recalculateTuitionAssignmentFromTerms(connection: PoolConnection, assignmentId: number) {
  await connection.execute<ResultSetHeader>(
    `UPDATE student_fee_assignments sfa
     JOIN (
       SELECT student_fee_assignment_id,
         COALESCE(SUM(amount_due), 0) AS term_due,
         COALESCE(SUM(amount_paid), 0) AS term_paid
       FROM tuition_payment_terms
       WHERE student_fee_assignment_id = :assignmentId
         AND status <> 'cancelled'
       GROUP BY student_fee_assignment_id
     ) term_totals ON term_totals.student_fee_assignment_id = sfa.id
     SET sfa.amount_paid = LEAST(
         sfa.amount_due,
         GREATEST(sfa.amount_due - term_totals.term_due, 0) + term_totals.term_paid
       ),
       sfa.status = CASE
         WHEN GREATEST(sfa.amount_due - term_totals.term_due, 0) + term_totals.term_paid >= sfa.amount_due THEN 'paid'
         WHEN GREATEST(sfa.amount_due - term_totals.term_due, 0) + term_totals.term_paid > 0 THEN 'partial'
         ELSE 'open'
       END
     WHERE sfa.id = :assignmentId`,
    { assignmentId },
  );
}

async function getLockedTuitionAssignment(
  connection: PoolConnection,
  params: SaveTuitionTermScheduleParams,
) {
  const [rows] = await connection.execute<TuitionAssignmentRow[]>(
    `SELECT sfa.id, sfa.amount_due, sfa.amount_paid, sfa.status
     FROM student_fee_assignments sfa
     JOIN fee_types ft ON ft.id = sfa.fee_type_id AND ft.category = 'tuition'
     JOIN students st ON st.id = sfa.student_id
     WHERE sfa.id = :assignmentId
       AND st.school_id = :schoolId
       AND sfa.school_year_id = :schoolYearId
     FOR UPDATE`,
    {
      assignmentId: params.assignmentId,
      schoolId: params.schoolId,
      schoolYearId: params.schoolYearId,
    },
  );

  return rows[0] ?? null;
}

async function getLockedParentPayableTuitionTerms(
  connection: PoolConnection,
  parentUserId: number,
  tuitionTermIds: number[],
) {
  const placeholders = tuitionTermIds.map((_, index) => `:tuitionTermId${index}`).join(", ");
  const params = Object.fromEntries(tuitionTermIds.map((id, index) => [`tuitionTermId${index}`, id]));
  const [rows] = await connection.execute<ParentPayableTuitionTerm[]>(
    `SELECT tpt.id, tpt.student_fee_assignment_id, tpt.amount_due, tpt.amount_paid, tpt.status,
       st.id AS student_id, st.school_id
     FROM tuition_payment_terms tpt
     JOIN student_fee_assignments sfa ON sfa.id = tpt.student_fee_assignment_id
     JOIN fee_types ft ON ft.id = sfa.fee_type_id AND ft.category = 'tuition'
     JOIN students st ON st.id = sfa.student_id
     JOIN student_guardians sg ON sg.student_id = st.id AND sg.parent_user_id = :parentUserId
     WHERE tpt.id IN (${placeholders})
       AND tpt.status IN ('open', 'partial')
       AND tpt.amount_due > tpt.amount_paid
     FOR UPDATE`,
    {
      parentUserId,
      ...params,
    },
  );

  return rows;
}

function field(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function amountField(value: FormDataEntryValue | null | undefined) {
  const raw = field(value);

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : null;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function formatDateForInput(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function decimalValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number) {
  return `P${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

type CountRow = RowDataPacket & {
  total: number;
};

type FeeTypeTermTemplateRow = RowDataPacket & {
  term_name: string;
  amount_due: number | string;
  due_date: Date | string;
};

type TuitionAssignmentRow = RowDataPacket & {
  id: number;
  amount_due: number | string;
  amount_paid: number | string;
  status: string;
};
