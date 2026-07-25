"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { StatCategory } from "@/types/student";

interface StatRadarChartProps {
  stats: Record<StatCategory, number>;
}

export function StatRadarChart({ stats }: StatRadarChartProps) {
  const data = [
    { category: "Academic", value: stats.academic },
    { category: "Physical", value: stats.physical },
    { category: "Social", value: stats.charisma },
  ];

  return (
    <div className="h-56 w-full text-navy">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="var(--border)" strokeWidth={1} />
          <PolarAngleAxis dataKey="category" tick={{ fill: "currentColor", fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="currentColor" fill="currentColor" fillOpacity={0.25} strokeWidth={1} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
