import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, BrainCircuit, Clapperboard, FlaskConical, Handshake, LineChart, MapPinned, Mic, Phone, Stars } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LivingMap } from "../components/maps";
import { FilmCard, FilmPlayer } from "../components/Film";
import { HeroMedia } from "../components/media";
import { Fireflies, Glass, SectionTitle, cx } from "../components/ui";
import { ASER_2024 } from "../engine/block";
import { MEDIA } from "../lib/clips";
import { usePrefs, useT } from "../lib/prefs";
import { usePipeline } from "../lib/store";
import { meanZ, schoolStatuses } from "../lib/status";

export default function AboutPage({ onTour }: { onTour: () => void }) {
  const t = useT();
  const { state } = usePipeline();
  const { lang } = usePrefs();
  const [clip, setClip] = useState<number | null>(null);
  const verified = state.verify.filter((v) => v.verdict === "verified").length;
  const distinctive = state.evidence.filter((e) => e.verdict === "distinctive").length;
  const status = useMemo(() => schoolStatuses(state), [state]);
  const z = useMemo(() => meanZ(state), [state]);
  const hi = lang === "hi" && "font-deva";

  const LOOP = [
    { icon: MapPinned, title: t("Find", "खोजें"), text: t("Model what each school should score given its context. Flag schools that beat it in 2 of 3 years.", "हर स्कूल के हालात से उसका अपेक्षित परिणाम निकालें। जो 3 में से 2 साल उससे आगे हों, उन्हें चिह्नित करें।") },
    { icon: BadgeCheck, title: t("Verify", "जाँचें"), text: t("Catch inflated data: consistency checks + a 15-minute spot check of 15 children by the cluster resource person.", "बढ़ा-चढ़ा डेटा पकड़ें: निरंतरता की जाँच + CRP द्वारा 15 बच्चों की 15 मिनट की मौके पर जाँच।") },
    { icon: Mic, title: t("Ask", "पूछें"), text: t("An AI voice interviewer talks to bright-spot teachers — and similar ordinary schools — in their language, about concrete routines.", "AI आवाज़-इंटरव्यूअर अच्छे स्कूलों के — और उन जैसे सामान्य स्कूलों के — शिक्षकों से उनकी भाषा में ठोस तरीकों पर बात करता है।") },
    { icon: Stars, title: t("Contrast", "तुलना"), text: t("Keep only practices that are specific to bright spots, cost nothing extra, and are described in concrete detail.", "वही तरीके रखें जो सिर्फ़ अच्छे स्कूलों में हैं, मुफ़्त हैं, और ठोस रूप से बताए गए हैं।") },
    { icon: Handshake, title: t("Spread", "फैलाएँ"), text: t("Sideways, not top-down: a voice note in the demonstrator's own words, a peer visit a few km away, owned actions.", "ऊपर से नहीं, साथी से साथी तक: उसी शिक्षक की आवाज़ में संदेश, पास के स्कूल का दौरा, और हर काम का ज़िम्मेदार।") },
    { icon: LineChart, title: t("Track", "ट्रैक"), text: t("Follow-up calls, then wave 1 vs wave 2 at the next assessment — the block learns which practices actually transfer.", "फ़ॉलो-अप कॉल, फिर अगली परीक्षा में पहली बनाम दूसरी लहर — ब्लॉक सीखता है कि कौन-से तरीके सच में काम आते हैं।") },
  ];

  const TRY = [
    { to: "/talk", icon: Mic, title: t("Be the teacher", "शिक्षक बनकर देखें"), text: t("A 12-minute Hindi voice interview with Jugnu on your phone — no app, no login.", "अपने फ़ोन पर जुगनू से 12 मिनट की हिंदी आवाज़-बातचीत — न ऐप, न लॉगिन।"), ext: true },
    { to: "/interviews", icon: Phone, title: t("Phone line", "फ़ोन लाइन"), text: t("The same interview on a basic phone call, with the exact TwiML at each step.", "वही बातचीत साधारण फ़ोन कॉल पर — हर कदम का TwiML भी।"), ext: false },
    { to: "/ai", icon: BrainCircuit, title: t("AI & guardrails", "AI व जाँच"), text: t("Ten AI tasks in five layers, the live trace of every call, and the evaluation.", "दस AI काम पाँच परतों में, हर कॉल का लाइव ट्रेस, और मूल्यांकन।"), ext: false },
    { to: "/testing", icon: FlaskConical, title: t("User testing", "उपयोगकर्ता परीक्षण"), text: t("Sessions with teachers, CRPs and BEOs — tasks, usability survey, what we changed.", "शिक्षकों, CRP और BEO के साथ सत्र — काम, सर्वे, और जो बदला गया।"), ext: false },
  ];

  return (
    <div className="space-y-10">
      <HeroMedia video={MEDIA.hero} className="min-h-[660px]">
        <Fireflies count={24} />
        <div className="grid min-h-[660px] items-center gap-6 p-6 md:p-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chip mb-5 w-fit">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" /> AI for Foundational Learning · {t("Challenge 4 · Data to action", "चुनौती 4 · डेटा से कार्य")}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={cx("text-5xl font-bold leading-[0.98] md:text-7xl", hi && "!leading-[1.15]")}>
              {t("The answer to a block's learning gap is often ", "ब्लॉक की सीखने की कमी का जवाब अक्सर ")}
              <span className="gradient-text">{t("already in the block.", "ब्लॉक में ही होता है।")}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={cx("mt-6 max-w-xl text-base text-white/80 md:text-lg", hi)}>
              {t(
                "Dashboards tell a Block Education Officer where learning is low. Jugnu finds the teachers who — with the same poverty, languages and staff shortages — already get children reading and counting, learns exactly what they do by talking to them, spreads it teacher-to-teacher, and checks that it worked.",
                "डैशबोर्ड बताते हैं कि सीखना कहाँ कम है। जुगनू उन शिक्षकों को ढूँढता है जो उसी गरीबी, भाषाओं और स्टाफ़ की कमी के बावजूद बच्चों को पढ़ना-गिनना सिखा रहे हैं — उनसे बात करके समझता है कि वे ठीक-ठीक क्या करते हैं, उसे शिक्षक से शिक्षक तक फैलाता है, और जाँचता है कि असर हुआ या नहीं।",
              )}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-wrap gap-3">
              <button className="btn btn-primary !px-5 !py-3 text-base" onClick={onTour}>
                <Clapperboard size={18} /> {t("Watch the film", "फ़िल्म देखें")}
              </button>
              <Link to="/today" className="btn btn-glass !px-5 !py-3 text-base">
                {t("Open today's tasks", "आज के काम खोलें")} <ArrowRight size={16} />
              </Link>
              <a href="/talk" target="_blank" rel="noreferrer" className="btn btn-glass !px-5 !py-3 text-base">
                <Mic size={16} /> {t("Talk to Jugnu as a teacher", "शिक्षक बनकर जुगनू से बात करें")}
              </a>
            </motion.div>
            <div className="mt-8 grid max-w-xl grid-cols-4 gap-2">
              {[
                [state.block.schools.length, t("schools", "स्कूल")],
                [verified, t("bright spots", "अच्छे स्कूल")],
                [state.interviews.length, t("interviews", "बातचीत")],
                [distinctive, t("practices", "तरीके")],
              ].map(([n, label]) => (
                <div key={String(label)} className="glass-inset px-3 py-2">
                  <div className="font-display text-2xl font-bold gradient-text tabular-nums">{n}</div>
                  <div className={cx("text-[11px] text-[var(--color-ink-2)]", hi)}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative h-[440px] md:h-[560px]">
            <LivingMap mode="3d" schools={state.block.schools} status={status} z={z} links={state.recs.filter((r) => r.wave === 1).map((r) => ({ from: r.demonstratorId, to: r.schoolId }))} height={540} autoRotate className="h-full overflow-hidden rounded-3xl" />
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-center text-xs text-white/60">
              {t("Live map of the demo block · fireflies = bright spots · arcs = who learns from whom", "डेमो ब्लॉक का लाइव नक्शा · जुगनू = अच्छे स्कूल · रेखाएँ = कौन किससे सीखता है")}
            </div>
          </div>
        </div>
      </HeroMedia>

      <section>
        <SectionTitle eyebrow={t("Working now · Build stage", "अभी चालू · बिल्ड चरण")} title={t("Try it yourself", "खुद आज़माएँ")} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TRY.map(({ to, icon: Icon, title, text, ext }) => {
            const body = (
              <Glass className="glass-hover h-full p-5">
                <Icon size={20} className="text-amber-200" aria-hidden />
                <h3 className={cx("mt-3 text-lg font-bold", hi)}>{title}</h3>
                <p className={cx("mt-1 text-sm text-[var(--color-ink-2)]", hi)}>{text}</p>
              </Glass>
            );
            return ext ? (
              <a key={to} href={to} target="_blank" rel="noreferrer">
                {body}
              </a>
            ) : (
              <Link key={to} to={to}>
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle
          eyebrow={t("See it in action", "काम करते हुए देखें")}
          title={t("One loop, every term", "एक चक्र, हर सत्र")}
          sub={t("The whole loop as a short film: shot with Veo 3.1, scored with Lyria, narrated with Chirp 3. Jump to any chapter.", "पूरा चक्र एक छोटी फ़िल्म में: Veo 3.1 से फ़िल्माई, Lyria का संगीत, Chirp 3 की आवाज़। किसी भी अध्याय पर जाएँ।")}
        />
        <FilmCard onPlay={(at) => setClip(at ?? 0)} />
        <FilmPlayer open={clip !== null} start={clip ?? 0} onClose={() => setClip(null)} />
      </section>

      <section>
        <SectionTitle eyebrow={t("The loop", "चक्र")} title={t("Find → Verify → Ask → Contrast → Spread → Track", "खोजें → जाँचें → पूछें → तुलना → फैलाएँ → ट्रैक")} />
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {LOOP.map(({ icon: Icon, title, text }, i) => (
            <Glass key={title} className="glass-hover p-5" delay={0.04 * i}>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-200/15 text-sm font-bold text-amber-100">{i + 1}</span>
                <Icon size={18} className="text-[var(--a1)]" aria-hidden />
              </div>
              <h3 className={cx("mt-3 text-lg font-bold", hi)}>{title}</h3>
              <p className={cx("mt-1 text-sm text-[var(--color-ink-2)]", hi)}>{text}</p>
            </Glass>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Glass className="p-6">
          <SectionTitle eyebrow={t("Why nothing does this today", "आज ऐसा कुछ क्यों नहीं है")} title={t("Dashboards say where. Nobody says what — from local proof.", "डैशबोर्ड बताते हैं कहाँ। कोई नहीं बताता क्या — स्थानीय सबूत से।")} />
          <div className="overflow-x-auto">
            <table className={cx("w-full text-sm", hi)}>
              <thead>
                <tr className="text-left text-[var(--color-ink-3)]">
                  <th className="pb-2">{t("Today", "आज")}</th>
                  <th className="pb-2">{t("What it gives", "क्या देता है")}</th>
                  <th className="pb-2">{t("What is missing", "क्या कमी है")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [t("State command centres (VSK, EMIS)", "राज्य कमांड सेंटर (VSK, EMIS)"), t("where learning is low", "सीखना कहाँ कम है"), t("what to do about it", "इसके लिए क्या करें")],
                  [t("Cascade training", "कैस्केड प्रशिक्षण"), t("the same module for everyone", "सबके लिए एक ही मॉड्यूल"), t("dilutes at every level; not local", "हर स्तर पर कमज़ोर होता है; स्थानीय नहीं")],
                  [t("NCERT innovative practices", "NCERT नवाचार"), t("~60 write-ups a year", "साल में ~60 लेख"), t("not outcome-verified, not spread", "नतीजों से जाँचे नहीं, फैलाए नहीं जाते")],
                  [t("UNICEF Data Must Speak", "UNICEF Data Must Speak"), t("positive deviance research, 15 countries", "सकारात्मक विचलन शोध, 15 देश"), t("months of fieldwork, not in India, ends in a report", "महीनों का फ़ील्डवर्क, भारत में नहीं, रिपोर्ट पर खत्म")],
                ].map(([a, b, c]) => (
                  <tr key={a} className="border-t border-white/8">
                    <td className="py-2.5 pr-3 font-medium">{a}</td>
                    <td className="py-2.5 pr-3 text-[var(--color-ink-2)]">{b}</td>
                    <td className="py-2.5 text-[var(--color-ink-2)]">{c}</td>
                  </tr>
                ))}
                <tr className="border-t border-white/15">
                  <td className="py-2.5 pr-3 font-display font-bold gradient-text">{t("Jugnu", "जुगनू")}</td>
                  <td className="py-2.5 pr-3">{t("locally proven, owned actions in 14 days", "14 दिन में स्थानीय रूप से साबित, ज़िम्मेदारी वाले काम")}</td>
                  <td className="py-2.5">{t("continuous, every block, every term", "लगातार, हर ब्लॉक, हर सत्र")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Glass>
        <Glass className="p-6">
          <SectionTitle eyebrow={t("Real numbers (ASER 2024, rural India)", "असली आँकड़े (ASER 2024, ग्रामीण भारत)")} title={t("The system Jugnu works in", "वह व्यवस्था जिसमें जुगनू काम करता है")} />
          <ul className={cx("space-y-3 text-sm", hi)}>
            {[
              [`${(ASER_2024.std3ReadingGovt * 100).toFixed(1)}%`, t("of Std III children in government schools read a Std II text", "सरकारी स्कूलों में कक्षा 3 के बच्चे कक्षा 2 का पाठ पढ़ पाते हैं")],
              [`${(ASER_2024.smallSchoolShare * 100).toFixed(1)}%`, t("of government primary schools have fewer than 60 students", "सरकारी प्राथमिक स्कूलों में 60 से कम बच्चे हैं")],
              ["2 / 3", t("Std I–II classrooms are multigrade", "कक्षा 1–2 की कक्षाएँ बहु-कक्षा हैं")],
              [`${(ASER_2024.flnDirective * 100).toFixed(1)}%`, t("of schools received a government FLN directive — directives are not the gap", "स्कूलों को FLN निर्देश मिला — निर्देशों की कमी नहीं है")],
              [`${(ASER_2024.teacherAttendance * 100).toFixed(1)}%`, t("average teacher attendance — the teachers are there to learn from", "औसत शिक्षक उपस्थिति — सीखने के लिए शिक्षक मौजूद हैं")],
            ].map(([n, label]) => (
              <li key={label} className="flex items-baseline gap-3">
                <span className="w-16 shrink-0 text-right font-display text-lg font-bold tabular-nums gradient-text">{n}</span>
                <span className="text-[var(--color-ink-2)]">{label}</span>
              </li>
            ))}
          </ul>
        </Glass>
      </section>
    </div>
  );
}
