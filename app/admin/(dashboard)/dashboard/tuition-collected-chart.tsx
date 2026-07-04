"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BarRow } from "@/lib/admin/real-data";

type TuitionCollectedChartProps = {
  rows: BarRow[];
};

export function TuitionCollectedByGradeChart({ rows }: TuitionCollectedChartProps) {
  const chartRows = rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));

  return (
    <div className="h-[260px] min-h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="#eef0f4" />
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            width={78}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#4d5565", fontSize: 12, fontWeight: 600 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(230, 74, 25, 0.08)" }}
            contentStyle={{
              border: "1px solid rgba(15,17,23,0.08)",
              borderRadius: 8,
              boxShadow: "0 12px 30px rgba(15,17,23,0.12)",
              fontSize: 12,
            }}
            formatter={(_, __, item) => [item.payload.value, "Collected"]}
            labelStyle={{ color: "#111827", fontWeight: 700 }}
          />
          <Bar dataKey="amount" fill="#ee4415" radius={[0, 6, 6, 0]} barSize={10}>
            <LabelList dataKey="value" position="right" className="fill-[#111827] text-[11px] font-bold" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
