"use client";

import { continuedAsViewer, eliminationTimeline, overview, perQuestion } from "@/lib/quizAnalytics";
import type { RoomState } from "@/lib/quizProtocol";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/**
 * Inline live analytics for a room, shown directly on the host lobby page.
 * Derived from the live RoomState via pure selectors, so it updates in real
 * time. Built from shadcn Tabs + Table + Card.
 */
export default function AnalyticsPanel({ state }: { state: RoomState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live stats</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="perq">Per-question</TabsTrigger>
            <TabsTrigger value="elim">Eliminations</TabsTrigger>
            <TabsTrigger value="viewers">Play-along</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab state={state} />
          </TabsContent>
          <TabsContent value="perq">
            <PerQuestionTab state={state} />
          </TabsContent>
          <TabsContent value="elim">
            <EliminationsTab state={state} />
          </TabsContent>
          <TabsContent value="viewers">
            <PlayAlongTab state={state} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StatCard({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: "neutral" | "emerald" | "red";
}) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-white",
    emerald: "border-emerald-500/25 bg-emerald-950/30 text-emerald-300",
    red: "border-red-500/25 bg-red-950/30 text-red-300",
  } as const;
  return (
    <div className={`rounded-lg border px-3 py-3 ${tones[tone]}`}>
      <p className="font-mono text-2xl">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/55">{label}</p>
    </div>
  );
}

function OverviewTab({ state }: { state: RoomState }) {
  const o = overview(state);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard value={o.survivors} label="still in" tone="emerald" />
      <StatCard value={o.scoredTotal} label="players" />
      <StatCard value={`${o.answeredThisQ}/${o.survivors}`} label="answered this Q" />
      <StatCard value={`Q${o.currentQ + 1}/${o.totalQuestions}`} label="current question" />
      <StatCard value={o.unscoredTotal} label="playing along" />
      <StatCard value={o.viewers} label="watching" />
    </div>
  );
}

function PerQuestionTab({ state }: { state: RoomState }) {
  const rows = perQuestion(state);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Q</TableHead>
          <TableHead>Answered</TableHead>
          <TableHead>Correct</TableHead>
          <TableHead>Eliminated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.idx}>
            <TableCell className="font-mono text-white">Q{r.idx + 1}</TableCell>
            <TableCell className="text-white/80">{r.answered}</TableCell>
            <TableCell className="text-emerald-300/90">{r.correct}</TableCell>
            <TableCell className="text-red-300/80">{r.eliminated}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EliminationsTab({ state }: { state: RoomState }) {
  const buckets = eliminationTimeline(state);
  if (buckets.length === 0) return <p className="text-sm text-white/55">No eliminations yet.</p>;
  return (
    <div className="space-y-4">
      {buckets.map((b) => (
        <div key={b.idx}>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-red-300/80">
            Q{b.idx + 1} · {b.names.length} out
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {b.names.map((n, i) => (
              <Badge key={`${n}-${i}`} variant="danger" className="normal-case tracking-normal">
                {n}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayAlongTab({ state }: { state: RoomState }) {
  const rows = continuedAsViewer(state);
  if (rows.length === 0) return <p className="text-sm text-white/55">Nobody is playing along unscored.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Origin</TableHead>
          <TableHead>Reached</TableHead>
          <TableHead>Correct</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium text-white">{r.name}</TableCell>
            <TableCell className="text-white/65">
              {r.origin === "continued" ? `out Q${(r.continuedAtQ ?? 0) + 1}, continued` : "viewer"}
            </TableCell>
            <TableCell className="font-mono text-white">
              {r.virtualDepth == null ? "—" : `Q${r.virtualDepth + 1}`}
            </TableCell>
            <TableCell className="text-emerald-300/90">{r.unscoredCorrect}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
