import "server-only";

export type StudentSex = "male" | "female";
export type StudentType = "new" | "transferee" | "returned";

export function calculateAge(birthdate: Date | string | null, today = new Date()) {
  if (!birthdate) return "Pending";
  const value = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (Number.isNaN(value.getTime())) return "Pending";
  let age = today.getFullYear() - value.getFullYear();
  const month = today.getMonth() - value.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < value.getDate())) age -= 1;
  return age >= 0 ? `${age}` : "Pending";
}

export function labelForSex(value: string | null | undefined) {
  return value === "male" ? "Male" : value === "female" ? "Female" : "Pending";
}

export function labelForStudentType(value: string | null | undefined) {
  return value === "new" ? "New" : value === "transferee" ? "Transferee" : value === "returned" ? "Returned" : "Pending";
}
