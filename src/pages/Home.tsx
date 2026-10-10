import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Clapperboard, Handshake, LineChart, MapPinned, Mic, Stars } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ASER_2024 } from "../engine/block";
import { HeroMedia, TutorialPlayer, VideoCard } from "../components/media";
import { Fireflies, Glass, SectionTitle } from "../components/ui";
import { MEDIA, TOUR } from "../lib/clips";
import { usePrefs } from "../lib/prefs";
import { usePipeline } from "../lib/store";

const Block3D = lazy(() => import("../components/Block3D"));

const LOOP = [
  { icon: MapPinned, title: "Find", text: "Model what each school should score given its context. Flag schools that beat it in 2 of 3 years." },
  { icon: BadgeCheck, title: "Verify", text: "Catch inflated data: consistency checks + a 15-minute spot check of 15 children by the cluster resource person." },
  { icon: Mic, title: "Ask", text: "An AI voice interviewer calls bright-spot teachers — and similar ordinary schools — in their language, for concrete routines." },
  { icon: Stars, title: "Contrast", text: "Keep only practices that are specific to bright spots, cost nothing extra, and are described in concrete detail." },
  { icon: Handshake, title: "Spread", text: "Sideways, not top-down: a voice note in the demonstrator's own words, a peer visit a few km away, owned actions." },
  { icon: LineChart, title: "Track", text: "Follow-up calls, then wave 1 vs wave 2 at the next assessment — the block learns which practices actually transfer." },
];

