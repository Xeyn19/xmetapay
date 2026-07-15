"use client";

import { CalendarDays, Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  RegistrationTrendPreset,
  SuperAdminRegistrationTrendMeta,
  SuperAdminRegistrationTrendRow,
} from "@/lib/super-admin/records";

type SuperAdminRegistrationTrendChartProps = {
  rows: SuperAdminRegistrationTrendRow[];
  meta: SuperAdminRegistrationTrendMeta;
};

const presets: Array<{ value: RegistrationTrendPreset; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

export function SuperAdminRegistrationTrendChart({ rows, meta }: SuperAdminRegistrationTrendChartProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedPreset, setSelectedPreset] = useState<RegistrationTrendPreset>(meta.preset);
  const [customOpen, setCustomOpen] = useState(meta.preset === "custom");
  const [from, setFrom] = useState(meta.from);
  const [to, setTo] = useState(meta.to);
  const [customError, setCustomError] = useState("");
  const hasRegistrations = rows.some((row) => row.total > 0);

  function choosePreset(preset: RegistrationTrendPreset) {
    setSelectedPreset(preset);
    if (preset === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustomRange() {
    if (!from || !to || from > to) {
      setCustomError("Choose a valid start and end date.");
      return;
    }
    setCustomError("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("from", from);
    params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-black/[0.07] bg-[#f7f8fa] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ba3b8]">Registration view</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#0f1117]">
            <CalendarDays className="size-3.5 text-[#e64a19]" />
            {meta.label}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap gap-1 rounded-lg border border-black/[0.07] bg-white p-1" aria-label="Registration date range">
          {presets.map((preset) => {
            const active = selectedPreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => choosePreset(preset.value)}
                aria-pressed={active}
                className={`min-h-9 rounded-md px-3 text-[11.5px] font-semibold transition focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25 ${
                  active ? "bg-[#0f1117] text-white" : "text-[#5a6070] hover:bg-[#f1f2f5] hover:text-[#0f1117]"
                }`}
              >
                {active ? <Check className="mr-1 inline-block size-3" /> : null}
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {customOpen ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[#e64a19]/20 bg-[#fff8f5] p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="grid min-w-0 flex-1 gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#5a6070]">
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-h-10 rounded-md border border-black/[0.12] bg-white px-3 text-[12px] font-medium normal-case tracking-normal text-[#0f1117] outline-none focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10" />
          </label>
          <label className="grid min-w-0 flex-1 gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#5a6070]">
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-h-10 rounded-md border border-black/[0.12] bg-white px-3 text-[12px] font-medium normal-case tracking-normal text-[#0f1117] outline-none focus:border-[#e64a19] focus:ring-3 focus:ring-[#e64a19]/10" />
          </label>
          <button type="button" onClick={applyCustomRange} className="min-h-10 rounded-md bg-[#e64a19] px-4 text-[11.5px] font-bold text-white transition hover:bg-[#bf360c] focus:outline-none focus-visible:ring-3 focus-visible:ring-[#e64a19]/25">
            Apply dates
          </button>
          {customError ? <p className="basis-full text-[11px] font-semibold text-[#c62828]">{customError}</p> : null}
        </div>
      ) : null}

      {!hasRegistrations ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-black/[0.12] px-5 text-center text-[12.5px] text-[#5a6070]">
          No school admin registrations in this date range.
        </div>
      ) : (
        <div className="h-[300px] min-h-[240px] w-full min-w-0" role="img" aria-label={`School admin registrations from ${meta.label}, grouped by active, pending, and disabled status`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef0f4" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={18} tick={{ fill: "#5a6070", fontSize: 10, fontWeight: 600 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} tick={{ fill: "#5a6070", fontSize: 10 }} />
              <Tooltip
                cursor={{ fill: "rgba(230, 74, 25, 0.06)" }}
                contentStyle={{ border: "1px solid rgba(15,17,23,0.08)", borderRadius: 8, boxShadow: "0 12px 30px rgba(15,17,23,0.12)", fontSize: 12 }}
                labelStyle={{ color: "#111827", fontWeight: 700 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Bar dataKey="active" name="Active" stackId="registrations" fill="#43a047" radius={[3, 3, 0, 0]} />
              <Bar dataKey="pending" name="Pending" stackId="registrations" fill="#6a1b9a" />
              <Bar dataKey="disabled" name="Disabled" stackId="registrations" fill="#c62828" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
