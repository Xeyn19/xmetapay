import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

export type TuitionCollectionRow = RowDataPacket & {
  id: number;
  reference_number: string;
  amount: number | string;
  channel: string;
  status: string;
  paid_at: Date | string | null;
  created_at: Date | string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  grade_name: string | null;
  fee_name: string;
};

export type TuitionCollectionSummary = RowDataPacket & {
  total_count: number;
  paid_count: number;
  pending_count: number;
  failed_count: number;
  paid_amount: number | string;
};

const tuitionPaymentScope = `
  p.school_id = :schoolId
  AND (
    EXISTS (
      SELECT 1
      FROM payment_allocations pa_scope
      JOIN student_fee_assignments sfa_scope
        ON sfa_scope.id = pa_scope.student_fee_assignment_id
      JOIN fee_types ft_scope
        ON ft_scope.id = sfa_scope.fee_type_id
       AND ft_scope.category = 'tuition'
      WHERE pa_scope.payment_id = p.id
        AND sfa_scope.school_year_id = :schoolYearId
    )
    OR EXISTS (
      SELECT 1
      FROM payment_term_allocations pta_scope
      JOIN tuition_payment_terms tpt_scope
        ON tpt_scope.id = pta_scope.tuition_payment_term_id
      JOIN student_fee_assignments term_sfa_scope
        ON term_sfa_scope.id = tpt_scope.student_fee_assignment_id
      JOIN fee_types term_ft_scope
        ON term_ft_scope.id = term_sfa_scope.fee_type_id
       AND term_ft_scope.category = 'tuition'
      WHERE pta_scope.payment_id = p.id
        AND term_sfa_scope.school_year_id = :schoolYearId
    )
  )`;

export async function getTuitionCollectionSummary(schoolId: number, schoolYearId: number) {
  const [rows] = await pool.execute<TuitionCollectionSummary[]>(
    `SELECT COUNT(*) AS total_count,
       COUNT(CASE WHEN p.status = 'paid' THEN 1 END) AS paid_count,
       COUNT(CASE WHEN p.status = 'pending' THEN 1 END) AS pending_count,
       COUNT(CASE WHEN p.status IN ('failed', 'voided', 'refunded') THEN 1 END) AS failed_count,
       COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) AS paid_amount
     FROM payments p
     WHERE ${tuitionPaymentScope}`,
    { schoolId, schoolYearId },
  );

  return rows[0] ?? {
    total_count: 0,
    paid_count: 0,
    pending_count: 0,
    failed_count: 0,
    paid_amount: 0,
  };
}

export async function getTuitionCollectionRows(schoolId: number, schoolYearId: number, limit?: number) {
  const limitClause = typeof limit === "number" ? `LIMIT ${Math.max(1, Math.floor(limit))}` : "";
  const [rows] = await pool.execute<TuitionCollectionRow[]>(
    `SELECT p.id, p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
       st.first_name, st.middle_name, st.last_name,
       gl.name AS grade_name,
       COALESCE(
         GROUP_CONCAT(DISTINCT CONCAT(term_ft.name, ' - ', tpt.term_name) ORDER BY tpt.sort_order SEPARATOR ', '),
         GROUP_CONCAT(DISTINCT ft.name ORDER BY ft.name SEPARATOR ', '),
         'Tuition'
       ) AS fee_name
     FROM payments p
     JOIN students st ON st.id = p.student_id
     LEFT JOIN enrollments e
       ON e.student_id = st.id
      AND e.school_year_id = :schoolYearId
     LEFT JOIN grade_levels gl ON gl.id = e.grade_level_id
     LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
     LEFT JOIN student_fee_assignments sfa ON sfa.id = pa.student_fee_assignment_id
     LEFT JOIN fee_types ft
       ON ft.id = sfa.fee_type_id
      AND ft.category = 'tuition'
     LEFT JOIN payment_term_allocations pta ON pta.payment_id = p.id
     LEFT JOIN tuition_payment_terms tpt ON tpt.id = pta.tuition_payment_term_id
     LEFT JOIN student_fee_assignments term_sfa ON term_sfa.id = tpt.student_fee_assignment_id
     LEFT JOIN fee_types term_ft
       ON term_ft.id = term_sfa.fee_type_id
      AND term_ft.category = 'tuition'
     WHERE ${tuitionPaymentScope}
     GROUP BY p.id, p.reference_number, p.amount, p.channel, p.status, p.paid_at, p.created_at,
       st.first_name, st.middle_name, st.last_name, gl.name
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
     ${limitClause}`,
    { schoolId, schoolYearId },
  );

  return rows;
}
