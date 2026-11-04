"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminStaffRole } from "@/lib/admin/access";
import { canManageSchoolSetup } from "@/lib/admin/permissions";
import { deleteSession, requireRole } from "@/lib/auth/session";
import {
  getSchoolOnboardingState,
  saveBasicEducationStep,
  saveCollegeInitialStep,
  saveSchoolProfileStep,
  saveSchoolYearStep,
  SchoolOnboardingError,
  type BasicEducationSetupDraft,
  type CollegeInitialSetupDraft,
} from "@/lib/school/onboarding";
import type { EducationScope } from "@/lib/school/academic-offerings";

export type OnboardingStepResult = {
  status: "idle" | "error" | "success";
  message?: string;
  field?: string;
  nextStep?: 1 | 2 | 3 | 4 | 5;
  completedStep?: 1 | 2 | 3 | 4;
};

export async function saveOnboardingStepAction(
  _previous: OnboardingStepResult,
  formData: FormData,
): Promise<OnboardingStepResult> {
  const session = await requireRole("admin");
  const staffRole = await getAdminStaffRole(session.userId);
  if (!canManageSchoolSetup(staffRole)) {
    return { status: "error", message: "Only the school administrator can complete school setup." };
  }

  const step = Number(textValue(formData, "step"));
  const exitAfterSave = textValue(formData, "submitMode") === "exit";

  try {
    if (step === 1) {
      await saveSchoolProfileStep(session.userId, {
        schoolName: textValue(formData, "schoolName"),
        schoolCode: textValue(formData, "schoolCode"),
        educationScope: textValue(formData, "educationScope") as EducationScope,
      });
    } else if (step === 2) {
      await saveSchoolYearStep(session.userId, {
        name: textValue(formData, "yearName"),
        startsOn: textValue(formData, "startsOn"),
        endsOn: textValue(formData, "endsOn"),
      });
    } else if (step === 3) {
      await saveBasicEducationStep(session.userId, {
        grades: parseGrades(textValue(formData, "grades")),
        seniorHigh: parseSeniorHigh(textValue(formData, "seniorHigh")),
      });
    } else if (step === 4) {
      await saveCollegeInitialStep(session.userId, {
        periodType: textValue(formData, "periodType") as CollegeInitialSetupDraft["periodType"],
        periodName: textValue(formData, "periodName"),
        startsOn: textValue(formData, "periodStartsOn"),
        endsOn: textValue(formData, "periodEndsOn"),
        programs: parseCollegePrograms(textValue(formData, "collegePrograms")),
      });
    } else if (step === 5) {
      const state = await getSchoolOnboardingState(session.userId);
      if (!state.readiness.complete) {
        return { status: "error", message: "Complete every required setup step before finishing.", nextStep: state.currentStep };
      }
      redirect("/admin/dashboard");
    } else {
      return { status: "error", message: "Choose a valid setup step." };
    }

    revalidatePath("/admin/onboarding/school-setup");
    revalidatePath("/admin/school-setup");
    revalidatePath("/admin/dashboard");

    if (exitAfterSave) {
      await deleteSession();
      redirect("/admin/login?signedOut=1&setupSaved=1");
    }

    const refreshed = await getSchoolOnboardingState(session.userId);
    return {
      status: "success",
      message: "Progress saved. You can continue or return later.",
      nextStep: refreshed.currentStep,
      completedStep: step as 1 | 2 | 3 | 4,
    };
  } catch (error) {
    if (error instanceof SchoolOnboardingError) {
      return { status: "error", message: error.message, field: error.field };
    }
    if (typeof error === "object" && error !== null && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    console.error("[school-onboarding:save]", error instanceof Error ? error.message : error);
    return { status: "error", message: "School setup could not be saved. Confirm MySQL/XAMPP is running and try again." };
  }
}

function parseSeniorHigh(value: string): BasicEducationSetupDraft["seniorHigh"] {
  try {
    const parsed = JSON.parse(value) as Array<{
      gradeName?: unknown;
      curriculumVersion?: unknown;
      offerings?: unknown;
    }>;
    return parsed.map((grade) => ({
      gradeName: String(grade.gradeName ?? ""),
      curriculumVersion: String(grade.curriculumVersion ?? "") as BasicEducationSetupDraft["seniorHigh"][number]["curriculumVersion"],
      offerings: Array.isArray(grade.offerings) ? grade.offerings.map((offering) => {
        const item = offering as { code?: unknown; name?: unknown; offeringType?: unknown; sections?: unknown };
        return {
          code: String(item.code ?? ""),
          name: String(item.name ?? ""),
          offeringType: String(item.offeringType ?? "") as BasicEducationSetupDraft["seniorHigh"][number]["offerings"][number]["offeringType"],
          sections: Array.isArray(item.sections) ? item.sections.map(String) : [],
        };
      }) : [],
    }));
  } catch {
    return [];
  }
}

function parseGrades(value: string): BasicEducationSetupDraft["grades"] {
  try {
    const parsed = JSON.parse(value) as Array<{ name?: unknown; sections?: unknown }>;
    return parsed.map((grade) => ({
      name: String(grade.name ?? ""),
      sections: Array.isArray(grade.sections) ? grade.sections.map(String) : [],
    }));
  } catch {
    return [];
  }
}

function parseCollegePrograms(value: string): CollegeInitialSetupDraft["programs"] {
  try {
    const parsed = JSON.parse(value) as Array<{ code?: unknown; name?: unknown; levelCount?: unknown; sections?: unknown }>;
    return parsed.map((program) => ({
      code: String(program.code ?? ""),
      name: String(program.name ?? ""),
      levelCount: Number(program.levelCount),
      sections: Array.isArray(program.sections) ? program.sections.map((section) => {
        const item = section as { levelNumber?: unknown; name?: unknown };
        return { levelNumber: Number(item.levelNumber), name: String(item.name ?? "") };
      }) : [],
    }));
  } catch {
    return [];
  }
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
