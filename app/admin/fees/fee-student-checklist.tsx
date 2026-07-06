"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Search, Square, X } from "lucide-react";

import type { AdminFeeSetupData } from "@/lib/fees/records";

import { AdminButton } from "../_components/admin-ui";

type StudentOption = AdminFeeSetupData["students"][number];

export function FeeStudentChecklist({
  students,
  disabled,
}: {
  students: StudentOption[];
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const gradeOptions = useMemo(() => uniqueValues(students.map((student) => student.gradeName)), [students]);
  const sectionOptions = useMemo(() => {
    const source = grade === "all" ? students : students.filter((student) => student.gradeName === grade);

    return uniqueValues(source.map((student) => student.sectionName).filter(Boolean) as string[]);
  }, [grade, students]);
  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return students.filter((student) => {
      const matchesGrade = grade === "all" || student.gradeName === grade;
      const matchesSection = section === "all" || student.sectionName === section;
      const matchesQuery = !normalizedQuery || `${student.name} ${student.meta}`.toLowerCase().includes(normalizedQuery);

      return matchesGrade && matchesSection && matchesQuery;
    });
  }, [grade, query, section, students]);
  const visibleIds = filteredStudents.map((student) => student.id);
  const selectedSet = new Set(selectedIds);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggleStudent = (studentId: number) => {
    setSelectedIds((current) => (
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    ));
  };
  const selectVisible = () => {
    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  };
  const clearSelected = () => setSelectedIds([]);
  const onGradeChange = (value: string) => {
    setGrade(value);
    setSection("all");
  };

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2 min-[560px]:grid-cols-2">
        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
          Grade
          <select
            value={grade}
            onChange={(event) => onGradeChange(event.target.value)}
            disabled={disabled || students.length === 0}
            className="min-h-11 rounded-lg border border-black/15 bg-white px-3 text-[13px] font-semibold normal-case tracking-normal text-[#0f1117] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10 disabled:bg-[#f2f4f7] disabled:text-[#9ba3b8]"
          >
            <option value="all">All grades</option>
            {gradeOptions.map((gradeName) => (
              <option key={gradeName} value={gradeName}>
                {gradeName}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#5a6070]">
          Section
          <select
            value={section}
            onChange={(event) => setSection(event.target.value)}
            disabled={disabled || students.length === 0 || sectionOptions.length === 0}
            className="min-h-11 rounded-lg border border-black/15 bg-white px-3 text-[13px] font-semibold normal-case tracking-normal text-[#0f1117] outline-none transition focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10 disabled:bg-[#f2f4f7] disabled:text-[#9ba3b8]"
          >
            <option value="all">All sections</option>
            {sectionOptions.map((sectionName) => (
              <option key={sectionName} value={sectionName}>
                {sectionName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex min-h-12 items-center gap-2 rounded-lg border border-black/15 bg-[#f7f8fa] px-3 py-2 text-[12.5px] text-[#0f1117] focus-within:border-[#e64a19] focus-within:ring-3 focus-within:ring-[#e64a19]/10">
        <Search className="size-4 shrink-0 text-[#9ba3b8]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#9ba3b8]"
          placeholder="Search enrolled students..."
          disabled={disabled || students.length === 0}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11.5px] font-medium text-[#5a6070]">
          {selectedIds.length} selected
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton
            type="button"
            tone="ghost"
            className="min-h-9 px-2.5 text-[11.5px]"
            onClick={allVisibleSelected ? clearSelected : selectVisible}
            disabled={disabled || visibleIds.length === 0}
          >
            {allVisibleSelected ? <Square className="size-3.5" /> : <CheckSquare className="size-3.5" />}
            {allVisibleSelected ? "Clear matching" : "Select matching"}
          </AdminButton>
          <AdminButton
            type="button"
            tone="ghost"
            className="min-h-9 px-2.5 text-[11.5px]"
            onClick={clearSelected}
            disabled={disabled || selectedIds.length === 0}
          >
            <X className="size-3.5" />
            Clear
          </AdminButton>
        </div>
      </div>

      <div className="max-h-[260px] min-h-[132px] overflow-y-auto rounded-lg border border-black/[0.07] bg-white">
        {filteredStudents.length > 0 ? (
          <div className="divide-y divide-black/[0.07]">
            {filteredStudents.map((student) => (
              <label key={student.id} className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-[#f7f8fa]">
                <input
                  type="checkbox"
                  name="studentIds"
                  value={student.id}
                  checked={selectedSet.has(student.id)}
                  onChange={() => toggleStudent(student.id)}
                  disabled={disabled}
                  className="size-4 shrink-0 rounded border-black/20 text-[#e64a19] focus:ring-[#e64a19]/25"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-[#0f1117]">{student.name}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] leading-5 text-[#5a6070]">{student.meta}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="px-3 py-5 text-center text-[12.5px] text-[#5a6070]">
            {students.length === 0 ? "No enrolled students available." : "No students match your search."}
          </div>
        )}
      </div>

      <p className="text-[11.5px] leading-5 text-[#5a6070]">
        Use filters to assign this fee by grade, section, or selected students. Duplicate assignments are skipped safely.
      </p>
    </div>
  );
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
