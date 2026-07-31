"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export interface DailyImportPoint {
  date: string;
  count: number;
}

export interface DistrictCostPoint {
  district: string;
  avgCost: number;
}

interface TrendsLabels {
  title: string;
  desc: string;
  imports: string;
  importsEmpty: string;
  costs: string;
  costsEmpty: string;
}

export function TrendsCard({
  imports,
  districtCosts,
  labels,
}: {
  imports: DailyImportPoint[];
  districtCosts: DistrictCostPoint[];
  labels: TrendsLabels;
}) {
  const hasImports = imports.some((d) => d.count > 0);
  const hasCosts = districtCosts.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <CardDescription>{labels.desc}</CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {labels.imports}
          </p>
          {hasImports ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={imports}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={20}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="var(--color-primary)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text={labels.importsEmpty} />
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {labels.costs}
          </p>
          {hasCosts ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={districtCosts}>
                <XAxis
                  dataKey="district"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip formatter={(v) => [`€${v}`, "Avg. cost"]} />
                <Bar
                  dataKey="avgCost"
                  fill="var(--color-chart-2)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text={labels.costsEmpty} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
      {text}
    </div>
  );
}
