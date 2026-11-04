"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  GraduationCap,
  Info,
  Layers3,
  Plus,
  Save,
  School,
  Trash2,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  saveOnboardingStepAction,
  type OnboardingStepResult,
} from "@/app/admin/onboarding/school-setup/actions";
import type { EducationScope } from "@/lib/school/academic-offerings";
import type {
  SchoolOnboardingState,
  SeniorHighCurriculumVersion,
  SeniorHighOfferingType,
} from "@/lib/school/onboarding";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2 | 3 | 4 | 5;
type GradeDraft = { id: string; name: string; sections: string[] };
type SeniorHighOfferingDraft = { id: string; code: string; name: string; offeringType: SeniorHighOfferingType; sections: string[] };
type SeniorHighGradeDraft = { gradeName: string; curriculumVersion: SeniorHighCurriculumVersion; offerings: SeniorHighOfferingDraft[] };
type CollegeSectionDraft = { id: string; levelNumber: number; name: string };
type CollegeProgramDraft = { id: string; code: string; name: string; levelCount: number; sections: CollegeSectionDraft[] };

const steps = [
  { id: 1 as const, label: "School profile", icon: Building2 },
  { id: 2 as const, label: "School year", icon: CalendarDays },
  { id: 3 as const, label: "Basic Education", icon: Layers3 },
  { id: 4 as const, label: "College", icon: GraduationCap },
  { id: 5 as const, label: "Review", icon: CheckCircle2 },
];

const phLevelGroups = [
  { id: "kindergarten", label: "Kindergarten", detail: "Pre-school level in the Philippine K–12 system.", grades: ["Kindergarten"] },
  { id: "elementary", label: "Elementary (Grades 1–6)", detail: "Primary education level.", grades: Array.from({ length: 6 }, (_, index) => `Grade ${index + 1}`) },
  { id: "junior", label: "Junior High School (Grades 7–10)", detail: "Secondary education before Senior High School.", grades: Array.from({ length: 4 }, (_, index) => `Grade ${index + 7}`) },
  { id: "senior", label: "Senior High School (Grades 11–12)", detail: "Set the curriculum, offered tracks or legacy strands, and sections for each grade.", grades: ["Grade 11", "Grade 12"] },
] as const;

const strengthenedOfferings = [
  { code: "ACADEMIC", name: "Academic Track", offeringType: "track" as const },
  { code: "TECHPRO", name: "Technical-Professional Track", offeringType: "track" as const },
] as const;

const legacyOfferings = [
  { code: "STEM", name: "Science, Technology, Engineering, and Mathematics (STEM)", offeringType: "strand" as const },
  { code: "ABM", name: "Accountancy, Business, and Management (ABM)", offeringType: "strand" as const },
  { code: "HUMSS", name: "Humanities and Social Sciences (HUMSS)", offeringType: "strand" as const },
  { code: "GAS", name: "General Academic Strand (GAS)", offeringType: "strand" as const },
  { code: "TVL", name: "Technical-Vocational-Livelihood (TVL) Track", offeringType: "track" as const },
  { code: "SPORTS", name: "Sports Track", offeringType: "track" as const },
  { code: "ARTS-DESIGN", name: "Arts and Design Track", offeringType: "track" as const },
] as const;

const inputClass = "min-h-12 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";
const initialOnboardingStepResult: OnboardingStepResult = { status: "idle" };