export default function HomePage({ onTour }: { onTour: () => void }) {
  const { state } = usePipeline();
  const { lite } = usePrefs();
  const [clip, setClip] = useState<number | null>(null);
  const verified = state.verify.filter((v) => v.verdict === "verified").length;
  const distinctive = state.evidence.filter((e) => e.verdict === "distinctive").length;
  const meanZ = useMemo(() => Object.fromEntries(state.block.schools.map((s) => [s.id, state.find.z[s.id].reduce((a, b) => a + b, 0) / state.find.z[s.id].length])), [state]);

  return (
    <div className="space-y-10">
      <HeroMedia video={MEDIA.hero} className="min-h-[660px]">
        <Fireflies count={24} />
        <div className="grid min-h-[660px] items-center gap-6 p-6 md:p-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chip mb-5 w-fit">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" /> AI for Foundational Learning · Challenge 4 · Data to action
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-5xl font-bold leading-[0.98] md:text-7xl">
              The answer to a block's learning gap is often <span className="gradient-text">already in the block.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-6 max-w-xl text-base text-white/80 md:text-lg">
              Dashboards tell a Block Education Officer <b className="text-white">where</b> learning is low. Jugnu finds the teachers who — with the same poverty, languages and staff shortages — already get children reading and
              counting, learns <b className="text-white">exactly what they do</b> by calling them, spreads it teacher-to-teacher, and checks it worked.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
              <button className="btn btn-primary !px-5 !py-3 text-base" onClick={onTour}>
                <Clapperboard size={18} /> Watch the tour
              </button>
              <Link to="/find" className="btn btn-glass !px-5 !py-3 text-base">
                Find the fireflies <ArrowRight size={16} />
              </Link>
              <Link to="/ask" className="btn btn-glass !px-5 !py-3 text-base">
                <Mic size={16} /> Take an AI interview
              </Link>
            </motion.div>
            <div className="mt-8 grid max-w-xl grid-cols-4 gap-2">
              {[
                [state.block.schools.length, "schools"],
                [verified, "bright spots"],
                [state.interviews.length, "interviews"],
                [distinctive, "practices"],
              ].map(([n, t]) => (
                <div key={String(t)} className="glass-inset px-3 py-2">
                  <div className="font-display text-2xl font-bold gradient-text tabular-nums">{n}</div>
                  <div className="text-[11px] text-[var(--color-ink-2)]">{t}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-[440px] md:h-[560px]">
            {lite ? (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-[var(--color-ink-3)]">
                <Fireflies count={18} />
                Low-data mode: the 3D block is off. Turn it on with the ⚡ button.
              </div>
            ) : (
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-[var(--color-ink-3)]">Loading 3D block…</div>}>
              <Block3D
                className="h-full w-full"
                schools={state.block.schools}
                z={meanZ}
                bright={new Set(state.bright)}
                struggling={new Set(state.find.struggling)}
                inflated={new Set(state.verify.filter((v) => v.verdict === "inflation_suspected").map((v) => v.schoolId))}
              />
            </Suspense>
            )}
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-center text-xs text-white/60">Live 3D block · pillar height = results vs expectation · drag to orbit</div>
          </div>
        </div>
      </HeroMedia>

      <section>
        <SectionTitle
          eyebrow="See it in action"
          title="One loop, every term"
          sub="Hover to preview, click to watch with captions. Clips generated with Google Flow (Veo 3.1)."
          right={
            <button className="btn btn-glass" onClick={onTour}>
              <Clapperboard size={16} /> Play all
            </button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOUR.slice(1).map((c, i) => (
            <VideoCard key={c.src} clip={c} index={i} onOpen={() => setClip(i + 1)} />
          ))}
        </div>
        <TutorialPlayer clips={TOUR} open={clip !== null} start={clip ?? 0} onClose={() => setClip(null)} />
      </section>

      <section>
        <SectionTitle eyebrow="The loop" title="Find → Verify → Ask → Contrast → Spread → Track" />
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {LOOP.map(({ icon: Icon, title, text }, i) => (
            <Glass key={title} className="glass-hover p-5" delay={0.04 * i}>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-200/15 text-sm font-bold text-amber-100">{i + 1}</span>
                <Icon size={18} className="text-[var(--a1)]" aria-hidden />
              </div>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-1 text-sm text-[var(--color-ink-2)]">{text}</p>
            </Glass>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Glass className="p-6">
          <SectionTitle eyebrow="Why nothing does this today" title="Dashboards say where. Nobody says what — from local proof." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-ink-3)]">
                  <th className="pb-2">Today</th>
                  <th className="pb-2">What it gives</th>
                  <th className="pb-2">What is missing</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["State command centres (VSK, EMIS)", "where learning is low", "what to do about it"],
                  ["Cascade training", "the same module for everyone", "dilutes at every level; not local"],
                  ["NCERT innovative practices", "~60 write-ups a year", "not outcome-verified, not spread"],
                  ["UNICEF Data Must Speak", "positive deviance research, 15 countries", "months of fieldwork, not in India, ends in a report"],
                ].map(([a, b, c]) => (
                  <tr key={a} className="border-t border-white/8">
                    <td className="py-2.5 pr-3 font-medium">{a}</td>
                    <td className="py-2.5 pr-3 text-[var(--color-ink-2)]">{b}</td>
                    <td className="py-2.5 text-[var(--color-ink-2)]">{c}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/15">
                  <td className="py-2.5 pr-3 font-display font-bold gradient-text">Jugnu</td>
                  <td className="py-2.5 pr-3">locally proven, owned actions in 14 days</td>
                  <td className="py-2.5">continuous, every block, every term</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Glass>
        <Glass className="p-6">
          <SectionTitle eyebrow="Real numbers (ASER 2024, rural India)" title="The system Jugnu works in" />
          <ul className="space-y-3 text-sm">
            {[
              [`${(ASER_2024.std3ReadingGovt * 100).toFixed(1)}%`, "of Std III children in government schools read a Std II text"],
              [`${(ASER_2024.smallSchoolShare * 100).toFixed(1)}%`, "of government primary schools have fewer than 60 students"],
              ["2 in 3", "Std I–II classrooms are multigrade"],
              [`${(ASER_2024.flnDirective * 100).toFixed(1)}%`, "of schools received a government FLN directive — directives are not the gap"],
              [`${(ASER_2024.teacherAttendance * 100).toFixed(1)}%`, "average teacher attendance — the teachers are there to learn from"],
            ].map(([n, t]) => (
              <li key={t} className="flex items-baseline gap-3">
                <span className="w-16 shrink-0 text-right font-display text-lg font-bold tabular-nums gradient-text">{n}</span>
                <span className="text-[var(--color-ink-2)]">{t}</span>
              </li>
            ))}
          </ul>
        </Glass>
      </section>
    </div>
  );
}
