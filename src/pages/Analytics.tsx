import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useJobs, useCustomers, getClientNameFromList } from "@/hooks/useSupabaseData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown, TrendingUp, Target, Activity } from "lucide-react";

type CutFilter = "all" | "trim" | "levelling" | "restoration";

const CUT_LABEL: Record<string, string> = {
  trim: "Taillage",
  levelling: "Nivelage",
  restoration: "Restauration",
};
function cutLabel(c: string | null | undefined): string {
  if (!c) return "—";
  return CUT_LABEL[c] ?? c;
}

/**
 * Granularité = un point par job complété, ordonné chronologiquement.
 * Justification : c'est la donnée la plus fine et la plus honnête disponible.
 * Agréger par semaine masquerait la dynamique au début (peu de données).
 * Chaque point représente un job avec son temps estimé vs réel.
 */

export default function Analytics() {
  const { data: jobs = [] } = useJobs();
  const { data: customers = [] } = useCustomers();
  const [cutFilter, setCutFilter] = useState<CutFilter>("all");

  // All completed jobs with full duration data — base dataset
  const allCompleted = useMemo(() => {
    return jobs
      .filter(
        (j) =>
          j.status === "completed" &&
          j.total_duration_minutes != null &&
          j.estimated_duration_minutes != null,
      )
      .sort((a, b) => {
        const da = a.scheduled_date || a.created_at;
        const db = b.scheduled_date || b.created_at;
        return new Date(da).getTime() - new Date(db).getTime();
      });
  }, [jobs]);

  // Counts per cut type (for the filter tabs)
  const counts = useMemo(() => {
    const c = { all: allCompleted.length, trim: 0, levelling: 0, restoration: 0 };
    for (const j of allCompleted) {
      if (j.cut_type === "trim") c.trim++;
      else if (j.cut_type === "levelling") c.levelling++;
      else if (j.cut_type === "restoration") c.restoration++;
    }
    return c;
  }, [allCompleted]);

  // Filtered dataset based on selected cut type — segmentation rule
  const completedJobs = useMemo(() => {
    if (cutFilter === "all") return allCompleted;
    return allCompleted.filter((j) => j.cut_type === cutFilter);
  }, [allCompleted, cutFilter]);

  const chartData = useMemo(() => {
    return completedJobs.map((j, idx) => {
      const dateStr = j.scheduled_date || j.created_at?.split("T")[0] || "";
      return {
        index: idx + 1,
        label: dateStr ? new Date(dateStr).toLocaleDateString("fr-CA", { month: "short", day: "numeric" }) : `#${idx + 1}`,
        client: getClientNameFromList(customers, j.client_id),
        cutType: j.cut_type,
        estimated: Math.round(j.estimated_duration_minutes ?? 0),
        real: Math.round(j.total_duration_minutes ?? 0),
        variance: Math.round((j.total_duration_minutes ?? 0) - (j.estimated_duration_minutes ?? 0)),
      };
    });
  }, [completedJobs, customers]);

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { avgVariance: 0, avgAccuracy: 0, trend: 0, trendDirection: "stable" as "up" | "down" | "stable" };
    }
    const totalAbsVariance = chartData.reduce((s, d) => s + Math.abs(d.variance), 0);
    const avgVariance = totalAbsVariance / chartData.length;

    // Accuracy = 1 - |variance| / real (capped 0-100%)
    const accuracies = chartData.map((d) => {
      if (d.real === 0) return 0;
      const acc = 1 - Math.abs(d.variance) / d.real;
      return Math.max(0, Math.min(1, acc)) * 100;
    });
    const avgAccuracy = accuracies.reduce((s, v) => s + v, 0) / accuracies.length;

    // Trend = compare first half vs second half avg |variance|
    let trendDirection: "up" | "down" | "stable" = "stable";
    let trend = 0;
    if (chartData.length >= 4) {
      const half = Math.floor(chartData.length / 2);
      const firstHalf = chartData.slice(0, half);
      const secondHalf = chartData.slice(half);
      const firstAvg = firstHalf.reduce((s, d) => s + Math.abs(d.variance), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, d) => s + Math.abs(d.variance), 0) / secondHalf.length;
      trend = firstAvg - secondAvg; // positive = improvement (variance decreased)
      if (Math.abs(trend) < 2) trendDirection = "stable";
      else if (trend > 0) trendDirection = "down"; // variance went down → improvement
      else trendDirection = "up";
    }

    return { avgVariance, avgAccuracy, trend, trendDirection };
  }, [chartData]);

  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h${String(min).padStart(2, "0")}` : `${min} min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Précision des estimations de durée — comparaison entre temps prévu et temps réel.
          </p>
        </div>
        <Tabs value={cutFilter} onValueChange={(v) => setCutFilter(v as CutFilter)}>
          <TabsList>
            <TabsTrigger value="all">
              Tous <Badge variant="secondary" className="ml-2">{counts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="trim">
              Taillage <Badge variant="secondary" className="ml-2">{counts.trim}</Badge>
            </TabsTrigger>
            <TabsTrigger value="levelling">
              Nivelage <Badge variant="secondary" className="ml-2">{counts.levelling}</Badge>
            </TabsTrigger>
            <TabsTrigger value="restoration">
              Restauration <Badge variant="secondary" className="ml-2">{counts.restoration}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {cutFilter === "all" && (counts.trim > 0 ? 1 : 0) + (counts.levelling > 0 ? 1 : 0) + (counts.restoration > 0 ? 1 : 0) > 1 && (
        <p className="text-xs text-muted-foreground -mt-2">
          ⚠ Vue combinée : les types de coupe ont des durées de référence très différentes. Filtre par type pour une analyse précise.
        </p>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Jobs analysés
            </CardDescription>
            <CardTitle className="text-3xl">{chartData.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">jobs complétés avec durée enregistrée</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Précision moyenne
            </CardDescription>
            <CardTitle className="text-3xl">{stats.avgAccuracy.toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Écart moyen : {formatMinutes(Math.round(stats.avgVariance))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {stats.trendDirection === "down" ? (
                <TrendingDown className="h-4 w-4 text-primary" />
              ) : stats.trendDirection === "up" ? (
                <TrendingUp className="h-4 w-4 text-destructive" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              Tendance
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.trendDirection === "down"
                ? "En amélioration"
                : stats.trendDirection === "up"
                  ? "À surveiller"
                  : "Stable"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {chartData.length < 4
                ? "Besoin d'au moins 4 jobs pour calculer la tendance"
                : `Variation : ${stats.trend > 0 ? "−" : "+"}${formatMinutes(Math.abs(Math.round(stats.trend)))} entre 1ʳᵉ et 2ᵉ moitié`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main chart */}
      <Card>
        <CardHeader>
          <CardTitle>Temps estimé vs temps réel</CardTitle>
          <CardDescription>
            Chaque point = un job complété, ordonné chronologiquement. Plus les deux lignes se rapprochent, meilleures sont les estimations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucun job complété avec durée enregistrée pour le moment.</p>
              <p className="text-xs mt-1">Complétez des jobs avec une heure de fin pour voir le graphique.</p>
            </div>
          ) : (
            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    label={{ value: "Minutes", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => {
                      const label = name === "estimated" ? "Estimé" : name === "real" ? "Réel" : name;
                      return [formatMinutes(value), label];
                    }}
                    labelFormatter={(label, payload) => {
                      const c = payload?.[0]?.payload?.client;
                      return c ? `${label} — ${c}` : label;
                    }}
                  />
                  <Legend
                    formatter={(value) => (value === "estimated" ? "Temps estimé" : "Temps réel")}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimated"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="real"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table of jobs */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail par job</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Client</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-right px-4 py-2">Estimé</th>
                    <th className="text-right px-4 py-2">Réel</th>
                    <th className="text-right px-4 py-2">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.slice().reverse().map((d) => (
                    <tr key={d.index} className="border-t border-border">
                      <td className="px-4 py-2 text-muted-foreground">{d.index}</td>
                      <td className="px-4 py-2">{d.label}</td>
                      <td className="px-4 py-2">{d.client}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">{cutLabel(d.cutType)}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMinutes(d.estimated)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMinutes(d.real)}</td>
                      <td className={cnVariance(d.variance)}>
                        {d.variance === 0
                          ? "0 min"
                          : (d.variance > 0 ? "+" : "−") + formatMinutes(Math.abs(d.variance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function cnVariance(v: number): string {
  const base = "px-4 py-2 text-right tabular-nums text-xs ";
  if (Math.abs(v) <= 5) return base + "text-muted-foreground";
  if (Math.abs(v) <= 15) return base + "text-foreground";
  return base + "text-destructive font-medium";
}
