"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CalendarRange, CheckCircle2, ChevronRight, Info, PhilippinePeso, Plus, Search, X } from "lucide-react";

import { assessmentWizardAction, tuitionSetupAction } from "./actions";
import type { AcademicAudience, AssessmentActionState, AssessmentWorkspace } from "@/lib/fees/assessment-workflow";
import {
  MAX_INSTALLMENT_TERMS,
  buildInstallmentPreset,
  validateFinalDeadline,
  validateInstallmentPlan,
  type BillingWindow,
  type InstallmentPreset,
  type InstallmentValidationError,
} from "@/lib/fees/installment-plan-rules";

const initialState: AssessmentActionState = { status: "idle" };
const field = "min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/20";
const button = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e64a19] px-4 text-sm font-semibold text-white transition hover:bg-[#c93e13] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/30";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25";

const assistancePresets = {
  deped: { code: "DEPED-SHS-VOUCHER", name: "DepEd Senior High School Voucher", sourceKind: "government", requiresReference: true },
  esc: { code: "ESC-SUBSIDY", name: "Educational Service Contracting Subsidy", sourceKind: "government", requiresReference: true },
  scholarship: { code: "SCHOOL-SCHOLARSHIP", name: "School Scholarship", sourceKind: "school", requiresReference: true },
  discount: { code: "SCHOOL-DISCOUNT", name: "School-Approved Discount", sourceKind: "school", requiresReference: false },
  adjustment: { code: "MANUAL-ADJUSTMENT", name: "Authorized Manual Adjustment", sourceKind: "manual", requiresReference: true },
} as const;

type AssistancePreset = keyof typeof assistancePresets;

function Result({ state }: { state: AssessmentActionState }) {
  if (state.status === "idle") return null;
  const style = state.status === "error"
    ? "border-status-danger-foreground/20 bg-status-danger-bg text-status-danger-foreground"
    : state.status === "preview"
      ? "border-status-info-foreground/20 bg-status-info-bg text-status-info-foreground"
      : "border-status-success-foreground/20 bg-status-success-bg text-status-success-foreground";
  return <div role={state.status === "error" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm ${style}`}><strong>{state.title}</strong>{state.message ? <p className="mt-1 leading-5">{state.message}</p> : null}</div>;
}

function Help({ children }: { children: ReactNode }) { return <span className="block text-xs font-normal leading-5 text-muted-foreground">{children}</span>; }
function Required() { return <span className="text-xs font-normal text-destructive">Required</span>; }
function Optional() { return <span className="text-xs font-normal text-muted-foreground">Optional</span>; }

function FieldLabel({ title, required, help, children }: { title: string; required?: boolean; help: ReactNode; children: ReactNode }) {
  return <label className="grid content-start gap-1.5 text-sm font-semibold text-foreground"><span className="flex items-center justify-between gap-3">{title}{required ? <Required /> : <Optional />}</span>{children}<Help>{help}</Help></label>;
}

function Guide({ children }: { children: ReactNode }) { return <div className="flex gap-3 rounded-xl border border-status-info-foreground/20 bg-status-info-bg p-4 text-sm leading-6 text-status-info-foreground"><Info className="mt-0.5 size-4 shrink-0" /><div>{children}</div></div>; }

function SectionHeading({ number, title, description }: { number?: number; title: string; description: string }) {
  return <div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">{number ?? <ChevronRight className="size-4" />}</span><div><h2 className="font-semibold text-foreground">{title}</h2><p className="mt-0.5 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p></div></div>;
}

type EditablePlanTerm = { id: string; name: string; percentage: string; date: string };

const installmentChoices: Array<{ value: InstallmentPreset; title: string; description: string }> = [
  { value: "full", title: "Full payment", description: "One final deadline. No installment schedule." },
  { value: "two", title: "2 payments", description: "Two equal payments of 50%." },
  { value: "four", title: "4 payments", description: "Four equal payments of 25%." },
  { value: "monthly", title: "Monthly", description: "Choose 2 to 12 equal monthly payments." },
  { value: "custom", title: "Custom", description: "Create your own payment names and percentages." },
];

function formatBillingDate(value: string) {
  if (!value) return "Not selected";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function newEditableTerms(preset: Exclude<InstallmentPreset, "full">, monthlyCount = 10, current: EditablePlanTerm[] = []) {
  const generated = buildInstallmentPreset(preset, monthlyCount);
  return {
    planName: generated.planName,
    terms: generated.terms.map((term, index) => ({
      id: current[index]?.id ?? crypto.randomUUID(),
      name: term.name,
      percentage: String(term.percentage),
      date: current[index]?.date ?? "",
    })),
  };
}

function InstallmentPlanBuilder({
  preset,
  planName,
  terms,
  monthlyCount,
  bounds,
  finalDeadline,
  validationError,
  onPresetChange,
  onPlanNameChange,
  onTermsChange,
  onMonthlyCountChange,
}: {
  preset: InstallmentPreset;
  planName: string;
  terms: EditablePlanTerm[];
  monthlyCount: number;
  bounds: BillingWindow | null;
  finalDeadline: string;
  validationError: InstallmentValidationError | null;
  onPresetChange: (preset: InstallmentPreset) => void;
  onPlanNameChange: (value: string) => void;
  onTermsChange: (terms: EditablePlanTerm[]) => void;
  onMonthlyCountChange: (count: number) => void;
}) {
  const percentageTotal = Math.round(terms.reduce((sum, term) => sum + (Number(term.percentage) || 0), 0) * 100) / 100;
  const datedTerms = terms.filter((term) => term.date).map((term) => term.date).sort();
  const planEnabled = preset !== "full";
  const updateTerm = (id: string, values: Partial<EditablePlanTerm>) => onTermsChange(terms.map((term) => term.id === id ? { ...term, ...values } : term));
  const addCustomTerm = () => {
    if (terms.length >= MAX_INSTALLMENT_TERMS) return;
    onTermsChange([...terms, { id: crypto.randomUUID(), name: `Payment ${terms.length + 1}`, percentage: "", date: "" }]);
  };

  return <fieldset data-field="installmentPlan" tabIndex={-1} className="space-y-4 rounded-xl border border-border p-4 outline-none sm:p-5">
    <legend className="px-1 text-sm font-semibold text-foreground">4. How may families pay? <Optional /></legend>
    <Help>Choose full payment or start with a guided installment plan. You can edit generated names and percentages before saving.</Help>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {installmentChoices.map(choice => <label key={choice.value} className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-3 transition focus-within:ring-3 focus-within:ring-primary/25 ${preset === choice.value ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/60"}`}>
        <input type="radio" name="installmentPreset" value={choice.value} checked={preset === choice.value} onChange={() => onPresetChange(choice.value)} className="mt-1 size-4 accent-primary" />
        <span><strong className="block text-sm text-foreground">{choice.title}</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">{choice.description}</span></span>
      </label>)}
    </div>

    {!planEnabled ? <div className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg p-3 text-sm text-status-info-foreground"><strong>Full payment selected.</strong> Tuition and any required fee will use the final payment deadline.</div> : <div className="space-y-4 rounded-xl border border-border bg-muted/25 p-3 sm:p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <FieldLabel title="Installment plan name" required help="Shown to administrators and families on the Statement of Account."><input required name="planName" value={planName} onChange={event => onPlanNameChange(event.target.value)} className={field} aria-invalid={validationError?.field === "planName" || undefined} /></FieldLabel>
        {preset === "monthly" ? <FieldLabel title="Number of monthly payments" required help="Choose between 2 and 12 payments."><select value={monthlyCount} onChange={event => onMonthlyCountChange(Number(event.target.value))} className={field}>{Array.from({ length: 11 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count} payments</option>)}</select></FieldLabel> : <div className="rounded-xl border border-border bg-card p-3"><span className="text-xs text-muted-foreground">Payment count</span><strong className="mt-1 block text-lg text-foreground">{terms.length}</strong></div>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Installment plan summary">
        <div className="rounded-lg bg-card p-3"><span className="text-xs text-muted-foreground">Payments</span><strong className="mt-1 block text-foreground">{terms.length}</strong></div>
        <div className="rounded-lg bg-card p-3"><span className="text-xs text-muted-foreground">Percentage total</span><strong className={`mt-1 block ${percentageTotal === 100 ? "text-status-success-foreground" : "text-status-danger-foreground"}`}>{percentageTotal.toLocaleString("en-PH", { maximumFractionDigits: 2 })}%</strong></div>
        <div className="rounded-lg bg-card p-3"><span className="text-xs text-muted-foreground">First due date</span><strong className="mt-1 block text-foreground">{formatBillingDate(datedTerms[0] ?? "")}</strong></div>
        <div className="rounded-lg bg-card p-3"><span className="text-xs text-muted-foreground">Last due date</span><strong className="mt-1 block text-foreground">{formatBillingDate(datedTerms.at(-1) ?? "")}</strong></div>
      </div>

      <div className="space-y-3">
        {terms.map((term, index) => <div key={term.id} className="grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1.25fr_0.65fr_1fr_auto] md:items-start">
          <FieldLabel title={`Payment ${index + 1} name`} required help="Use a label families will recognize."><input required name="termNames" value={term.name} onChange={event => updateTerm(term.id, { name: event.target.value })} className={field} aria-invalid={validationError?.field === "termNames" || undefined} /></FieldLabel>
          <FieldLabel title="Percent" required help="All payments must total 100%."><input required name="termPercentages" type="number" min="0.01" max="100" step="0.01" value={term.percentage} onChange={event => updateTerm(term.id, { percentage: event.target.value })} className={field} aria-invalid={validationError?.field === "termPercentages" || undefined} /></FieldLabel>
          <FieldLabel title="Due date" required help={finalDeadline ? `On or before ${formatBillingDate(finalDeadline)}.` : "Choose the final payment deadline first."}><input required name="termDates" type="date" min={bounds?.startsOn} max={finalDeadline || bounds?.endsOn} value={term.date} onChange={event => updateTerm(term.id, { date: event.target.value })} disabled={!bounds || !finalDeadline} className={field} aria-invalid={validationError?.field === "termDates" || undefined} /></FieldLabel>
          {preset === "custom" ? <button type="button" onClick={() => onTermsChange(terms.filter(item => item.id !== term.id))} disabled={terms.length <= 2} aria-label={`Remove payment ${index + 1}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-3 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 md:mt-[26px]"><X className="size-4" /></button> : <span className="hidden md:block" />}
        </div>)}
      </div>
      {preset === "custom" ? <button type="button" onClick={addCustomTerm} disabled={terms.length >= MAX_INSTALLMENT_TERMS} className={secondaryButton}><Plus className="mr-2 size-4" />Add payment</button> : null}
      {validationError ? <p role="alert" className="rounded-lg border border-status-danger-foreground/20 bg-status-danger-bg p-3 text-sm font-medium text-status-danger-foreground">{validationError.message}</p> : <p role="status" className="rounded-lg border border-status-success-foreground/20 bg-status-success-bg p-3 text-sm font-medium text-status-success-foreground">Installment plan is complete and totals 100%.</p>}
    </div>}
  </fieldset>;
}

export function AssessmentWizard({ workspace }: { workspace: AssessmentWorkspace }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(assessmentWizardAction, initialState);
  const completedBatchRef = useRef<string | null>(null);
  const [scheduleId, setScheduleId] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [creditTypeId, setCreditTypeId] = useState("");
  const [creditAmount, setCreditAmount] = useState("0");
  const [creditReference, setCreditReference] = useState("");
  const [dirtyAfterPreview, setDirtyAfterPreview] = useState(false);
  const selectedSchedule = useMemo(() => workspace.schedules.find(item => String(item.id) === scheduleId), [scheduleId, workspace.schedules]);
  const matchingStudents = useMemo(() => selectedSchedule ? workspace.students.filter(student => student.audience === selectedSchedule.audience
    && selectedSchedule.targetIds.includes(student.targetId)
    && (selectedSchedule.audience === "basic" || student.periodId === selectedSchedule.periodId)) : [], [selectedSchedule, workspace.students]);
  const availableStudents = useMemo(() => matchingStudents.filter(student => !student.assessedScheduleIds.includes(selectedSchedule?.id ?? 0)), [matchingStudents, selectedSchedule]);
  const alreadyAssessedStudents = useMemo(() => matchingStudents.filter(student => student.assessedScheduleIds.includes(selectedSchedule?.id ?? 0)), [matchingStudents, selectedSchedule]);
  const groupOptions = useMemo(() => [...new Set(availableStudents.map(student => student.groupLabel))].sort((a, b) => a.localeCompare(b)), [availableStudents]);
  const visibleStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-PH");
    return availableStudents.filter(student => (!group || student.groupLabel === group)
      && (!query || `${student.name} ${student.reference} ${student.meta}`.toLocaleLowerCase("en-PH").includes(query)));
  }, [availableStudents, group, search]);
  const groupedStudents = useMemo(() => {
    const groups = new Map<string, typeof visibleStudents>();
    for (const student of visibleStudents) groups.set(student.groupLabel, [...(groups.get(student.groupLabel) ?? []), student]);
    return [...groups.entries()];
  }, [visibleStudents]);
  const allVisibleSelected = visibleStudents.length > 0 && visibleStudents.every(student => selectedIds.includes(student.id));
  const approvedBasic = workspace.schedules.filter(item => item.status === "approved" && item.audience === "basic");
  const approvedHigher = workspace.schedules.filter(item => item.status === "approved" && item.audience === "higher");
  const activePreview = state.preview && !dirtyAfterPreview ? state.preview : null;
  const markAssessmentChanged = () => { if (state.preview) setDirtyAfterPreview(true); };
  const toggleStudent = (id: number) => { markAssessmentChanged(); setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id].slice(0, 500)); };
  const selectVisible = () => {
    markAssessmentChanged();
    setSelectedIds(current => allVisibleSelected ? current.filter(id => !visibleStudents.some(student => student.id === id)) : [...new Set([...current, ...visibleStudents.map(student => student.id)])].slice(0, 500));
  };
  const resetFinancialAssistance = () => {
    setCreditTypeId("");
    setCreditAmount("0");
    setCreditReference("");
  };
  const submitAssessment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const intent = activePreview ? "post" : "preview";
    formData.set("intent", intent);
    if (intent === "preview") setDirtyAfterPreview(false);
    startTransition(() => action(formData));
  };

  useEffect(() => {
    if (state.status !== "success" || !state.batchReference || completedBatchRef.current === state.batchReference) return;
    completedBatchRef.current = state.batchReference;
    setSelectedIds([]);
    resetFinancialAssistance();
    setDirtyAfterPreview(false);
    router.refresh();
  }, [router, state.batchReference, state.status]);

  return <form onSubmit={submitAssessment} className="space-y-6">
    <input type="hidden" name="paymentPlanId" value={selectedSchedule?.paymentPlanId ?? ""} />
    {state.status !== "preview" || activePreview ? <Result state={state} /> : <div role="status" className="rounded-xl border border-status-warning-foreground/25 bg-status-warning-bg p-4 text-sm text-status-warning-foreground"><strong>Review needs to be refreshed</strong><p className="mt-1 leading-5">The package, students, or assistance changed. Preview the assessment again before posting.</p></div>}
    <Guide><strong>How this works:</strong> choose an approved tuition package, select the students, add a voucher or discount only when applicable, then preview. Nothing is charged until you press the final <strong>Post assessments</strong> button.</Guide>

    <section className="space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <SectionHeading number={1} title="Choose the approved tuition package" description="This determines the tuition, mandatory fees, due dates, and payment plan that will be assigned." />
      <FieldLabel title="Tuition package" required help="Packages are grouped by K–12 and College so you can choose the correct student population."><select name="scheduleId" required value={scheduleId} onChange={event => { markAssessmentChanged(); setScheduleId(event.target.value); setSelectedIds([]); setSearch(""); setGroup(""); resetFinancialAssistance(); }} className={field}><option value="">Select an approved package…</option>{approvedBasic.length ? <optgroup label="K–12 packages">{approvedBasic.map(item => <option key={item.id} value={item.id}>{item.name} · {item.period} · {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(item.grossAmount)}</option>)}</optgroup> : null}{approvedHigher.length ? <optgroup label="College packages">{approvedHigher.map(item => <option key={item.id} value={item.id}>{item.name} · {item.period} · {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(item.grossAmount)}</option>)}</optgroup> : null}</select></FieldLabel>
      {!workspace.schedules.some(item => item.status === "approved") ? <p className="rounded-lg bg-status-warning-bg p-3 text-sm text-status-warning-foreground">No approved package yet. Create and approve one in <Link href="/admin/tuition/schedules" className="font-semibold underline">Tuition packages &amp; setup</Link>.</p> : null}
      {selectedSchedule ? <dl className="grid gap-3 rounded-xl border border-border bg-muted/50 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Selected package summary"><div><dt className="text-xs text-muted-foreground">Covered students</dt><dd className="mt-1 font-semibold">{selectedSchedule.targetLabels.join(", ") || "No package targets"}</dd></div><div><dt className="text-xs text-muted-foreground">Covered period</dt><dd className="mt-1 font-semibold">{selectedSchedule.period}</dd></div><div><dt className="text-xs text-muted-foreground">Charge per student</dt><dd className="mt-1 font-semibold">{new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(selectedSchedule.grossAmount)} · {selectedSchedule.itemCount} item{selectedSchedule.itemCount === 1 ? "" : "s"}</dd></div><div><dt className="text-xs text-muted-foreground">Payment and roster</dt><dd className="mt-1 font-semibold">{selectedSchedule.paymentPlanId ? "Installment plan" : "No installment plan"} · {matchingStudents.length} matching</dd></div></dl> : null}
    </section>

    <section className="space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><SectionHeading number={2} title="Select students to assess" description="Only students enrolled in the selected package’s exact grade or college program, year, and period are available." /><div className="grid grid-cols-3 gap-2 text-center text-xs"><span className="rounded-lg bg-muted px-3 py-2"><strong className="block text-base text-foreground">{availableStudents.length}</strong><span className="text-muted-foreground">Eligible</span></span><span className="rounded-lg bg-primary/10 px-3 py-2"><strong className="block text-base text-primary">{selectedIds.length}</strong><span className="text-muted-foreground">Selected</span></span><span className="rounded-lg bg-muted px-3 py-2"><strong className="block text-base text-foreground">{alreadyAssessedStudents.length}</strong><span className="text-muted-foreground">Assessed</span></span></div></div>
      {!scheduleId ? <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Choose a tuition package first. The matching students will appear here and will remain unchecked until you select them.</p> : matchingStudents.length === 0 ? <p className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground"><strong className="block text-foreground">No matching students found</strong><span className="mt-1 block">Check that students are enrolled in {selectedSchedule?.targetLabels.join(", ") || "the package target"}{selectedSchedule?.audience === "higher" ? ` during ${selectedSchedule.period}` : ` for ${workspace.schoolYearName ?? "the active school year"}`}.</span></p> : <fieldset><legend className="sr-only">Students to assess</legend>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)_auto] lg:items-end"><label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>Search students</span><span className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or student reference" className={`${field} pl-9`} /></span></label><label className="grid gap-1.5 text-sm font-semibold text-foreground"><span>Grade, program, or section</span><select value={group} onChange={event => setGroup(event.target.value)} className={field}><option value="">All eligible groups</option>{groupOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label><div className="flex flex-col gap-2 min-[420px]:flex-row lg:justify-end"><button type="button" className={secondaryButton} disabled={!visibleStudents.length} onClick={selectVisible}>{allVisibleSelected ? "Unselect visible" : "Select all visible"}</button>{selectedIds.length ? <button type="button" className={secondaryButton} onClick={() => { markAssessmentChanged(); setSelectedIds([]); }}>Clear selection</button> : null}</div></div>
        <p className="mt-3 text-xs text-muted-foreground">Showing {visibleStudents.length} of {availableStudents.length} eligible students. Maximum 500 students per batch.</p>
        {visibleStudents.length ? <div className="mt-3 max-h-[34rem] space-y-4 overflow-auto rounded-xl border border-border p-3">{groupedStudents.map(([label, students]) => <section key={label} aria-label={label}><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-foreground">{label}</h3><span className="text-xs text-muted-foreground">{students.length} student{students.length === 1 ? "" : "s"}</span></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{students.map(student => <label key={`${student.audience}-${student.periodId ?? 0}-${student.id}`} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition focus-within:ring-3 focus-within:ring-[#e64a19]/25 ${selectedIds.includes(student.id) ? "border-[#e64a19] bg-primary/10" : "border-border bg-background hover:bg-muted/60"}`}><input type="checkbox" name="studentIds" value={student.id} checked={selectedIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className="mt-0.5 size-4 accent-[#e64a19]" /><span className="min-w-0"><strong className="block truncate text-foreground">{student.name}</strong><span className="block text-xs leading-5 text-muted-foreground">{student.reference}</span></span></label>)}</div></section>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">No students match the current search or group filter. Clear the filters to see all eligible students.</p>}
        {alreadyAssessedStudents.length ? <details className="mt-4 rounded-xl border border-border bg-muted/40"><summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25">Already assessed ({alreadyAssessedStudents.length})</summary><div className="border-t border-border px-4 py-3"><p className="mb-3 text-xs text-muted-foreground">These students already received this exact tuition package and cannot be selected again.</p><ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{alreadyAssessedStudents.map(student => <li key={`assessed-${student.id}`} className="rounded-lg border border-border bg-card px-3 py-2 text-sm"><strong className="block text-foreground">{student.name}</strong><span className="text-xs text-muted-foreground">{student.meta}</span></li>)}</ul></div></details> : null}
      </fieldset>}
    </section>

    <section className="space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <SectionHeading number={3} title="Apply a voucher, scholarship, or discount" description="Skip this section when every selected student will pay the full package amount." />
      <div className="grid gap-4 lg:grid-cols-3"><FieldLabel title="Type of financial assistance" help="Choose the approved source, such as DepEd Voucher, ESC, school scholarship, or authorized adjustment."><select name="creditTypeId" value={creditTypeId} onChange={event => { markAssessmentChanged(); setCreditTypeId(event.target.value); }} className={field}><option value="">None — charge the full amount</option>{workspace.creditTypes.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></FieldLabel><FieldLabel title="Amount deducted per student" help="Enter the same deduction for each selected student. Example: 5000 for ₱5,000."><div className="relative"><PhilippinePeso className="pointer-events-none absolute left-3 top-4 size-4 text-muted-foreground" /><input name="creditAmount" aria-label="Amount deducted per student" type="number" min="0" step="0.01" value={creditAmount} onChange={event => { markAssessmentChanged(); setCreditAmount(event.target.value); }} className={`${field} pl-9`} /></div></FieldLabel><FieldLabel title="Voucher or approval reference" help="Required only when the selected assistance type asks for proof. Example: QVR-2026-00123."><input name="creditReference" value={creditReference} onChange={event => { markAssessmentChanged(); setCreditReference(event.target.value); }} className={field} placeholder="Enter reference number" /></FieldLabel></div>
    </section>

    {activePreview ? <section className="space-y-4 rounded-xl border-2 border-[#e64a19]/35 bg-card p-4 sm:p-5" aria-label="Assessment review"><SectionHeading number={4} title="Review before posting" description="Check these totals carefully. Posting creates the official student charges and payment terms." /><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Ready to post</dt><dd className="mt-1 text-xl font-bold text-foreground">{activePreview.eligibleCount} students</dd></div><div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Skipped</dt><dd className="mt-1 font-semibold text-foreground">{activePreview.duplicateCount} already assessed · {activePreview.excludedCount} not eligible</dd></div><div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">Total charges minus assistance</dt><dd className="mt-1 font-semibold text-foreground">₱{activePreview.grossTotal.toLocaleString("en-PH")} − ₱{activePreview.creditTotal.toLocaleString("en-PH")}</dd></div><div className="rounded-lg bg-primary/10 p-3"><dt className="text-xs text-muted-foreground">Final amount payable</dt><dd className="mt-1 text-xl font-bold text-primary">₱{activePreview.netTotal.toLocaleString("en-PH")}</dd></div></dl><input type="hidden" name="previewFingerprint" value={activePreview.fingerprint} /><input type="hidden" name="submissionToken" value={state.submissionToken ?? ""} /></section> : null}
    {state.batchReference ? <p className="rounded-xl bg-status-success-bg p-4 text-sm font-semibold text-status-success-foreground"><CheckCircle2 className="mr-2 inline size-4" />Successfully posted. Batch reference: <Link className="underline" href={`/admin/tuition/assessments/${encodeURIComponent(state.batchReference)}`}>{state.batchReference}</Link></p> : null}
    <button className={`${button} w-full sm:w-auto`} disabled={pending || !workspace.ready || (!activePreview && selectedIds.length === 0)} type="submit">{pending ? activePreview ? "Posting assessments…" : "Preparing preview…" : activePreview ? `Post ${activePreview.eligibleCount} assessments now` : `Preview ${selectedIds.length || "selected"} assessments`}</button>
  </form>;
}

export function ScheduleManager({ workspace }: { workspace: AssessmentWorkspace }) {
  const [state, action, pending] = useActionState(tuitionSetupAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [audience, setAudience] = useState<AcademicAudience>(workspace.educationScope === "higher" ? "higher" : "basic");
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [assistance, setAssistance] = useState({ code: "", name: "", sourceKind: "government", requiresReference: false });
  const [periodId, setPeriodId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const [installmentPreset, setInstallmentPreset] = useState<InstallmentPreset>("full");
  const [planName, setPlanName] = useState("");
  const [planTerms, setPlanTerms] = useState<EditablePlanTerm[]>([]);
  const [monthlyCount, setMonthlyCount] = useState(10);
  const [mandatoryTiming, setMandatoryTiming] = useState<"upfront" | "installment">("upfront");
  const audienceLabel = audience === "basic" ? "K–12 students" : "College students";
  const targetOptions = audience === "basic"
    ? workspace.grades.map(grade => ({ id: grade.id, label: grade.name }))
    : workspace.programs.flatMap(program => program.levels.map(level => ({ id: level.id, label: `${program.name} · ${level.name}` })));
  const availableTargets = targetOptions.length;
  const allTargetsSelected = availableTargets > 0 && targetOptions.every(target => selectedTargetIds.includes(target.id));
  const trackReady = workspace.trackReadiness[audience];
  const openCollegePeriods = workspace.periods.filter(period => period.status !== "closed");
  const billingBounds = useMemo<BillingWindow | null>(() => audience === "basic"
    ? workspace.schoolYearBounds
    : (() => {
        const period = openCollegePeriods.find(item => String(item.id) === periodId);
        return period ? { startsOn: period.startsOn, endsOn: period.endsOn } : null;
      })(), [audience, openCollegePeriods, periodId, workspace.schoolYearBounds]);
  const deadlineError = validateFinalDeadline(dueDate, billingBounds);
  const localPlanError = validateInstallmentPlan({
    enabled: installmentPreset !== "full",
    planName,
    terms: planTerms.map(term => ({ name: term.name, percentage: Number(term.percentage), date: term.date })),
    bounds: billingBounds,
    finalDeadline: dueDate,
  });
  const serverPlanError = state.status === "error" && state.field && state.field !== "dueDate" && state.message
    ? { field: state.field, message: state.message } as InstallmentValidationError
    : null;
  const displayedPlanError = serverPlanError ?? localPlanError;
  const setupReady = workspace.enabledAudiences.includes(audience) && trackReady && availableTargets > 0 && (audience === "basic" || openCollegePeriods.length > 0);
  const canSaveSchedule = setupReady && selectedTargetIds.length > 0 && !deadlineError && !localPlanError;
  const applyAssistancePreset = (value: string) => {
    if (value in assistancePresets) setAssistance(assistancePresets[value as AssistancePreset]);
    else setAssistance({ code: "", name: "", sourceKind: "government", requiresReference: false });
  };
  const toggleTarget = (targetId: number) => setSelectedTargetIds(current => current.includes(targetId) ? current.filter(id => id !== targetId) : [...current, targetId]);
  const changePreset = (preset: InstallmentPreset) => {
    setInstallmentPreset(preset);
    if (preset === "full") {
      setPlanName("");
      setPlanTerms([]);
      setMandatoryTiming("upfront");
      return;
    }
    const generated = newEditableTerms(preset, monthlyCount);
    setPlanName(generated.planName);
    setPlanTerms(generated.terms);
  };
  const changeMonthlyCount = (count: number) => {
    setMonthlyCount(count);
    const generated = newEditableTerms("monthly", count, planTerms);
    setPlanName(generated.planName);
    setPlanTerms(generated.terms);
  };
  useEffect(() => {
    if (state.status !== "error" || !state.field) return;
    const target = formRef.current?.querySelector<HTMLElement>(state.field === "installmentPlan" ? '[data-field="installmentPlan"]' : `[name="${state.field}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }, [state]);
  return <div className="space-y-6"><Result state={state} />
    <Guide><strong>Recommended order:</strong> create the tuition package, review its targets and amounts, then approve it. Approved packages cannot be edited; use <strong>Clone revision</strong> when prices or dates change.</Guide>
    <form ref={formRef} action={action} className="space-y-6 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5"><input type="hidden" name="intent" value="create-schedule" /><SectionHeading number={1} title="Name the package and choose who it is for" description="Use a name your finance staff and parents can recognize later." /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><FieldLabel title="Package name" required help="Example: Grade 7 Tuition 2026–2027 or BSIT Year 1 – First Semester."><input required name="name" placeholder="Enter a clear package name" className={field} /></FieldLabel>{workspace.educationScope === "both" ? <FieldLabel title="Student group" required help="Both tracks are enabled in School Setup. Choose the group covered by this package."><select name="audience" value={audience} onChange={event => { setAudience(event.target.value as AcademicAudience); setSelectedTargetIds([]); setPeriodId(""); setDueDate(""); setDeadlineTouched(false); setPlanTerms(current => current.map(term => ({ ...term, date: "" }))); }} className={field}><option value="basic">K–12 students</option><option value="higher">College students</option></select></FieldLabel> : <FieldLabel title="Student group" required help="This is set by the school’s academic offering. Change it from School Setup if needed."><input type="hidden" name="audience" value={audience} /><div className="flex min-h-12 items-center rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-foreground" role="status">{audienceLabel}</div></FieldLabel>}{audience === "higher" ? <FieldLabel title="College academic period" required help="Only active or upcoming periods from this school year are available."><select required name="periodId" value={periodId} onChange={event => { setPeriodId(event.target.value); setDueDate(""); setDeadlineTouched(false); setPlanTerms(current => current.map(term => ({ ...term, date: "" }))); }} className={field}><option value="">Select the covered period…</option>{openCollegePeriods.map(item => <option key={item.id} value={item.id}>{item.name} — {item.status}</option>)}</select></FieldLabel> : null}</div>
      {!trackReady || availableTargets === 0 || (audience === "higher" && openCollegePeriods.length === 0) ? <div role="alert" className="rounded-xl border border-status-warning-foreground/25 bg-status-warning-bg p-4 text-sm text-status-warning-foreground"><strong className="block">Complete {audience === "basic" ? "Basic Education" : "College"} setup first</strong><p className="mt-1 leading-5">{audience === "basic" ? "Add the grade levels and sections your school offers." : "Add at least one program with year levels, an active or upcoming academic period, and a college section."} Then return here to create the matching tuition package.</p><Link href="/admin/school-setup" className="mt-2 inline-flex min-h-11 items-center font-semibold underline focus:outline-none focus-visible:ring-3 focus-visible:ring-primary/25">Open School Setup</Link></div> : null}
      <div className="border-t border-border pt-5"><SectionHeading number={2} title="Enter the approved charges" description="These amounts become the gross Statement of Account before vouchers, scholarships, or discounts." /></div>
      {billingBounds ? <div className="flex items-start gap-3 rounded-xl border border-status-info-foreground/20 bg-status-info-bg p-4 text-sm text-status-info-foreground"><CalendarRange className="mt-0.5 size-4 shrink-0" /><div><strong className="block">Valid billing dates</strong><span>{formatBillingDate(billingBounds.startsOn)} to {formatBillingDate(billingBounds.endsOn)}{audience === "higher" ? " for the selected college period" : ` for ${workspace.schoolYearName ?? "the active school year"}`}.</span></div></div> : audience === "higher" ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Choose a college academic period to see its valid billing dates.</p> : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FieldLabel title="Main tuition item name" required help="Usually “Tuition”. Change only if your school uses another official label."><input required name="tuitionName" defaultValue="Tuition" className={field} /></FieldLabel>
        <FieldLabel title="Tuition amount per student" required help="Enter the full approved tuition for one student, before any discount."><div className="relative"><PhilippinePeso className="pointer-events-none absolute left-3 top-4 size-4 text-muted-foreground" /><input required name="tuitionAmount" aria-label="Tuition amount per student" type="number" min="0.01" step="0.01" placeholder="0.00" className={`${field} pl-9`} /></div></FieldLabel>
        <FieldLabel title="Final payment deadline" required help={billingBounds ? `Must be from ${formatBillingDate(billingBounds.startsOn)} to ${formatBillingDate(billingBounds.endsOn)}. Every installment date must be on or before this date.` : "Choose the covered college period first."}><input required name="dueDate" type="date" min={billingBounds?.startsOn} max={billingBounds?.endsOn} value={dueDate} onChange={event => { setDueDate(event.target.value); setDeadlineTouched(true); }} onBlur={() => setDeadlineTouched(true)} disabled={!billingBounds} aria-invalid={(deadlineTouched && Boolean(deadlineError)) || state.field === "dueDate" || undefined} className={field} />{(state.field === "dueDate" && state.message) || (deadlineTouched && deadlineError) ? <span role="alert" className="text-xs font-medium text-status-danger-foreground">{state.field === "dueDate" && state.message ? state.message : deadlineError?.message}</span> : null}</FieldLabel>
        <FieldLabel title="Additional required fee" help="Example: Laboratory fee, miscellaneous fee, or registration fee. Leave blank if none."><input name="mandatoryName" placeholder="Enter fee name, if applicable" className={field} /></FieldLabel>
        <FieldLabel title="Additional fee amount" help="Enter 0 or leave the fee name blank when there is no additional required fee."><div className="relative"><PhilippinePeso className="pointer-events-none absolute left-3 top-4 size-4 text-muted-foreground" /><input name="mandatoryAmount" aria-label="Additional fee amount" type="number" min="0" step="0.01" defaultValue="0" className={`${field} pl-9`} /></div></FieldLabel>
        <FieldLabel title="When the additional fee is paid" help={installmentPreset === "full" ? "Full payment is selected, so this fee uses the final payment deadline." : "Choose whether this fee is paid separately or spread across the installment plan."}><select name="mandatoryTiming" value={mandatoryTiming} onChange={event => setMandatoryTiming(event.target.value as "upfront" | "installment")} disabled={installmentPreset === "full"} className={field}><option value="upfront">Pay in full by the final deadline</option>{installmentPreset !== "full" ? <option value="installment">Include in installment plan</option> : null}</select></FieldLabel>
      </div>
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">3. Choose covered {audience === "basic" ? "grade levels" : "program and year levels"} <Required /></legend>
        <Help>These choices come directly from School Setup. Only enrolled students matching the selected targets can receive this package.</Help>
        {availableTargets ? <>
          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-muted/40 p-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
            <span className="text-sm font-semibold text-foreground" aria-live="polite">{selectedTargetIds.length} of {availableTargets} selected</span>
            <div className="flex flex-col gap-2 min-[360px]:flex-row">
              <button type="button" onClick={() => setSelectedTargetIds(targetOptions.map(target => target.id))} disabled={allTargetsSelected} className={secondaryButton}>Select all</button>
              <button type="button" onClick={() => setSelectedTargetIds([])} disabled={!selectedTargetIds.length} className={secondaryButton}>Clear</button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{targetOptions.map(target => <label key={target.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm text-foreground transition focus-within:ring-3 focus-within:ring-primary/25 ${selectedTargetIds.includes(target.id) ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/60"}`}><input type="checkbox" name="targetIds" value={target.id} checked={selectedTargetIds.includes(target.id)} onChange={() => toggleTarget(target.id)} className="size-4 accent-[#e64a19]" />{target.label}</label>)}</div>
        </> : <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">No {audience === "basic" ? "grade levels" : "program year levels"} are configured for this school yet.</p>}
      </fieldset>
      <InstallmentPlanBuilder preset={installmentPreset} planName={planName} terms={planTerms} monthlyCount={monthlyCount} bounds={billingBounds} finalDeadline={dueDate} validationError={displayedPlanError} onPresetChange={changePreset} onPlanNameChange={setPlanName} onTermsChange={setPlanTerms} onMonthlyCountChange={changeMonthlyCount} />
      <button className={`${button} w-full sm:w-auto`} disabled={pending || !canSaveSchedule}>{pending ? "Saving draft…" : !setupReady ? "Complete School Setup first" : !selectedTargetIds.length ? `Select at least one ${audience === "basic" ? "grade level" : "program year"}` : deadlineError ? "Choose a valid final deadline" : localPlanError ? "Complete the installment plan" : "Save as draft for review"}</button>
    </form>

    <details className="group rounded-xl border border-border bg-card text-card-foreground">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-4 focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 sm:p-5"><div><h2 className="font-semibold">Does your school offer a voucher, scholarship, or discount?</h2><p className="mt-1 text-sm text-muted-foreground">Optional. Skip this section when every student pays the full tuition package.</p></div><ChevronRight className="size-5 shrink-0 transition group-open:rotate-90" /></summary>
      <form action={action} className="space-y-5 border-t border-border p-4 sm:p-5"><input type="hidden" name="intent" value="create-credit" />
        <Guide>Start with a common type below. The system will fill the technical code and source for you. Confirm the official deduction limit with your registrar or finance policy before saving.</Guide>
        <FieldLabel title="Choose a common assistance type" required help="Choose Custom only when the assistance is not listed."><select className={field} defaultValue="" onChange={event => applyAssistancePreset(event.target.value)}><option value="">Select a voucher, scholarship, or discount…</option><option value="deped">DepEd Senior High School Voucher</option><option value="esc">ESC subsidy</option><option value="scholarship">School scholarship</option><option value="discount">School-approved discount</option><option value="adjustment">Authorized manual adjustment</option><option value="custom">Custom assistance type</option></select></FieldLabel>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><FieldLabel title="Internal code" required help="Auto-filled from the selection above. For Custom, use a short unique code with no student information."><input required name="code" value={assistance.code} onChange={event => setAssistance(current => ({ ...current, code: event.target.value.toUpperCase().replace(/\s+/g, "-") }))} placeholder="Example: SCHOOL-DISCOUNT" className={field}/></FieldLabel><FieldLabel title="Name shown during assessment" required help="This is what the admin will choose when applying the deduction."><input required name="name" value={assistance.name} onChange={event => setAssistance(current => ({ ...current, name: event.target.value }))} placeholder="Example: School-Approved Discount" className={field}/></FieldLabel><FieldLabel title="Funding or approval source" required help="Auto-filled by the selected assistance type; change only when necessary."><select name="sourceKind" value={assistance.sourceKind} onChange={event => setAssistance(current => ({ ...current, sourceKind: event.target.value }))} className={field}><option value="government">Government program</option><option value="school">School-funded or school-approved</option><option value="manual">Authorized manual adjustment</option></select></FieldLabel><FieldLabel title="Maximum deduction in pesos" help="Example: enter 18000 if no student may receive more than ₱18,000. Leave blank when using only a percentage limit."><input name="maxAmount" type="number" min="0" step="0.01" placeholder="Example: 18000" className={field}/></FieldLabel><FieldLabel title="Maximum deduction percentage" help="Example: enter 50 if the deduction cannot exceed 50% of the tuition package. Leave blank when using only a peso limit."><input name="maxPercent" type="number" min="0" max="100" step="0.01" placeholder="Example: 50" className={field}/></FieldLabel><label className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 text-sm"><input type="checkbox" name="requiresReference" checked={assistance.requiresReference} onChange={event => setAssistance(current => ({ ...current, requiresReference: event.target.checked }))} className="size-4 accent-[#e64a19]"/><span><strong className="block">Require a voucher or approval number</strong><span className="text-xs text-muted-foreground">Recommended for audit proof. Presets enable this when normally needed.</span></span></label></div>
        <p className="rounded-lg bg-amber-50 p-3 text-sm leading-5 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100"><strong>Important:</strong> if both limits are blank, an administrator may deduct up to the student’s full tuition package. Set at least one limit unless that is intentional.</p>
        <button className={`${button} w-full sm:w-auto`} disabled={pending || !assistance.code || !assistance.name}>{pending ? "Saving assistance type…" : "Save assistance type"}</button>
      </form>
    </details>

    <section className="rounded-xl border border-black/10 bg-white p-4 sm:p-5"><SectionHeading title="Review and approve tuition packages" description="Drafts are not assignable. Approval locks the amounts and dates; clone an approved package when changes are needed." /><div className="mt-4 space-y-2">{workspace.schedules.length === 0 ? <p className="text-sm text-[#666b78]">No tuition packages yet.</p> : workspace.schedules.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"><div><strong>{item.name}</strong><p className="text-xs leading-5 text-[#666b78]">{item.audience === "basic" ? "K–12" : "College"} · {item.period} · {item.itemCount} charge item{item.itemCount === 1 ? "" : "s"} · ₱{item.grossAmount.toLocaleString("en-PH")}</p></div><span className="w-fit rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase">{item.status}</span><div className="flex flex-col gap-2 min-[420px]:flex-row">{item.status === "draft" ? <form action={action}><input type="hidden" name="intent" value="approve-schedule" /><input type="hidden" name="scheduleId" value={item.id} /><button className={`${button} w-full`} disabled={pending}>Approve and lock</button></form> : null}{item.status !== "draft" ? <form action={action}><input type="hidden" name="intent" value="clone-schedule" /><input type="hidden" name="scheduleId" value={item.id} /><button className={`${secondaryButton} w-full`} disabled={pending}>Clone revision</button></form> : null}{item.status === "approved" ? <form action={action}><input type="hidden" name="intent" value="archive-schedule" /><input type="hidden" name="scheduleId" value={item.id} /><button className={`${secondaryButton} w-full`} disabled={pending}>Archive</button></form> : null}</div></div>)}</div></section>
  </div>;
}

export function AcademicSetup({ workspace }: { workspace: AssessmentWorkspace }) {
  const [state, action, pending] = useActionState(tuitionSetupAction, initialState);
  return <div className="space-y-6"><Result state={state} /><Guide><strong>Set up college in this order:</strong> add the academic period and program, activate the period currently accepting enrollment, create sections, then place students.</Guide><div className="grid gap-5 lg:grid-cols-2">
    <form action={action} className="space-y-4 rounded-xl border border-black/10 bg-white p-4 sm:p-5"><input type="hidden" name="intent" value="create-period" /><SectionHeading number={1} title="Add a semester or term" description="This is the college billing and enrollment period inside the active school year." /><FieldLabel title="Period name" required help="Example: First Semester, Second Trimester, or Summer 2027."><input required name="name" placeholder="First Semester" className={field} /></FieldLabel><FieldLabel title="Period type" required help="Choose the academic calendar used by the school."><select name="periodType" className={field}><option value="semester">Semester</option><option value="trimester">Trimester</option><option value="summer">Summer term</option><option value="custom">Custom period</option></select></FieldLabel><div className="grid gap-4 min-[420px]:grid-cols-2"><FieldLabel title="First day" required help="Must be inside the active school year."><input required name="startsOn" type="date" className={field} /></FieldLabel><FieldLabel title="Last day" required help="Must be after the first day."><input required name="endsOn" type="date" className={field} /></FieldLabel></div><button className={`${button} w-full sm:w-auto`} disabled={pending}>Save academic period</button></form>
    <form action={action} className="space-y-4 rounded-xl border border-black/10 bg-white p-4 sm:p-5"><input type="hidden" name="intent" value="create-program" /><SectionHeading number={2} title="Add a college program" description="The system automatically creates the requested year levels." /><FieldLabel title="Program code" required help="Use the official short code. Example: BSIT, BSA, or BSHM."><input required name="code" placeholder="BSIT" className={field} /></FieldLabel><FieldLabel title="Complete program name" required help="Example: Bachelor of Science in Information Technology."><input required name="name" placeholder="Bachelor of Science in Information Technology" className={field} /></FieldLabel><FieldLabel title="Number of year levels" required help="Example: enter 4 for a four-year degree."><input required name="levelCount" type="number" min="1" max="8" defaultValue="4" className={field} /></FieldLabel><button className={`${button} w-full sm:w-auto`} disabled={pending}>Save program and year levels</button></form>
  </div><div className="grid gap-5 lg:grid-cols-2">
    <form action={action} className="space-y-4 rounded-xl border border-black/10 bg-white p-4 sm:p-5"><input type="hidden" name="intent" value="create-section" /><SectionHeading number={3} title="Create a college section" description="Sections help organize students within a program year and period." /><FieldLabel title="Academic period" required help="Choose the term where this section will be used."><select required name="periodId" className={field}><option value="">Select a period…</option>{workspace.periods.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></FieldLabel><FieldLabel title="Program and year level" required help="Example: BSIT · Year 1."><select required name="levelId" className={field}><option value="">Select program and year…</option>{workspace.programs.flatMap(program=>program.levels.map(level=><option key={level.id} value={level.id}>{program.name} · {level.name}</option>))}</select></FieldLabel><FieldLabel title="Section name" required help="Example: Section A, BSIT-1A, or Block 1."><input required name="name" placeholder="BSIT-1A" className={field}/></FieldLabel><button className={`${button} w-full sm:w-auto`} disabled={pending}>Save college section</button></form>
    <form action={action} className="space-y-4 rounded-xl border border-black/10 bg-white p-4 sm:p-5"><input type="hidden" name="intent" value="enroll-college" /><SectionHeading number={4} title="Place a student in college" description="This records the student’s program, year level, section, and active academic period." /><FieldLabel title="Student" required help="Choose an existing school student record."><select required name="studentId" className={field}><option value="">Select a student…</option>{workspace.allStudents.map(item=><option key={item.id} value={item.id}>{item.name} · {item.reference}</option>)}</select></FieldLabel><FieldLabel title="Active academic period" required help="Only an active period can accept college enrollment and tuition assessment."><select required name="periodId" className={field}><option value="">Select the active period…</option>{workspace.periods.filter(item=>item.status==='active').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></FieldLabel><FieldLabel title="Program and year level" required help="Choose the student’s current program placement."><select required name="levelId" className={field}><option value="">Select program and year…</option>{workspace.programs.flatMap(program=>program.levels.map(level=><option key={level.id} value={level.id}>{program.name} · {level.name}</option>))}</select></FieldLabel><FieldLabel title="College section" help="Choose a matching section, or leave blank when sections are not used."><select name="sectionId" className={field}><option value="">No section assigned</option>{workspace.collegeSections.map(item=><option key={item.id} value={item.id}>{item.periodName} · {item.levelName} · {item.name}</option>)}</select></FieldLabel><button className={`${button} w-full sm:w-auto`} disabled={pending}>Enroll student in active period</button></form>
  </div><section className="rounded-xl border border-black/10 bg-white p-4 sm:p-5"><SectionHeading title="Academic periods" description="Exactly one period should be active when college enrollment and assessments are being posted." /><div className="mt-4 space-y-2">{workspace.periods.length === 0 ? <p className="text-sm text-[#666b78]">No college periods yet.</p> : workspace.periods.map(period => <form action={action} key={period.id} className="flex flex-col gap-3 rounded-xl border border-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"><input type="hidden" name="intent" value="activate-period" /><input type="hidden" name="periodId" value={period.id} /><div><strong>{period.name}</strong><p className="text-xs text-[#666b78]">{period.startsOn} to {period.endsOn}</p></div><span className="w-fit rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase">{period.status}</span>{period.status !== "active" && period.status !== "closed" ? <button className={`${button} w-full sm:w-auto`}>Make this the active period</button> : <span className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" />{period.status === "active" ? "Currently accepting enrollment" : "Closed"}</span>}</form>)}</div></section></div>;
}
