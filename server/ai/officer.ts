// The officer asks the block a question ("Which schools in Tendukheda need help with maths, and
// who can show them?"). Claude answers as an agent with read-only tools over the block's data and
// the live pilot interviews — it looks things up instead of guessing. Guardrails keep only school
// names that really exist and require the answer to be based on at least one lookup.
import { betaZodOutputFormat, betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { contrastPairs, whatIf } from "../../src/engine/insights";
import { PRACTICE_IDS, PRACTICES, type PracticeId } from "../../src/engine/practices";
import type { PipelineState } from "../../src/engine/pipeline";
import { claudeUsable, describeError, getClient, MODEL, noteClaudeError } from "../claude";
import { db, now } from "../db";
import type { Check } from "./guardrails";
import { GEMINI_MODEL, geminiAvailable, geminiJson, geminiStep, type Block } from "./gemini";
import { SAFETY } from "./interviewer";

export interface OfficerAnswer {
  answer: string;
  schools: string[];
  next_step: string;
  owner: "BEO" | "CRP" | "Teacher" | "Jugnu AI" | null;
}

const AnswerSchema = z.object({
  answer: z.string().describe("2–5 sentences, plain language, numbers from the tools only"),
  schools: z.array(z.string()).describe("Exact school names the answer refers to"),
  next_step: z.string().describe("One concrete next step"),
  owner: z.enum(["BEO", "CRP", "Teacher", "Jugnu AI"]).nullable(),
});

const pct = (x: number) => Math.round(x);

function schoolRow(st: PipelineState, id: string) {
  const s = st.block.schools.find((x) => x.id === id)!;
  const last = s.reading.length - 1;
  const v = st.verify.find((x) => x.schoolId === id);
  const z = st.find.z[id] ?? [];
  return {
    name: s.name,
    cluster: s.clusterName,
    crp: s.crp,
    teacher: s.teacher,
    enrolment: s.enrolment,
    reading_pct: pct(s.reading[last]),
    maths_pct: pct(s.numeracy[last]),
    expected_reading_pct: pct(st.find.expected[id]?.reading[last] ?? 0),
    expected_maths_pct: pct(st.find.expected[id]?.numeracy[last] ?? 0),
    beats_expectation_sd: Math.round((z[z.length - 1] ?? 0) * 10) / 10,
    status: st.bright.includes(id) ? "verified school doing well" : v?.verdict === "inflation_suspected" ? "data may be inflated — revisit" : st.find.struggling.includes(id) ? "needs support" : st.find.candidates.includes(id) ? "candidate" : "ordinary",
  };
}

export function officerTools(st: PipelineState) {
  const byName = (name: string) => st.block.schools.find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) ?? st.block.schools.find((s) => s.name.toLowerCase().includes(name.trim().toLowerCase()));
  return [
    betaZodTool({
      name: "block_overview",
      description: "Counts for the whole block: schools, schools still to confirm, schools confirmed to be doing well, schools needing support, schools with doubtful data, distinctive methods, action status.",
      inputSchema: z.object({}),
      run: () =>
        JSON.stringify({
          block: `${st.block.name}, ${st.block.district}, ${st.block.state}`,
          data: st.block.source,
          schools: st.block.schools.length,
          still_to_confirm: st.find.candidates.length,
          confirmed_doing_well: st.bright.length,
          needs_support: st.find.struggling.length,
          data_doubtful: st.verify.filter((v) => v.verdict === "inflation_suspected").length,
          distinctive_practices: st.evidence.filter((e) => e.verdict === "distinctive").map((e) => PRACTICES[e.practice].label),
          actions: Object.fromEntries(["todo", "scheduled", "done", "stuck"].map((k) => [k, st.recs.flatMap((r) => r.actions).filter((a) => a.status === k).length])),
        }),
    }),
    betaZodTool({
      name: "find_schools",
      description: "List schools by status and/or cluster with their latest reading/maths %, expected %, and how far they beat expectation.",
      inputSchema: z.object({
        status: z.enum(["any", "doing_well", "to_confirm", "needs_support", "data_doubtful"]).default("any"),
        cluster: z.string().optional().describe("Cluster name, e.g. Tendukheda"),
        limit: z.number().int().min(1).max(40).default(15),
      }),
      run: ({ status, cluster, limit }) => {
        let ids = st.block.schools.map((s) => s.id);
        if (status === "doing_well") ids = st.bright;
        if (status === "to_confirm") ids = st.find.candidates;
        if (status === "needs_support") ids = st.find.struggling;
        if (status === "data_doubtful") ids = st.verify.filter((v) => v.verdict === "inflation_suspected").map((v) => v.schoolId);
        const rows = ids.map((id) => schoolRow(st, id)).filter((r) => !cluster || r.cluster.toLowerCase().includes(cluster.toLowerCase()));
        return JSON.stringify({ count: rows.length, schools: rows.slice(0, limit) });
      },
    }),
    betaZodTool({
      name: "school_detail",
      description: "Everything about one school: scores vs expectation, verification checks, its recommendation, teacher who can show it, actions and interview quotes.",
      inputSchema: z.object({ name: z.string() }),
      run: ({ name }) => {
        const s = byName(name);
        if (!s) return JSON.stringify({ error: `No school named "${name}" in this block` });
        const rec = st.recs.find((r) => r.schoolId === s.id);
        const demo = rec && st.block.schools.find((x) => x.id === rec.demonstratorId);
        return JSON.stringify({
          ...schoolRow(st, s.id),
          verification: st.verify.find((v) => v.schoolId === s.id)?.checks ?? null,
          recommendation: rec ? { practice: PRACTICES[rec.practice].label, why: rec.why, demonstrator: demo?.name, distance_km: rec.distanceKm, wave: rec.wave } : null,
          actions: rec?.actions.map((a) => ({ task: a.task, owner: `${a.owner} (${a.ownerRole})`, due_day: a.due, status: a.status, note: a.note })) ?? [],
          interview_quotes: st.interviews.find((i) => i.schoolId === s.id)?.mentions.map((m) => ({ practice: PRACTICES[m.practice].label, quote: m.quote })) ?? [],
        });
      },
    }),
    betaZodTool({
      name: "practice_evidence",
      description: "For every coded method: how many interviews from schools doing well vs similar schools describe it specifically, probability it is distinctive, verdict, and example quotes.",
      inputSchema: z.object({}),
      run: () =>
        JSON.stringify(
          st.evidence.map((e) => ({
            practice: PRACTICES[e.practice].label,
            doing_well: `${e.bright.k}/${e.bright.n}`,
            similar_schools: `${e.comparison.k}/${e.comparison.n}`,
            p_distinctive: Math.round(e.pDistinctive * 100) / 100,
            verdict: e.verdict,
            cost: PRACTICES[e.practice].cost,
            quotes: e.quotes.slice(0, 2).map((q) => q.quote),
          })),
        ),
    }),
    betaZodTool({
      name: "action_board",
      description: "Actions from the spread plan, filterable by status and owner role.",
      inputSchema: z.object({ status: z.enum(["any", "todo", "scheduled", "done", "stuck"]).default("any"), owner_role: z.enum(["any", "CRP", "BEO", "Jugnu AI", "Teacher"]).default("any") }),
      run: ({ status, owner_role }) => {
        const rows = st.recs.flatMap((r) =>
          r.actions
            .filter((a) => (status === "any" || a.status === status) && (owner_role === "any" || a.ownerRole === owner_role))
            .map((a) => ({ school: st.block.schools.find((s) => s.id === r.schoolId)?.name, task: a.task, owner: a.owner, role: a.ownerRole, due_day: a.due, status: a.status, note: a.note })),
        );
        return JSON.stringify({ count: rows.length, actions: rows.slice(0, 40) });
      },
    }),
    betaZodTool({
      name: "pilot_interviews",
      description: "Real interviews from the live pilot (web voice calls and phone calls): who, status, and the methods coded from them with verbatim quotes.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(30).default(10) }),
      run: async ({ limit }) => {
        const rows = await db.all<Record<string, string>>(`SELECT id, school_name, teacher_name, channel, status, created_at FROM interviews ORDER BY created_at DESC LIMIT ?`, limit);
        const coded = rows.length
          ? await db.all<Record<string, string>>(
              `SELECT interview_id, COALESCE(practice, new_name) practice, quote FROM codings WHERE grounded = 1 AND interview_id IN (${rows.map(() => "?").join(",")}) ORDER BY id`,
              ...rows.map((r) => r.id),
            )
          : [];
        return JSON.stringify(
          rows.map((r) => ({
            ...r,
            practices: coded
              .filter((c) => c.interview_id === r.id)
              .slice(0, 6)
              .map(({ practice, quote }) => ({ practice, quote })),
          })),
        );
      },
    }),
    betaZodTool({
      name: "contrast_pairs",
      description: "Each verified school doing well beside the ordinary school most like it (matched on context), how far each is above or below expectation, what they have in common, and what each teacher said about every method. Use for 'what does X do that similar schools don't?'.",
      inputSchema: z.object({ school: z.string().optional().describe("Only the pair for this school doing well"), limit: z.number().int().min(1).max(12).default(4) }),
      run: ({ school, limit }) => {
        const name = (id: string) => st.block.schools.find((s) => s.id === id)?.name ?? id;
        const target = school ? byName(school)?.id : null;
        const pairs = contrastPairs(st).filter((p) => !target || p.bright.schoolId === target || p.comparison.schoolId === target);
        if (!pairs.length) return school ? `${school} is not a verified school doing well or its match.` : "No interviewed schools doing well yet, so there are no pairs.";
        return JSON.stringify(
          pairs.slice(0, limit).map((p) => ({
            school_doing_well: name(p.bright.schoolId),
            above_expected_pts: p.bright.aboveExpected,
            matched_with: name(p.comparison.schoolId),
            match_above_expected_pts: p.comparison.aboveExpected,
            alike: p.alike,
            road_km_apart: p.roadKm,
            practices: p.practices.map((x) => ({ practice: PRACTICES[x.practice].label, distinctive: x.distinctive, doing_well_said: x.bright, match_said: x.comparison })),
          })),
        );
      },
    }),
    betaZodTool({
      name: "what_if",
      description: "Estimate what happens if CRPs spread one method to chosen schools this fortnight: classroom visits that fit in CRP time, expected adopters, change in Grade 3 proficiency (points, 90% range) and children reached, with every assumption. Defaults to the schools needing support.",
      inputSchema: z.object({
        practice: z.enum(PRACTICE_IDS as [PracticeId, ...PracticeId[]]),
        schools: z.array(z.string()).max(60).optional().describe("School names; omit for all schools needing support"),
        crps: z.number().int().min(0).max(30).default(3),
        days_each: z.number().int().min(1).max(10).default(3).describe("CRP days per person given to classroom visits"),
      }),
      run: ({ practice, schools, crps, days_each }) => {
        const ids = schools?.length ? schools.map((n) => byName(n)?.id).filter((x): x is string => Boolean(x)) : st.find.struggling;
        if (!ids.length) return "None of those names are schools in this block.";
        const r = whatIf(st, { practice, schoolIds: ids, crps, daysEach: days_each });
        return JSON.stringify({ ...r, practice: PRACTICES[practice].label, perSchool: undefined, unvisited: r.perSchool.filter((p) => !p.visited).length });
      },
    }),
  ];
}

