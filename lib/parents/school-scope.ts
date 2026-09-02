import "server-only";

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "@/lib/auth/db";

type Queryable = Pick<Pool | PoolConnection, "execute">;

export type ParentSchoolScope = {
  schoolId: number;
  schoolName: string;
  schoolCode: string;
  schoolStatus: "active" | "inactive";
};

export type ParentRegistrationSchool = {
  value: string;
  label: string;
};

export class ParentSchoolScopeError extends Error {
  constructor(
    message: string,
    readonly reason: "unassigned" | "inactive" | "invalid_registration_school",
  ) {
    super(message);
    this.name = "ParentSchoolScopeError";
  }
}

export async function getActiveParentRegistrationSchools(): Promise<ParentRegistrationSchool[]> {
  const [rows] = await pool.execute<RegistrationSchoolRow[]>(
    `SELECT id, name, code
     FROM schools
     WHERE status = 'active'
     ORDER BY name, code, id`,
  );

  return rows.map((school) => ({
    value: String(school.id),
    label: `${school.name} (${school.code})`,
  }));
}

export async function validateActiveRegistrationSchool(
  executor: Queryable,
  schoolId: number,
): Promise<ParentSchoolScope> {
  const [rows] = await executor.execute<ParentSchoolRow[]>(
    `SELECT id, name, code, status
     FROM schools
     WHERE id = :schoolId
       AND status = 'active'
     LIMIT 1`,
    { schoolId },
  );
  const school = rows[0];

  if (!school) {
    throw new ParentSchoolScopeError(
      "Choose an active school from the registration list.",
      "invalid_registration_school",
    );
  }

  return schoolScopeFromRow(school);
}

export async function getParentSchoolScope(
  parentUserId: number,
  executor: Queryable = pool,
): Promise<ParentSchoolScope | null> {
  const [rows] = await executor.execute<ParentSchoolRow[]>(
    `SELECT sc.id, sc.name, sc.code, sc.status
     FROM parent_profiles pp
     JOIN schools sc ON sc.id = pp.school_id
     WHERE pp.user_id = :parentUserId
     LIMIT 1`,
    { parentUserId },
  );

  return rows[0] ? schoolScopeFromRow(rows[0]) : null;
}

export async function requireParentSchoolScope(
  parentUserId: number,
  options: { forWrite?: boolean; executor?: Queryable } = {},
): Promise<ParentSchoolScope> {
  const scope = await getParentSchoolScope(parentUserId, options.executor ?? pool);

  if (!scope) {
    throw new ParentSchoolScopeError(
      "Your parent account is not assigned to one school. Contact support before continuing.",
      "unassigned",
    );
  }

  if (options.forWrite && scope.schoolStatus !== "active") {
    throw new ParentSchoolScopeError(
      "This school is inactive. Historical records remain available, but new parent transactions are disabled.",
      "inactive",
    );
  }

  return scope;
}

function schoolScopeFromRow(row: ParentSchoolRow): ParentSchoolScope {
  return {
    schoolId: Number(row.id),
    schoolName: row.name,
    schoolCode: row.code,
    schoolStatus: row.status,
  };
}

type ParentSchoolRow = RowDataPacket & {
  id: number;
  name: string;
  code: string;
  status: "active" | "inactive";
};

type RegistrationSchoolRow = ParentSchoolRow;
