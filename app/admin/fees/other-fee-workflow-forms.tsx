"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, Filter, Plus, Receipt, Search } from "lucide-react";

import {
  AdminButton,
  Field,
  fieldControlClass,
} from "@/app/admin/_components/admin-ui";
import { cn } from "@/lib/utils";
import type {
  OtherFeeTypeOption,
  OtherFeeWorkspace,
} from "@/lib/fees/other-fees";
import {
  createOtherFeeTypeAction,
  initialOtherFeeActionState,
  postOtherFeeChargeAction,
} from "./other-fee-actions";

const templates = [
  { value: "", label: "Start without a template" },
  {
    value: "registration",
    label: "Registration or enrollment",
    name: "Registration fee",
    group: "registration",
    description:
      "Administrative enrollment processing and registration services.",
  },
  {
    value: "library",
    label: "Library or learning resources",
    name: "Library fee",
    group: "learning_resources",
    description:
      "Library access, learning resources, and related student services.",
  },
  {
    value: "laboratory",
    label: "Laboratory or workshop",
    name: "Laboratory fee",
    group: "laboratory_facilities",
    description:
      "Use of laboratory, computer laboratory, equipment, or workshop facilities.",
  },
  {
    value: "medical",
    label: "Medical and dental services",
    name: "Medical and dental fee",
    group: "student_services",
    description:
      "School clinic, medical, and dental services available to students.",
  },
  {
    value: "guidance",
    label: "Guidance or student services",
    name: "Guidance services fee",
    group: "student_services",
    description: "Guidance, counselling, and related student support services.",
  },
  {
    value: "activity",
    label: "Athletic or school activity",
    name: "Student activity fee",
    group: "activities_programs",
    description:
      "Approved athletic, co-curricular, or school activity expenses.",
  },
  {
    value: "id",
    label: "School ID or documents",
    name: "School ID fee",
    group: "identification_documents",
    description: "Student identification card or requested school document.",
  },
  {
    value: "event",
    label: "Field trip, graduation, or program",
    name: "School program fee",
    group: "activities_programs",
    description:
      "Approved school event, field trip, graduation, or program expenses.",
  },
  {
    value: "practicum",
    label: "OJT, internship, or practicum",
    name: "Practicum fee",
    group: "practicum_training",
    description:
      "OJT, internship, practicum, supervision, or placement-related services.",
  },
  {
    value: "campus",
    label: "Transport, meal, or boarding",
    name: "Campus service fee",
    group: "campus_services",
    description:
      "Optional transport, meal, boarding, or similar campus service.",
  },
  {
    value: "other",
    label: "Other approved purpose",
    name: "",
    group: "other",
    description: "",
  },
] as const;

const groupOptions = [
  ["registration", "Registration and enrollment"],
  ["learning_resources", "Learning resources"],
  ["laboratory_facilities", "Laboratory and facilities"],
  ["student_services", "Student services"],
  ["activities_programs", "Activities and programs"],
  ["identification_documents", "Identification and documents"],
  ["practicum_training", "Practicum and training"],
  ["campus_services", "Campus services"],
  ["other", "Other approved purpose"],
] as const;