/** Rule-based answers for the most common questions, used when Claude is unavailable. */
export function offlineAnswer(question: string, st: PipelineState): OfficerAnswer {
  const q = question.toLowerCase();
  const names = (ids: string[]) => ids.map((id) => st.block.schools.find((s) => s.id === id)!.name);
  if (/inflat|fake|गलत|बढ़ा/.test(q)) {
    const ids = st.verify.filter((v) => v.verdict === "inflation_suspected").map((v) => v.schoolId);
    return { answer: `${ids.length} schools reported results that a 15-child confirmation visit did not support. They should be revisited respectfully, not penalised.`, schools: names(ids).slice(0, 8), next_step: "Schedule a second confirmation visit with a different CRP.", owner: "BEO" };
  }
  if (/stuck|अटक|barrier|रुका/.test(q)) {
    const rows = st.recs.flatMap((r) => r.actions.filter((a) => a.status === "stuck").map(() => r.schoolId));
    return { answer: `${rows.length} actions are stuck and need the BEO.`, schools: names([...new Set(rows)]).slice(0, 8), next_step: "Open the action board and clear the stuck items first.", owner: "BEO" };
  }
  if (/practice|what works|तरीक|क्या काम/.test(q)) {
    const d = st.evidence.filter((e) => e.verdict === "distinctive");
    return { answer: d.length ? `Methods that separate schools doing well here: ${d.map((e) => PRACTICES[e.practice].label).join("; ")}.` : "No method is distinctive yet — more interviews are needed.", schools: [], next_step: "Review the method cards before they are sent.", owner: "CRP" };
  }
  if (/help|support|struggl|पीछे|कमज़ोर|कमजोर|math|गणित|reading|पढ़/.test(q)) {
    const school = (id: string) => st.block.schools.find((s) => s.id === id)!;
    const maths = /math|गणित/.test(q);
    const reading = /reading|पढ़/.test(q);
    const score = (id: string) => (maths ? school(id).numeracy : school(id).reading).at(-1) ?? 0;
    const top = [...st.recs].sort((a, b) => score(a.schoolId) - score(b.schoolId)).slice(0, 5);
    const pairs = top.map((r) => {
      const d = school(r.demonstratorId);
      return `${school(r.schoolId).name}${maths || reading ? ` (${Math.round(score(r.schoolId))}%)` : ""} can learn from ${d.teacher} at ${d.name}, ${r.distanceKm.toFixed(1)} km away`;
    });
    const scope = maths ? ", lowest in maths first" : reading ? ", lowest in reading first" : "";
    return { answer: `${st.find.struggling.length} schools are below what their context predicts. Start with these${scope}: ${pairs.join("; ")}.`, schools: top.map((r) => school(r.schoolId).name), next_step: "Confirm group 1 classroom visits with the CRPs.", owner: "CRP" };
  }
  return { answer: `${st.bright.length} schools confirmed to be doing well and ${st.find.struggling.length} schools needing support in ${st.block.name}.`, schools: names(st.bright).slice(0, 8), next_step: "Ask about a cluster, a school, or what works.", owner: null };
}