export function GuidedSchoolSetupWizard({ initialState }: { initialState: SchoolOnboardingState }) {
  const router = useRouter();
  const [result, formAction, pending] = useActionState(saveOnboardingStepAction, initialOnboardingStepResult);
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialState.currentStep);
  const [completed, setCompleted] = useState<Set<WizardStep>>(() => new Set([
    ...(initialState.readiness.profile ? [1 as const] : []),
    ...(initialState.readiness.schoolYear ? [2 as const] : []),
    ...(initialState.readiness.basic && initialState.educationScope !== "higher" ? [3 as const] : []),
    ...(initialState.readiness.college && initialState.educationScope !== "basic" ? [4 as const] : []),
  ]));
  const [schoolName, setSchoolName] = useState(initialState.schoolName);
  const [schoolCode, setSchoolCode] = useState(initialState.schoolCode);
  const [codeEdited, setCodeEdited] = useState(Boolean(initialState.schoolId));
  const [educationScope, setEducationScope] = useState<EducationScope>(initialState.educationScope);
  const [yearName, setYearName] = useState(initialState.activeYear?.name ?? "");
  const [yearStartsOn, setYearStartsOn] = useState(initialState.activeYear?.startsOn ?? "");
  const [yearEndsOn, setYearEndsOn] = useState(initialState.activeYear?.endsOn ?? "");
  const [grades, setGrades] = useState<GradeDraft[]>(() => initialState.grades.map((grade, index) => ({
    id: `saved-grade-${index}`,
    name: grade.name,
    sections: grade.sections.length ? grade.sections : ["Section A"],
  })));
  const [seniorHigh, setSeniorHigh] = useState<SeniorHighGradeDraft[]>(() => {
    if (initialState.seniorHigh.length) return initialState.seniorHigh.map((grade) => ({
      gradeName: grade.gradeName,
      curriculumVersion: grade.curriculumVersion,
      offerings: grade.offerings.map((offering, offeringIndex) => ({
        id: `saved-shs-${grade.gradeName}-${offeringIndex}`,
        ...offering,
      })),
    }));
    const gradeNames = new Set(initialState.grades.map((grade) => grade.name));
    const defaults: SeniorHighGradeDraft[] = [];
    if (gradeNames.has("Grade 11")) defaults.push({ gradeName: "Grade 11", curriculumVersion: defaultSeniorHighCurriculum("Grade 11", initialState.activeYear?.startsOn), offerings: [] });
    if (gradeNames.has("Grade 12")) defaults.push({ gradeName: "Grade 12", curriculumVersion: defaultSeniorHighCurriculum("Grade 12", initialState.activeYear?.startsOn), offerings: [] });
    return defaults;
  });
  const [periodType, setPeriodType] = useState<"semester" | "trimester" | "summer" | "custom">(initialState.college.period?.type ?? "semester");
  const [periodName, setPeriodName] = useState(initialState.college.period?.name ?? "First Semester");
  const [periodStartsOn, setPeriodStartsOn] = useState(initialState.college.period?.startsOn ?? initialState.activeYear?.startsOn ?? "");
  const [periodEndsOn, setPeriodEndsOn] = useState(initialState.college.period?.endsOn ?? initialState.activeYear?.endsOn ?? "");
  const [collegePrograms, setCollegePrograms] = useState<CollegeProgramDraft[]>(() => (
    initialState.college.programs.length
      ? initialState.college.programs.map((program, programIndex) => ({
          id: `saved-college-program-${programIndex}`,
          code: program.code,
          name: program.name,
          levelCount: program.levelCount,
          sections: program.sections.length
            ? program.sections.map((section, sectionIndex) => ({ id: `saved-college-section-${programIndex}-${sectionIndex}`, levelNumber: section.levelNumber, name: section.name }))
            : [{ id: `saved-college-section-${programIndex}-1`, levelNumber: 1, name: "Section A" }],
        }))
      : [{ id: "college-program-1", code: "", name: "", levelCount: 4, sections: [{ id: "college-program-1-section-1", levelNumber: 1, name: "Section A" }] }]
  ));

  useEffect(() => {
    if (result.status !== "success" || !result.nextStep || !result.completedStep) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setCompleted((previous) => new Set(previous).add(result.completedStep!));
      setCurrentStep(result.nextStep!);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => { active = false; };
  }, [result, router]);

  const selectedGroups = useMemo(() => new Set(phLevelGroups.filter((group) => (
    group.grades.every((gradeName) => grades.some((grade) => grade.name === gradeName))
  )).map((group) => group.id)), [grades]);
  const seniorHighSections = seniorHigh.reduce((sum, grade) => sum + grade.offerings.reduce((offeringSum, offering) => offeringSum + offering.sections.filter(Boolean).length, 0), 0);
  const totalSections = grades.reduce((sum, grade) => sum + (/^Grade (11|12)$/i.test(grade.name) ? 0 : grade.sections.filter(Boolean).length), 0) + seniorHighSections;
  const standardGradeEntries = grades.map((grade, index) => ({ grade, index })).filter(({ grade }) => !/^Grade (11|12)$/i.test(grade.name));
  const scopeHasBasic = educationScope !== "higher";
  const scopeHasCollege = educationScope !== "basic";
  const progress = Math.round(((currentStep - 1) / 4) * 100);

  function updateSchoolName(value: string) {
    setSchoolName(value);
    if (!codeEdited) setSchoolCode(suggestSchoolCode(value));
  }

  function toggleGroup(groupId: (typeof phLevelGroups)[number]["id"]) {
    const group = phLevelGroups.find((item) => item.id === groupId);
    if (!group) return;
    const removing = selectedGroups.has(groupId);
    if (groupId === "senior") {
      setSeniorHigh(removing ? [] : [
        { gradeName: "Grade 11", curriculumVersion: defaultSeniorHighCurriculum("Grade 11", yearStartsOn), offerings: [] },
        { gradeName: "Grade 12", curriculumVersion: defaultSeniorHighCurriculum("Grade 12", yearStartsOn), offerings: [] },
      ]);
    }
    setGrades((current) => {
      if (removing) return current.filter((grade) => !group.grades.includes(grade.name as never));
      const existing = new Set(current.map((grade) => grade.name));
      return [...current, ...group.grades.filter((name) => !existing.has(name)).map((name) => ({ id: `${groupId}-${name}`, name, sections: groupId === "senior" ? [] : ["Section A"] }))];
    });
  }

  function setSeniorHighCurriculum(gradeName: string, curriculumVersion: SeniorHighCurriculumVersion) {
    setSeniorHigh((current) => current.map((grade) => grade.gradeName === gradeName
      ? { gradeName, curriculumVersion, offerings: [] }
      : grade));
  }

  function toggleSeniorHighOffering(gradeName: string, preset: { code: string; name: string; offeringType: SeniorHighOfferingType }) {
    setSeniorHigh((current) => current.map((grade) => {
      if (grade.gradeName !== gradeName) return grade;
      const exists = grade.offerings.some((offering) => offering.code === preset.code);
      if (exists) return { ...grade, offerings: grade.offerings.filter((offering) => offering.code !== preset.code) };
      const existingUnassignedSections = grades.find((item) => item.name === gradeName)?.sections.filter(Boolean) ?? [];
      return {
        ...grade,
        offerings: [...grade.offerings, {
          id: `${gradeName}-${preset.code}-${Date.now()}`,
          code: preset.code,
          name: preset.name,
          offeringType: preset.offeringType,
          sections: grade.offerings.length === 0 && existingUnassignedSections.length
            ? existingUnassignedSections
            : [`${preset.code} - Section A`],
        }],
      };
    }));
  }

  function updateSeniorHighSection(gradeName: string, offeringId: string, sectionIndex: number, value: string) {
    setSeniorHigh((current) => current.map((grade) => grade.gradeName === gradeName ? {
      ...grade,
      offerings: grade.offerings.map((offering) => offering.id === offeringId ? {
        ...offering,
        sections: offering.sections.map((section, index) => index === sectionIndex ? value : section),
      } : offering),
    } : grade));
  }

  function addSeniorHighSection(gradeName: string, offeringId: string) {
    setSeniorHigh((current) => current.map((grade) => grade.gradeName === gradeName ? {
      ...grade,
      offerings: grade.offerings.map((offering) => offering.id === offeringId ? { ...offering, sections: [...offering.sections, ""] } : offering),
    } : grade));
  }

  function removeSeniorHighSection(gradeName: string, offeringId: string, sectionIndex: number) {
    setSeniorHigh((current) => current.map((grade) => grade.gradeName === gradeName ? {
      ...grade,
      offerings: grade.offerings.map((offering) => offering.id === offeringId && offering.sections.length > 1 ? {
        ...offering,
        sections: offering.sections.filter((_, index) => index !== sectionIndex),
      } : offering),
    } : grade));
  }

  function updateGrade(index: number, value: string) {
    setGrades((current) => current.map((grade, gradeIndex) => gradeIndex === index ? { ...grade, name: value } : grade));
  }

  function updateSection(gradeIndex: number, sectionIndex: number, value: string) {
    setGrades((current) => current.map((grade, index) => index === gradeIndex
      ? { ...grade, sections: grade.sections.map((section, currentIndex) => currentIndex === sectionIndex ? value : section) }
      : grade));
  }

  function addSection(gradeIndex: number) {
    setGrades((current) => current.map((grade, index) => index === gradeIndex ? { ...grade, sections: [...grade.sections, ""] } : grade));
  }

  function removeSection(gradeIndex: number, sectionIndex: number) {
    setGrades((current) => current.map((grade, index) => index === gradeIndex
      ? { ...grade, sections: grade.sections.length > 1 ? grade.sections.filter((_, currentIndex) => currentIndex !== sectionIndex) : grade.sections }
      : grade));
  }

  function addCollegeProgram() {
    setCollegePrograms((current) => [...current, {
      id: `college-program-${Date.now()}`,
      code: "",
      name: "",
      levelCount: 4,
      sections: [{ id: `college-section-${Date.now()}`, levelNumber: 1, name: "Section A" }],
    }]);
  }

  function updateCollegeProgram(id: string, field: "code" | "name" | "levelCount", value: string | number) {
    setCollegePrograms((current) => current.map((program) => program.id === id ? {
      ...program,
      [field]: value,
      sections: field === "levelCount" ? program.sections.map((section) => ({ ...section, levelNumber: Math.min(section.levelNumber, Number(value)) })) : program.sections,
    } : program));
  }

  function removeCollegeProgram(id: string) {
    setCollegePrograms((current) => current.length > 1 ? current.filter((program) => program.id !== id) : current);
  }

  function addCollegeSection(programId: string) {
    setCollegePrograms((current) => current.map((program) => program.id === programId ? {
      ...program,
      sections: [...program.sections, { id: `college-section-${Date.now()}`, levelNumber: 1, name: "" }],
    } : program));
  }

  function updateCollegeSection(programId: string, sectionId: string, field: "levelNumber" | "name", value: string | number) {
    setCollegePrograms((current) => current.map((program) => program.id === programId ? {
      ...program,
      sections: program.sections.map((section) => section.id === sectionId ? { ...section, [field]: value } : section),
    } : program));
  }

  function removeCollegeSection(programId: string, sectionId: string) {
    setCollegePrograms((current) => current.map((program) => program.id === programId && program.sections.length > 1 ? {
      ...program,
      sections: program.sections.filter((section) => section.id !== sectionId),
    } : program));
  }

  function previousStep() {
    if (currentStep === 5 && !scopeHasCollege) setCurrentStep(scopeHasBasic ? 3 : 2);
    else if (currentStep === 4 && !scopeHasBasic) setCurrentStep(2);
    else if (currentStep > 1) setCurrentStep((currentStep - 1) as WizardStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function statusForStep(step: WizardStep) {
    if ((step === 3 && !scopeHasBasic) || (step === 4 && !scopeHasCollege)) return "Not required";
    if (completed.has(step) || (step === 5 && initialState.readiness.complete)) return "Complete";
    if (currentStep === step) return "In progress";
    return "Not started";
  }

  return (
    <div className="grid gap-5">
      <nav aria-label="School setup steps" className="overflow-x-auto pb-1">
        <ol className="grid min-w-[720px] grid-cols-5 gap-2">
          {steps.map((step) => {
            const status = statusForStep(step.id);
            const Icon = step.icon;
            const available = step.id <= currentStep || completed.has(step.id) || status === "Complete";
            return (
              <li key={step.id}>
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => available && setCurrentStep(step.id)}
                  aria-current={currentStep === step.id ? "step" : undefined}
                  className={cn(
                    "flex min-h-16 w-full items-center gap-2 rounded-lg border px-3 text-left text-xs font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                    currentStep === step.id ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground",
                    !available && "opacity-65",
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border", status === "Complete" ? "border-status-success-foreground/25 bg-status-success-bg text-status-success-foreground" : "border-border bg-muted text-foreground")}>
                    {status === "Complete" ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span><span className="block text-[10px] font-medium uppercase tracking-wide">Step {step.id}</span>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <form action={formAction} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <input type="hidden" name="step" value={currentStep} />
          <input type="hidden" name="grades" value={JSON.stringify(grades.map(({ name, sections }) => ({ name, sections })))} />
          <input type="hidden" name="seniorHigh" value={JSON.stringify(seniorHigh.map(({ gradeName, curriculumVersion, offerings }) => ({ gradeName, curriculumVersion, offerings: offerings.map(({ code, name, offeringType, sections }) => ({ code, name, offeringType, sections })) })))} />
          <input type="hidden" name="collegePrograms" value={JSON.stringify(collegePrograms.map(({ code, name, levelCount, sections }) => ({ code, name, levelCount, sections: sections.map(({ levelNumber, name: sectionName }) => ({ levelNumber, name: sectionName })) })))} />
          <div className="border-b border-border px-4 py-5 sm:px-6">
            <StepHeading step={currentStep} />
          </div>

          <div className="grid gap-5 p-4 sm:p-6">
            {result.status !== "idle" ? (
              <div role="status" aria-live="polite" className={cn("rounded-lg border px-4 py-3 text-sm", result.status === "error" ? "border-status-danger-foreground/20 bg-status-danger-bg text-status-danger-foreground" : "border-status-success-foreground/20 bg-status-success-bg text-status-success-foreground")}>
                <strong className="block">{result.status === "error" ? "Please check this step" : "Progress saved"}</strong>
                <span>{result.message}</span>
              </div>
            ) : null}

            {currentStep === 1 ? (
              <>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <Field label="Official school name" help="Use the name shown on official school records." required>
                    <input name="schoolName" value={schoolName} onChange={(event) => updateSchoolName(event.target.value)} className={inputClass} placeholder="Example: Mabini Integrated School" required />
                  </Field>
                  <Field label="School code" help="Suggested automatically. You may replace it with your official short code." required>
                    <input name="schoolCode" value={schoolCode} onChange={(event) => { setCodeEdited(true); setSchoolCode(event.target.value.toUpperCase()); }} className={inputClass} placeholder="MIS" maxLength={40} required />
                  </Field>
                </div>
                <fieldset className="grid gap-3">
                  <legend className="text-sm font-bold text-foreground">What does your school offer? <span className="text-destructive">*</span></legend>
                  <p className="text-sm text-muted-foreground">Choose the setup that matches your school today. You can expand later without losing records.</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <OfferingCard value="basic" selected={educationScope === "basic"} onSelect={setEducationScope} title="Basic Education only" detail="Kindergarten, Elementary, Junior High, and/or Senior High School." icon={BookOpen} />
                    <OfferingCard value="higher" selected={educationScope === "higher"} onSelect={setEducationScope} title="Higher Education only" detail="College programs organized by academic period and year level." icon={GraduationCap} />
                    <OfferingCard value="both" selected={educationScope === "both"} onSelect={setEducationScope} title="Both K–12 and College" detail="One institution offering Basic and Higher Education." icon={School} />
                  </div>
                  <input type="hidden" name="educationScope" value={educationScope} />
                </fieldset>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg p-4 text-sm text-status-info-foreground">
                  <strong>Set the school year currently accepting school activity.</strong>
                  <p className="mt-1">Use your institution’s official dates. Philippine school calendars can differ between schools.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="School year name" help="Example: 2028–2029" required>
                    <input name="yearName" value={yearName} onChange={(event) => setYearName(event.target.value)} className={inputClass} placeholder="2028–2029" required />
                  </Field>
                  <div className="hidden md:block" />
                  <Field label="Start date" required><input type="date" name="startsOn" value={yearStartsOn} onChange={(event) => setYearStartsOn(event.target.value)} className={inputClass} required /></Field>
                  <Field label="End date" help="The end date must be later than the start date." required><input type="date" name="endsOn" value={yearEndsOn} onChange={(event) => setYearEndsOn(event.target.value)} className={inputClass} required /></Field>
                </div>
                <div className="flex min-h-12 items-center gap-3 rounded-lg border border-status-success-foreground/20 bg-status-success-bg px-4 text-sm font-semibold text-status-success-foreground">
                  <CheckCircle2 className="size-5" /> This will be the active school year.
                </div>
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <div className="grid gap-3">
                  {phLevelGroups.map((group) => {
                    const checked = selectedGroups.has(group.id);
                    return (
                      <label key={group.id} className={cn("flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border p-4 transition", checked ? "border-primary bg-accent/60" : "border-border bg-card hover:bg-muted/60")}>
                        <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.id)} className="mt-1 size-5 accent-primary" />
                        <span className="min-w-0 flex-1"><strong className="block text-sm text-foreground">{group.label}</strong><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{group.detail}</span></span>
                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{group.grades.length} {group.grades.length === 1 ? "grade" : "grades"}</span>
                      </label>
                    );
                  })}
                </div>
                {standardGradeEntries.length ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <div className="grid grid-cols-[minmax(110px,180px)_1fr] gap-3 bg-muted px-3 py-2 text-xs font-bold text-muted-foreground sm:px-4"><span>Grade level</span><span>Sections for the active year</span></div>
                    <GradeRows entries={standardGradeEntries.slice(0, 3)} onGrade={updateGrade} onSection={updateSection} onAddSection={addSection} onRemoveSection={removeSection} />
                    {standardGradeEntries.length > 3 ? (
                      <details className="border-t border-border">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25">{standardGradeEntries.length - 3} more grade levels <ChevronDown className="size-4" /></summary>
                        <GradeRows entries={standardGradeEntries.slice(3)} onGrade={updateGrade} onSection={updateSection} onAddSection={addSection} onRemoveSection={removeSection} />
                      </details>
                    ) : null}
                  </div>
                ) : !selectedGroups.has("senior") ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">Select at least one Philippine education level to prepare its grades and sections.</div>
                ) : null}
                {selectedGroups.has("senior") ? (
                  <SeniorHighSetup
                    grades={seniorHigh}
                    onCurriculum={setSeniorHighCurriculum}
                    onToggleOffering={toggleSeniorHighOffering}
                    onSection={updateSeniorHighSection}
                    onAddSection={addSeniorHighSection}
                    onRemoveSection={removeSeniorHighSection}
                  />
                ) : null}
                <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg p-3 text-xs leading-5 text-status-info-foreground"><Info className="mr-2 inline size-4" />Grade labels stay in the school catalog. Sections and Senior High offerings belong to the active school year.</div>
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <NumberedSection number={1} title="Academic period">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["semester", "trimester", "summer", "custom"] as const).map((type) => (
                      <label key={type} className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-semibold capitalize", periodType === type ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground")}>
                        <input type="radio" name="periodType" value={type} checked={periodType === type} onChange={() => setPeriodType(type)} className="sr-only" />{type}
                      </label>
                    ))}
                  </div>
                  <Field label="Period name" help="Example: First Semester or Summer Term" required><input name="periodName" value={periodName} onChange={(event) => setPeriodName(event.target.value)} className={inputClass} required /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Start date" required><input type="date" name="periodStartsOn" value={periodStartsOn} onChange={(event) => setPeriodStartsOn(event.target.value)} className={inputClass} required /></Field>
                    <Field label="End date" help="Both dates must stay inside the active school year." required><input type="date" name="periodEndsOn" value={periodEndsOn} onChange={(event) => setPeriodEndsOn(event.target.value)} className={inputClass} required /></Field>
                  </div>
                  <div className="flex min-h-11 items-center gap-2 rounded-lg bg-status-success-bg px-3 text-sm font-semibold text-status-success-foreground"><Check className="size-4" />Set as the active college period</div>
                </NumberedSection>
                <NumberedSection number={2} title="Academic programs and sections">
                  <p className="text-sm leading-6 text-muted-foreground">Add every college program your school currently offers. Each program has its own year levels and sections for the active period.</p>
                  <div className="grid gap-4">
                    {collegePrograms.map((program, programIndex) => (
                      <section key={program.id} className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-4 py-3">
                          <div><h3 className="font-bold text-foreground">Program {programIndex + 1}</h3><p className="text-xs text-muted-foreground">Example: BSIT, BSA, BSHM, BEEd, or your school’s official program.</p></div>
                          <button type="button" aria-label={`Remove program ${programIndex + 1}`} onClick={() => removeCollegeProgram(program.id)} disabled={collegePrograms.length === 1} className={cn(secondaryButton, "px-3")}><Trash2 className="size-4" />Remove program</button>
                        </div>
                        <div className="grid gap-4 p-4">
                          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                            <Field label="Program code" help="Use the official abbreviation, such as BSIT." required><input aria-label={`Program ${programIndex + 1} code`} value={program.code} onChange={(event) => updateCollegeProgram(program.id, "code", event.target.value.toUpperCase())} className={inputClass} placeholder="BSIT" required /></Field>
                            <Field label="Complete program name" help="Use the name shown in official school records." required><input aria-label={`Program ${programIndex + 1} name`} value={program.name} onChange={(event) => updateCollegeProgram(program.id, "name", event.target.value)} className={inputClass} placeholder="Bachelor of Science in Information Technology" required /></Field>
                          </div>
                          <Field label="Number of year levels" help={`Year 1 through Year ${program.levelCount} will be created for this program.`} required>
                            <select aria-label={`Program ${programIndex + 1} year levels`} value={program.levelCount} onChange={(event) => updateCollegeProgram(program.id, "levelCount", Number(event.target.value))} className={inputClass}>
                              {Array.from({ length: 6 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "year" : "years"}</option>)}
                            </select>
                          </Field>
                          <div className="grid gap-3 border-t border-border pt-4">
                            <div><h4 className="text-sm font-bold text-foreground">Sections for {program.code || `Program ${programIndex + 1}`}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Add at least one section. You can assign different sections to different year levels.</p></div>
                            {program.sections.map((section, sectionIndex) => (
                              <div key={section.id} className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[minmax(170px,220px)_1fr_auto] sm:items-end">
                                <Field label={`Section ${sectionIndex + 1} year level`} required>
                                  <select aria-label={`Program ${programIndex + 1} section ${sectionIndex + 1} year level`} value={section.levelNumber} onChange={(event) => updateCollegeSection(program.id, section.id, "levelNumber", Number(event.target.value))} className={inputClass}>
                                    {Array.from({ length: program.levelCount }, (_, levelIndex) => levelIndex + 1).map((level) => <option key={level} value={level}>{program.code || "Program"} — Year {level}</option>)}
                                  </select>
                                </Field>
                                <Field label={`Section ${sectionIndex + 1} name`} required>
                                  <input aria-label={`Program ${programIndex + 1} section ${sectionIndex + 1} name`} value={section.name} onChange={(event) => updateCollegeSection(program.id, section.id, "name", event.target.value)} className={inputClass} placeholder={sectionIndex === 0 ? "Section A" : "Example: Section B"} required />
                                </Field>
                                <button type="button" aria-label={`Remove program ${programIndex + 1} section ${sectionIndex + 1}`} onClick={() => removeCollegeSection(program.id, section.id)} disabled={program.sections.length === 1} className={cn(secondaryButton, "min-h-12 px-3")}><Trash2 className="size-4" /><span className="sm:sr-only">Remove section</span></button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addCollegeSection(program.id)} disabled={program.sections.length >= 30} className={cn(secondaryButton, "justify-self-start")}><Plus className="size-4" />Add section to {program.code || `Program ${programIndex + 1}`}</button>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                  <button type="button" onClick={addCollegeProgram} disabled={collegePrograms.length >= 30} className={cn(primaryButton, "justify-self-start")}><Plus className="size-4" />Add another program</button>
                </NumberedSection>
                <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg p-3 text-sm text-status-info-foreground"><Info className="mr-2 inline size-4" />Student enrollment happens after setup; no student records are created here.</div>
              </>
            ) : null}

            {currentStep === 5 ? (
              <div className="grid gap-4">
                <ReviewCard title="School profile" onEdit={() => setCurrentStep(1)} rows={[["School", schoolName], ["Code", schoolCode], ["Offering", scopeLabel(educationScope)]]} />
                <ReviewCard title="Active school year" onEdit={() => setCurrentStep(2)} rows={[["School year", yearName || "Incomplete"], ["Dates", yearStartsOn && yearEndsOn ? `${yearStartsOn} to ${yearEndsOn}` : "Incomplete"]]} />
                {scopeHasBasic ? <ReviewCard title="Basic Education" onEdit={() => setCurrentStep(3)} rows={[["Grade levels", String(grades.length)], ["Sections", String(totalSections)], ["Selected levels", [...selectedGroups].map((id) => phLevelGroups.find((group) => group.id === id)?.label).filter(Boolean).join(", ") || "Incomplete"], ["Senior High offerings", seniorHigh.length ? seniorHigh.map((grade) => `${grade.gradeName}: ${grade.offerings.map((offering) => offering.code).join(", ") || "Incomplete"}`).join(" · ") : "Not selected"]]} /> : <SkippedCard title="Basic Education" />}
                {scopeHasCollege ? <ReviewCard title="Higher Education" onEdit={() => setCurrentStep(4)} rows={[["Period", periodName || "Incomplete"], ["Programs", collegePrograms.filter((program) => program.code.trim() && program.name.trim()).map((program) => `${program.code} — ${program.name}`).join(", ") || "Incomplete"], ["Program count", String(collegePrograms.length)], ["Sections", String(collegePrograms.reduce((total, program) => total + program.sections.filter((section) => section.name.trim()).length, 0))]]} /> : <SkippedCard title="Higher Education" />}
                <div className="rounded-lg border border-status-success-foreground/20 bg-status-success-bg p-4 text-sm text-status-success-foreground"><strong>Ready to finish?</strong><p className="mt-1">After confirmation, you can add students, additional structures, and tuition packages from the administrator dashboard.</p></div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/40 px-4 py-4 min-[520px]:flex-row min-[520px]:items-center sm:px-6">
            {currentStep > 1 ? <button type="button" onClick={previousStep} className={secondaryButton}><ArrowLeft className="size-4" />Back</button> : null}
            {currentStep < 5 ? <button type="submit" name="submitMode" value="exit" disabled={pending} className={secondaryButton}><Save className="size-4" />Save and exit</button> : null}
            <button type="submit" disabled={pending} className={cn(primaryButton, "min-[520px]:ml-auto")}>
              {pending ? "Saving…" : currentStep === 5 ? "Finish school setup" : nextActionLabel(currentStep, educationScope)}
              {currentStep === 5 ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}
            </button>
          </div>
        </form>

        <aside className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-5 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Setup progress</h2>
            <p className="mt-1 text-sm text-muted-foreground">Step {currentStep} of 5: {steps[currentStep - 1].label}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Setup readiness</h3>
            <div className="mt-2 divide-y divide-border rounded-lg border border-border">
              {steps.slice(0, 4).map((step) => <ReadinessRow key={step.id} label={step.label} status={statusForStep(step.id)} />)}
            </div>
          </div>
          <div className="rounded-lg border border-primary/20 bg-accent p-4 text-sm text-accent-foreground">
            <strong className="block">{scopeLabel(educationScope)}</strong>
            <p className="mt-1 text-xs leading-5">{scopeHasBasic ? `${grades.length} grade levels · ${totalSections} sections` : "Basic Education not required"}</p>
            <p className="text-xs leading-5">{scopeHasCollege ? `${collegePrograms.length} ${collegePrograms.length === 1 ? "program" : "programs"} · ${collegePrograms.reduce((total, program) => total + program.sections.length, 0)} sections · ${periodName || "period pending"}` : "College not required"}</p>
          </div>
          <div className="flex gap-2 rounded-lg bg-status-info-bg p-3 text-xs leading-5 text-status-info-foreground"><Info className="mt-0.5 size-4 shrink-0" />Your progress is saved after every Continue action. You may safely sign out and resume later.</div>
        </aside>
      </div>
    </div>
  );
}

function StepHeading({ step }: { step: WizardStep }) {
  const content = {
    1: ["Set up your school profile", "Tell us what your institution is called and which academic levels it offers."],
    2: ["Add the active school year", "This year owns the sections, enrollments, tuition packages, and active college period."],
    3: ["Set up Basic Education", "Select only the Philippine education levels your school actually offers."],
    4: ["Set up Higher Education", "Add the minimum college structure needed for enrollment and tuition packages."],
    5: ["Review and finish", "Confirm the setup before opening the administrator dashboard."],
  }[step];
  return <><h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{content[0]}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{content[1]}</p></>;
}

function Field({ label, help, required, children }: { label: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="text-sm font-semibold text-foreground">{label}{required ? <span className="ml-1 text-destructive">*</span> : null}</span>{children}{help ? <span className="text-xs leading-5 text-muted-foreground">{help}</span> : null}</label>;
}

function OfferingCard({ value, selected, onSelect, title, detail, icon: Icon }: { value: EducationScope; selected: boolean; onSelect: (value: EducationScope) => void; title: string; detail: string; icon: typeof School }) {
  return <label className={cn("relative flex min-h-36 cursor-pointer flex-col rounded-xl border p-4 transition focus-within:ring-3 focus-within:ring-primary/25", selected ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/60")}><input type="radio" checked={selected} onChange={() => onSelect(value)} className="sr-only" /><span className={cn("mb-3 grid size-10 place-items-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}><Icon className="size-5" /></span><strong className="text-sm text-foreground">{title}</strong><span className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</span><span className="absolute right-3 top-3">{selected ? <CheckCircle2 className="size-5 text-primary" /> : <Circle className="size-5 text-muted-foreground" />}</span></label>;
}

function GradeRows({ entries, onGrade, onSection, onAddSection, onRemoveSection }: { entries: Array<{ grade: GradeDraft; index: number }>; onGrade: (index: number, value: string) => void; onSection: (grade: number, section: number, value: string) => void; onAddSection: (grade: number) => void; onRemoveSection: (grade: number, section: number) => void }) {
  return <div className="divide-y divide-border">{entries.map(({ grade, index: gradeIndex }) => <div key={grade.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(110px,180px)_1fr] sm:px-4"><input aria-label={`Grade level ${gradeIndex + 1}`} value={grade.name} onChange={(event) => onGrade(gradeIndex, event.target.value)} className={cn(inputClass, "min-h-11")} /> <div className="grid gap-2">{grade.sections.map((section, sectionIndex) => <div key={`${grade.id}-${sectionIndex}`} className="flex min-w-0 gap-2"><input aria-label={`${grade.name} section ${sectionIndex + 1}`} value={section} onChange={(event) => onSection(gradeIndex, sectionIndex, event.target.value)} className={cn(inputClass, "min-h-11 min-w-0 flex-1")} /><button type="button" aria-label={`Remove ${grade.name} section ${sectionIndex + 1}`} disabled={grade.sections.length === 1} onClick={() => onRemoveSection(gradeIndex, sectionIndex)} className={cn(secondaryButton, "size-11 shrink-0 px-0")}><Trash2 className="size-4" /></button></div>)}<button type="button" onClick={() => onAddSection(gradeIndex)} className="inline-flex min-h-11 items-center gap-2 justify-self-start px-1 text-xs font-semibold text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"><Plus className="size-4" />Add section</button></div></div>)}</div>;
}

function SeniorHighSetup({ grades, onCurriculum, onToggleOffering, onSection, onAddSection, onRemoveSection }: {
  grades: SeniorHighGradeDraft[];
  onCurriculum: (gradeName: string, curriculum: SeniorHighCurriculumVersion) => void;
  onToggleOffering: (gradeName: string, preset: { code: string; name: string; offeringType: SeniorHighOfferingType }) => void;
  onSection: (gradeName: string, offeringId: string, sectionIndex: number, value: string) => void;
  onAddSection: (gradeName: string, offeringId: string) => void;
  onRemoveSection: (gradeName: string, offeringId: string, sectionIndex: number) => void;
}) {
  return <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
    <div>
      <h2 className="text-base font-bold text-foreground">Senior High School curriculum and offerings</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">Configure Grade 11 and Grade 12 separately. During the current transition, they may use different curricula.</p>
    </div>
    <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg p-3 text-sm leading-6 text-status-info-foreground">
      <strong>For SY 2026–2027:</strong> incoming Grade 11 uses the Strengthened SHS Curriculum. Grade 12 generally remains under the legacy curriculum, except participating pilot schools. Strengthened SHS uses tracks—not fixed strands.
    </div>
    {grades.map((grade) => {
      const presets = grade.curriculumVersion === "strengthened" ? strengthenedOfferings : legacyOfferings;
      return <section key={grade.gradeName} className="overflow-hidden rounded-lg border border-border">
        <div className="grid gap-3 border-b border-border bg-muted/50 p-4 md:grid-cols-[1fr_minmax(230px,320px)] md:items-end">
          <div><h3 className="font-bold text-foreground">{grade.gradeName}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the curriculum actually used by this grade for the active school year.</p></div>
          <Field label={`Curriculum for ${grade.gradeName}`} required>
            <select aria-label={`Curriculum for ${grade.gradeName}`} value={grade.curriculumVersion} onChange={(event) => onCurriculum(grade.gradeName, event.target.value as SeniorHighCurriculumVersion)} className={inputClass}>
              <option value="strengthened">Strengthened SHS Curriculum</option>
              <option value="legacy">Legacy SHS Curriculum</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 p-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-bold text-foreground">What does your school offer for {grade.gradeName}? <span className="text-destructive">*</span></legend>
            <p className="text-xs leading-5 text-muted-foreground">Select only the tracks or legacy strands your school can actually deliver.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {presets.map((preset) => {
                const checked = grade.offerings.some((offering) => offering.code === preset.code);
                return <label key={preset.code} className={cn("flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5", checked ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/60")}>
                  <input type="checkbox" checked={checked} onChange={() => onToggleOffering(grade.gradeName, preset)} className="mt-0.5 size-5 accent-primary" />
                  <span className="min-w-0"><strong className="block text-sm text-foreground">{preset.code}</strong><span className="block text-xs leading-5 text-muted-foreground">{preset.name}</span></span>
                </label>;
              })}
            </div>
          </fieldset>
          {grade.offerings.length ? <div className="grid gap-3 border-t border-border pt-4">
            <h4 className="text-sm font-bold text-foreground">Sections by Senior High offering</h4>
            {grade.offerings.map((offering) => <div key={offering.id} className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div><strong className="text-sm text-foreground">{offering.code}</strong><span className="ml-2 text-xs text-muted-foreground">{offering.name}</span></div>
              {offering.sections.map((section, sectionIndex) => <div key={`${offering.id}-${sectionIndex}`} className="flex min-w-0 gap-2">
                <input aria-label={`${grade.gradeName} ${offering.code} section ${sectionIndex + 1}`} value={section} onChange={(event) => onSection(grade.gradeName, offering.id, sectionIndex, event.target.value)} className={cn(inputClass, "min-w-0 flex-1")} placeholder="Example: Section A" />
                <button type="button" aria-label={`Remove ${offering.code} section ${sectionIndex + 1}`} disabled={offering.sections.length === 1} onClick={() => onRemoveSection(grade.gradeName, offering.id, sectionIndex)} className={cn(secondaryButton, "size-12 shrink-0 px-0")}><Trash2 className="size-4" /></button>
              </div>)}
              <button type="button" onClick={() => onAddSection(grade.gradeName, offering.id)} className="inline-flex min-h-11 items-center gap-2 justify-self-start px-1 text-xs font-semibold text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"><Plus className="size-4" />Add section to {offering.code}</button>
            </div>)}
          </div> : <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-5 text-center text-sm text-muted-foreground">Select at least one offered {grade.curriculumVersion === "strengthened" ? "track" : "strand"} for {grade.gradeName}.</div>}
        </div>
      </section>;
    })}
  </section>;
}

function NumberedSection({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-border"><div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3"><span className="grid size-7 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{number}</span><h2 className="font-bold text-foreground">{title}</h2></div><div className="grid gap-4 p-4">{children}</div></section>;
}

function ReviewCard({ title, rows, onEdit }: { title: string; rows: string[][]; onEdit: () => void }) {
  return <section className="rounded-lg border border-border"><div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="font-bold text-foreground">{title}</h2><button type="button" onClick={onEdit} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25">Edit</button></div><dl className="grid gap-2 p-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium text-foreground">{value}</dd></div>)}</dl></section>;
}

function SkippedCard({ title }: { title: string }) {
  return <section className="flex min-h-16 items-center justify-between rounded-lg border border-border bg-muted px-4"><strong className="text-sm text-foreground">{title}</strong><span className="rounded-full bg-status-inactive-bg px-3 py-1 text-xs font-semibold text-status-inactive-foreground">Not required</span></section>;
}

function ReadinessRow({ label, status }: { label: string; status: string }) {
  const complete = status === "Complete";
  return <div className="flex min-h-11 items-center justify-between gap-2 px-3 text-xs"><span className="font-semibold text-foreground">{label}</span><span className={cn("rounded-full px-2 py-1 font-semibold", complete ? "bg-status-success-bg text-status-success-foreground" : status === "In progress" ? "bg-status-warning-bg text-status-warning-foreground" : "bg-status-inactive-bg text-status-inactive-foreground")}>{status}</span></div>;
}

function scopeLabel(scope: EducationScope) {
  return scope === "basic" ? "Basic Education only (K–12)" : scope === "higher" ? "Higher Education only (College)" : "Both K–12 and College";
}

function nextActionLabel(step: WizardStep, scope: EducationScope) {
  if (step === 1) return "Continue to School Year";
  if (step === 2) return scope === "higher" ? "Continue to College" : "Continue to Basic Education";
  if (step === 3) return scope === "both" ? "Continue to College" : "Continue to Review";
  return "Continue to Review";
}

function suggestSchoolCode(schoolName: string) {
  return schoolName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 12) || "SCHOOL";
}

function defaultSeniorHighCurriculum(gradeName: "Grade 11" | "Grade 12", schoolYearStartsOn?: string): SeniorHighCurriculumVersion {
  const startYear = Number(schoolYearStartsOn?.slice(0, 4));
  if (!Number.isInteger(startYear)) return gradeName === "Grade 11" ? "strengthened" : "legacy";
  if (gradeName === "Grade 11") return startYear >= 2026 ? "strengthened" : "legacy";
  return startYear >= 2027 ? "strengthened" : "legacy";
}