export function OtherFeeTypeForm({
  workspace,
}: {
  workspace: OtherFeeWorkspace;
}) {
  const [state, action, pending] = useActionState(
    createOtherFeeTypeAction,
    initialOtherFeeActionState,
  );
  useActionFieldFocus(state);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("other");
  const [amountMode, setAmountMode] = useState("fixed");
  const audienceOptions = audienceChoices(workspace.educationScope, true);
  const applyTemplate = (value: string) => {
    const template = templates.find((item) => item.value === value);
    if (!template || !template.value) return;
    setName(template.name);
    setCode(suggestCode(template.name));
    setGroup(template.group);
    setDescription(template.description);
  };
  return (
    <form
      action={action}
      className="space-y-5"
      aria-describedby="fee-type-guidance"
    >
      <p
        id="fee-type-guidance"
        className="rounded-lg border border-status-info-foreground/20 bg-status-info-bg p-3 text-sm leading-6 text-status-info-foreground"
      >
        Create the reusable definition only. Students and payment deadlines are
        chosen when you assign the fee.
      </p>
      <Field label="Start from a common Philippine school fee (optional)">
        <select
          className={fieldControlClass}
          defaultValue=""
          onChange={(event) => applyTemplate(event.target.value)}
        >
          {templates.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Fee name" required>
          <input
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!code) setCode(suggestCode(event.target.value));
            }}
            className={fieldControlClass}
            placeholder="Example: Laboratory fee"
            required
            maxLength={120}
          />
        </Field>
        <Field label="Internal fee code" required>
          <input
            name="code"
            value={code}
            onChange={(event) =>
              setCode(
                event.target.value.toUpperCase().replaceAll(/[^A-Z0-9-]/g, ""),
              )
            }
            className={fieldControlClass}
            placeholder="LAB-FEE"
            required
            maxLength={40}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="What does this fee cover?" required>
            <textarea
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={cn(fieldControlClass, "min-h-24 py-3")}
              placeholder="Describe the service, facility, activity, or item parents are paying for."
              required
              maxLength={255}
            />
          </Field>
        </div>
        <Field label="Purpose group" required>
          <select
            name="group"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className={fieldControlClass}
          >
            {groupOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who can receive this fee?" required>
          <select name="audience" className={fieldControlClass}>
            {audienceOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Collection policy" required>
          <select name="policy" className={fieldControlClass}>
            <option value="mandatory">Mandatory for applicable students</option>
            <option value="optional">Optional / student opted in</option>
            <option value="conditional">
              Conditional to a service or activity
            </option>
          </select>
        </Field>
        <Field label="How often may it be charged?" required>
          <select name="billingBasis" className={fieldControlClass}>
            <option value="school_year">Once per school year</option>
            <option value="academic_period">Once per academic period</option>
            <option value="event">Per event or occasion</option>
            <option value="recurring">Recurring</option>
          </select>
        </Field>
        <Field label="How is the amount set?" required>
          <select
            name="amountMode"
            value={amountMode}
            onChange={(event) => setAmountMode(event.target.value)}
            className={fieldControlClass}
          >
            <option value="fixed">Use a fixed standard amount</option>
            <option value="assignment">Enter the amount when assigning</option>
          </select>
        </Field>
        <Field
          label="Standard amount per student"
          required={amountMode === "fixed"}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              ₱
            </span>
            <input
              name="defaultAmount"
              type="number"
              min="0.01"
              step="0.01"
              disabled={amountMode !== "fixed"}
              className={cn(fieldControlClass, "pl-8")}
              placeholder={
                amountMode === "fixed" ? "0.00" : "Set during assignment"
              }
              required={amountMode === "fixed"}
            />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Approval, memo, or policy reference (optional)">
            <input
              name="approvalReference"
              className={fieldControlClass}
              placeholder="Example: Board Resolution 2028-04 or approved fee schedule"
              maxLength={120}
            />
          </Field>
        </div>
      </section>
      <ActionMessage state={state} />
      <AdminButton
        type="submit"
        tone="primary"
        disabled={pending || !workspace.writable}
        className="w-full sm:w-auto"
      >
        <Plus className="size-4" />
        {pending ? "Creating fee type…" : "Create fee type"}
      </AdminButton>
    </form>
  );
}

