"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/session";
import { adminSchoolYearCookieName, canSelectAdminSchoolYear } from "@/lib/school/setup";

export async function selectAdminSchoolYearAction(formData: FormData) {
  const session = await requireRole("admin");
  const schoolYearId = Number(formData.get("schoolYearId"));
  const redirectTo = safeAdminRedirect(formData.get("redirectTo"));
  const cookieStore = await cookies();

  if (await canSelectAdminSchoolYear(session.userId, schoolYearId)) {
    cookieStore.set(adminSchoolYearCookieName, String(schoolYearId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    cookieStore.delete({
      name: adminSchoolYearCookieName,
      path: "/",
    });
  }

  redirect(redirectTo);
}

function safeAdminRedirect(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/admin")) {
    return "/admin/dashboard";
  }

  return value;
}