export function guardAnswer(out: OfficerAnswer, st: PipelineState, toolCalls: number) {
  const real = new Set(st.block.schools.map((s) => s.name));
  const kept = out.schools.filter((n) => real.has(n));
  const checks: Check[] = [
    { name: "names only real schools", passed: kept.length === out.schools.length, detail: kept.length < out.schools.length ? `dropped: ${out.schools.filter((n) => !real.has(n)).join(", ")}` : undefined },
    { name: "answer based on a data lookup", passed: toolCalls > 0, detail: `${toolCalls} tool call(s)` },
  ];
  return { value: { ...out, schools: kept }, checks, accept: toolCalls > 0 };
}

type RunnableTool = { name: string; description?: string; input_schema?: unknown; parse: (x: unknown) => unknown; run: (x: never) => unknown };

/** Gemini looks things up with the officer's tools, then writes the answer in the schema from what they returned. */
async function geminiAnswer(question: string, st: PipelineState, system: string, used: string[]) {
  const server = officerTools(st) as unknown as RunnableTool[];
  const convo: { role: "user" | "assistant"; content: string | Block[] }[] = [{ role: "user", content: question }];
  const found: string[] = [];
  for (let step = 0; step < 6; step++) {
    const blocks = await geminiStep(system, convo, server);
    convo.push({ role: "assistant", content: blocks });
    const uses = blocks.filter((b) => b.type === "tool_use");
    if (!uses.length) break;
    const results = await Promise.all(
      uses.map(async (u): Promise<Block> => {
        used.push(u.name ?? "");
        const tool = server.find((t) => t.name === u.name);
        const out = tool ? await tool.run(tool.parse(u.input) as never) : `Unknown tool ${u.name}`;
        const text = typeof out === "string" ? out : JSON.stringify(out);
        found.push(`${u.name}: ${text}`);
        return { type: "tool_result", tool_use_id: u.id, content: text };
      }),
    );
    convo.push({ role: "user", content: results });
  }
  const { output } = await geminiJson({ system, content: `Question: ${question}\n\nWhat the lookups returned:\n${found.join("\n").slice(0, 30000)}\n\nAnswer from these results only.`, schema: AnswerSchema, maxTokens: 4000 });
  return guardAnswer(output, st, used.length);
}