export function OtherFeeAssignmentForm({
  workspace,
  submissionToken,
}: {
  workspace: OtherFeeWorkspace;
  submissionToken: string;
}) {
  const [state, action, pending] = useActionState(
    postOtherFeeChargeAction,
    initialOtherFeeActionState,
  );
  useActionFieldFocus(state);
  const activeTypes = workspace.feeTypes.filter(
    (item) => item.status === "active",
  );
  const [feeTypeId, setFeeTypeId] = useState(activeTypes[0]?.id ?? 0);
  const feeType = activeTypes.find((item) => item.id === feeTypeId) ?? null;
  const [audience, setAudience] = useState<"basic" | "higher">(
    feeType?.audience === "higher" ? "higher" : "basic",
  );
  const [periodId, setPeriodId] = useState<number | null>(
    workspace.periods.find((item) => item.status === "active")?.id ?? null,
  );
  const [amount, setAmount] = useState(
    feeType?.defaultAmount ? String(feeType.defaultAmount) : "",
  );
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [approvalReference, setApprovalReference] = useState(
    feeType?.approvalReference ?? "",
  );
  const period = workspace.periods.find((item) => item.id === periodId) ?? null;
  const dateBounds =
    audience === "higher" && period
      ? { min: period.startsOn, max: period.endsOn }
      : {
          min: workspace.schoolYear?.startsOn ?? "",
          max: workspace.schoolYear?.endsOn ?? "",
        };
  const eligibleStudents = useMemo(
    () =>
      workspace.students.filter(
        (student) =>
          student.audience === audience &&
          (audience === "basic" || student.periodId === periodId),
      ),
    [audience, periodId, workspace.students],
  );
  const groupOptions = useMemo(
    () => [...new Set(eligibleStudents.map((item) => item.groupLabel))],
    [eligibleStudents],
  );
  const visibleStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return eligibleStudents.filter(
      (student) =>
        (groupFilter === "all" || student.groupLabel === groupFilter) &&
        (!needle ||
          `${student.name} ${student.reference}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [eligibleStudents, groupFilter, query]);
  const selectedSet = new Set(selectedIds);
  const amountNumber = Number(amount) || 0;
  const total = amountNumber * selectedIds.length;
  const chooseType = (id: number) => {
    const nextFeeType = activeTypes.find((item) => item.id === id);
    setFeeTypeId(id);
    if (!nextFeeType) return;
    setAudience(nextFeeType.audience === "higher" ? "higher" : "basic");
    setAmount(nextFeeType.amountMode === "fixed" ? String(nextFeeType.defaultAmount) : "");
    setApprovalReference(nextFeeType.approvalReference);
    setSelectedIds([]);
  };
  const toggle = (id: number) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const selectVisible = () =>
    setSelectedIds((current) => [
      ...new Set([...current, ...visibleStudents.map((item) => item.id)]),
    ]);
  const canSubmit = Boolean(
    feeType &&
    title.trim() &&
    dueDate &&
    amountNumber > 0 &&
    selectedIds.length > 0 &&
    !pending,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="submissionToken" value={submissionToken} />
      <input type="hidden" name="feeTypeId" value={feeTypeId || ""} />
      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="periodId" value={periodId ?? ""} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}
      <WorkflowStep
        number="1"
        title="Choose fee type"
        summary={
          feeType
            ? `${feeType.name} · ${labelValue(feeType.policy)}`
            : "Required"
        }
      >
        <Field label="Other fee type" required>
          <select
            value={feeTypeId || ""}
            onChange={(event) => chooseType(Number(event.target.value))}
            className={fieldControlClass}
            disabled={!activeTypes.length}
          >
            <option value="">
              {activeTypes.length
                ? "Choose fee type"
                : "Create an active fee type first"}
            </option>
            {activeTypes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {money(item.defaultAmount)}
              </option>
            ))}
          </select>
        </Field>
        {feeType ? (
          <div className="mt-3 grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-2">
            <Summary label="Purpose" value={feeType.description} />
            <Summary
              label="Rules"
              value={`${labelValue(feeType.policy)} · ${labelValue(feeType.billingBasis)} · ${labelValue(feeType.audience)}`}
            />
          </div>
        ) : null}
      </WorkflowStep>
      <WorkflowStep
        number="2"
        title="Choose academic context"
        summary={
          audience === "higher"
            ? (period?.name ?? "College period required")
            : (workspace.schoolYear?.name ?? "School year")
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Student group" required>
            <select
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value as "basic" | "higher");
                setSelectedIds([]);
                setGroupFilter("all");
              }}
              className={fieldControlClass}
            >
              {audienceChoicesForFee(feeType, workspace.educationScope).map(
                (item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ),
              )}
            </select>
          </Field>
          {audience === "higher" ? (
            <Field label="Active college period" required>
              <select
                value={periodId ?? ""}
                onChange={(event) => {
                  setPeriodId(Number(event.target.value) || null);
                  setSelectedIds([]);
                }}
                className={fieldControlClass}
              >
                <option value="">Choose active period</option>
                {workspace.periods
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : (
            <Field label="Active school year">
              <input
                value={workspace.schoolYear?.name ?? "Not configured"}
                readOnly
                className={fieldControlClass}
              />
            </Field>
          )}
        </div>
      </WorkflowStep>
      <WorkflowStep
        number="3"
        title="Enter charge details"
        summary={title || "Title, amount, and deadline required"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Charge title or occasion" required>
            <input
              name="chargeTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldControlClass}
              placeholder="Example: Grade 10 Field Trip – January 2029"
              required
              maxLength={140}
            />
          </Field>
          <Field label="Amount per student" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ₱
              </span>
              <input
                name="amountPerStudent"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                className={cn(fieldControlClass, "pl-8")}
                required
              />
            </div>
          </Field>
          <Field label="Payment due date" required>
            <input
              name="dueDate"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              min={dateBounds.min}
              max={dateBounds.max}
              className={fieldControlClass}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Allowed: {dateBounds.min || "—"} to {dateBounds.max || "—"}
            </p>
          </Field>
          <Field label="Approval or memo reference (optional)">
            <input
              name="approvalReference"
              value={approvalReference}
              onChange={(event) => setApprovalReference(event.target.value)}
              className={fieldControlClass}
              maxLength={120}
            />
          </Field>
          {feeType?.amountMode === "fixed" &&
          amountNumber !== feeType.defaultAmount ? (
            <div className="sm:col-span-2">
              <Field label="Reason for changing the standard amount" required>
                <input
                  name="overrideReason"
                  className={fieldControlClass}
                  placeholder="Explain the approved exception"
                  required
                  maxLength={255}
                />
              </Field>
            </div>
          ) : (
            <input type="hidden" name="overrideReason" value="" />
          )}
          <div className="sm:col-span-2">
          <Field label="Internal note (optional)">
              <textarea
                name="internalNote"
                className={cn(fieldControlClass, "min-h-20 py-3")}
                maxLength={255}
                placeholder="Visible to authorized school staff only"
              />
            </Field>
          </div>
        </div>
      </WorkflowStep>
      <WorkflowStep
        number="4"
        title="Select students"
        summary={`${selectedIds.length} selected · ${eligibleStudents.length} eligible`}
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              data-field="students"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder="Search student name or reference…"
              aria-label="Search eligible students by name or reference"
            />
          </label>
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <Filter className="size-4" />
              Filters
              <ChevronDown className="size-4" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-xl border border-border bg-card p-4 shadow-xl">
              <Field
                label={
                  audience === "basic"
                    ? "Grade and section"
                    : "Program, year, and section"
                }
              >
                <select
                  value={groupFilter}
                  onChange={(event) => setGroupFilter(event.target.value)}
                  className={fieldControlClass}
                >
                  <option value="all">All eligible groups</option>
                  {groupOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              {groupFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => setGroupFilter("all")}
                  className="mt-3 min-h-11 w-full rounded-lg border border-border text-sm font-semibold"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          </details>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            {visibleStudents.length} shown · maximum 500 per assignment
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectVisible}
              className="min-h-11 rounded-lg border border-border px-3 font-semibold"
            >
              Select all visible
            </button>
            {selectedIds.length ? (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="min-h-11 rounded-lg border border-border px-3 font-semibold"
              >
                Clear selection
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStudents.length ? (
            visibleStudents.map((student) => (
              <label
                key={student.id}
                className={cn(
                  "flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border p-3",
                  selectedSet.has(student.id)
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(student.id)}
                  onChange={() => toggle(student.id)}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {student.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {student.reference} · {student.groupLabel}
                  </span>
                </span>
              </label>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
              No eligible students match this context.
            </div>
          )}
        </div>
      </WorkflowStep>
      <WorkflowStep
        number="5"
        title="Review and assign"
        summary={`${selectedIds.length} students · ${money(total)}`}
      >
        <div className="grid gap-2 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Fee" value={feeType?.name ?? "Not selected"} />
          <Summary label="Charge" value={title || "Not entered"} />
          <Summary label="Due date" value={dueDate || "Not selected"} />
          <Summary label="Total charge" value={money(total)} />
        </div>
        {feeType && feeType.policy !== "mandatory" ? (
          <label className="mt-3 flex items-start gap-3 rounded-lg border border-status-warning-foreground/25 bg-status-warning-bg p-3 text-sm text-status-warning-foreground">
            <input
              name="applicabilityConfirmed"
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              required
            />
            <span>
              I confirm that every selected student is eligible for or opted in
              to this {feeType.policy} fee.
            </span>
          </label>
        ) : null}
      </WorkflowStep>
      <ActionMessage state={state} />
      <AdminButton
        type="submit"
        tone="primary"
        disabled={!canSubmit || !workspace.writable}
        className="w-full sm:w-auto"
      >
        <Receipt className="size-4" />
        {pending
          ? "Assigning safely…"
          : `Assign ${money(total)} to ${selectedIds.length} student${selectedIds.length === 1 ? "" : "s"}`}
      </AdminButton>
    </form>
  );
}

function WorkflowStep({
  number,
  title,
  summary,
  children,
}: {
  number: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-foreground">{title}</h3>
          <p className="truncate text-xs text-muted-foreground">{summary}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-foreground">
        {value}
      </div>
    </div>
  );
}
function ActionMessage({
  state,
}: {
  state: { status: string; message: string; reference?: string };
}) {
  if (state.status === "idle") return null;
  return (
    <div
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border p-3 text-sm font-semibold",
        state.status === "error"
          ? "border-status-danger-foreground/20 bg-status-danger-bg text-status-danger-foreground"
          : "border-status-success-foreground/20 bg-status-success-bg text-status-success-foreground",
      )}
    >
      {state.message}
      {state.reference ? (
        <span className="mt-1 block text-xs">Reference: {state.reference}</span>
      ) : null}
    </div>
  );
}
function suggestCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 40);
}
function useActionFieldFocus(state: { status: string; field?: string }) {
  useEffect(() => {
    if (state.status !== "error" || !state.field) return;
    const target = document.querySelector<HTMLElement>(
      `[name="${state.field}"], [data-field="${state.field}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }, [state.field, state.status]);
}
function money(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value || 0);
}
function labelValue(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function audienceChoices(
  scope: OtherFeeWorkspace["educationScope"],
  includeBoth: boolean,
) {
  const result: Array<{ value: string; label: string }> = [];
  if (scope !== "higher")
    result.push({ value: "basic", label: "Basic Education (K–12)" });
  if (scope !== "basic")
    result.push({ value: "higher", label: "Higher Education (College)" });
  if (includeBoth && scope === "both")
    result.push({ value: "both", label: "Both K–12 and College" });
  return result;
}
function audienceChoicesForFee(
  fee: OtherFeeTypeOption | null,
  scope: OtherFeeWorkspace["educationScope"],
) {
  return audienceChoices(scope, false).filter(
    (item) => !fee || fee.audience === "both" || fee.audience === item.value,
  );
}
