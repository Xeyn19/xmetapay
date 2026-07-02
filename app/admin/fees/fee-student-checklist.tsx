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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return students;
    }

    return students.filter((student) => `${student.name} ${student.meta}`.toLowerCase().includes(normalizedQuery));
  }, [query, students]);
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

  return (
    <div className="space-y-2">
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-black/15 bg-white px-3 py-2 text-[12.5px] text-[#0f1117] focus-within:border-[#e64a19] focus-within:ring-3 focus-within:ring-[#e64a19]/10">
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
            {allVisibleSelected ? "Clear all" : "Select visible"}
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

      <div className="max-h-64 overflow-y-auto rounded-lg border border-black/[0.07] bg-white">
        {filteredStudents.length > 0 ? (
          <div className="divide-y divide-black/[0.07]">
            {filteredStudents.map((student) => (
              <label key={student.id} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition hover:bg-[#f7f8fa]">
                <input
                  type="checkbox"
                  name="studentIds"
                  value={student.id}
                  checked={selectedSet.has(student.id)}
                  onChange={() => toggleStudent(student.id)}
                  disabled={disabled}
                  className="mt-1 size-4 rounded border-black/20 text-[#e64a19] focus:ring-[#e64a19]/25"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-[#0f1117]">{student.name}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-[#5a6070]">{student.meta}</span>
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
        Select one or more enrolled students. Duplicate fee assignments are skipped safely.
      </p>
    </div>
  );
}