export async function askOfficer(question: string, st: PipelineState) {
  const started = Date.now();
  const log = (source: string, model: string | null, usage: { i: number; o: number } | null, checks: Check[], ok: boolean, error: string | null) =>
    db
      .run(
        `INSERT INTO ai_calls (task, ref, source, model, latency_ms, input_tokens, output_tokens, checks, ok, error, created_at) VALUES ('officer.ask', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        question.slice(0, 80), source, model, Date.now() - started, usage?.i ?? null, usage?.o ?? null, JSON.stringify(checks), ok ? 1 : 0, error, now(),
      )
      .catch((e) => console.error("ai_calls trace failed:", e));
  const system = `${SAFETY}
You brief a Block Education Officer about their block. Look things up with the tools before answering; never guess numbers or names.
Name schools exactly as the tools return them. Recommend one concrete next step with an owner. If the data cannot answer, say which check would.
Never shame or rank teachers; a score that looks too high means "revisit respectfully".`;
  const tools: string[] = [];
  // The same question with Gemini: the same tools and the same guardrails, then the rule-based answer.
  const backup = async (why: string | null) => {
    if (!geminiAvailable()) {
      await log("offline", null, null, [], true, why);
      return { source: "offline" as const, ...offlineAnswer(question, st), checks: [] as Check[], tools, ...(why ? { warning: why } : {}) };
    }
    try {
      const { value, checks, accept } = await geminiAnswer(question, st, system, tools);
      await log("gemini", GEMINI_MODEL, null, checks, accept, accept ? why : "rejected by guardrails");
      if (accept) return { source: "gemini" as const, ...value, checks, tools };
      return { source: "offline" as const, ...offlineAnswer(question, st), checks, tools, warning: "The model answered without looking anything up — used the offline engine" };
    } catch (error) {
      const msg = describeError(error);
      await log("gemini", GEMINI_MODEL, null, [], false, msg);
      return { source: "offline" as const, ...offlineAnswer(question, st), checks: [] as Check[], tools, warning: why ?? msg };
    }
  };
  if (!claudeUsable()) return backup(null);
  try {
    const runner = getClient().beta.messages.toolRunner(
      {
        model: MODEL,
        max_tokens: 8000,
        max_iterations: 8,
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: betaZodOutputFormat(AnswerSchema) },
        system,
        messages: [{ role: "user", content: question }],
        tools: officerTools(st),
      },
      { signal: AbortSignal.timeout(60000) },
    );
    // Each iteration yields one assistant message; tool_use blocks show which lookups were made.
    // Every iteration is billed, so add up the usage of all of them, not just the last.
    let final: Awaited<typeof runner> | null = null;
    const used = { i: 0, o: 0 };
    for await (const message of runner) {
      for (const b of message.content) if (b.type === "tool_use") tools.push(b.name);
      used.i += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
      used.o += message.usage.output_tokens;
      final = message;
    }
    if (!final) throw new Error("Officer agent returned no message");
    const text = final.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const parsed = AnswerSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("Officer answer did not match the schema");
    const { value, checks, accept } = guardAnswer(parsed.data, st, tools.length);
    await log("claude", final.model, used, checks, accept, accept ? null : "rejected by guardrails");
    if (!accept) return { source: "offline" as const, ...offlineAnswer(question, st), checks, tools, warning: "Claude answered without looking anything up — used the offline answer" };
    return { source: "claude" as const, ...value, checks, tools };
  } catch (error) {
    noteClaudeError(error);
    const msg = describeError(error);
    await log("claude", null, null, [], false, msg);
    return backup(msg);
  }
}
