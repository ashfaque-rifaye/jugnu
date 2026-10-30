// ASK: a 12-minute voice interview in the teacher's language. The script asks about concrete
// routines (never "why are you good?") and follows up whenever an answer names a practice but
// gives no specifics. Offline coding maps answers to the practice taxonomy with a specificity
// score; Claude does the same with more nuance when connected.
import { PRACTICE_IDS, PRACTICES, specificity, type PracticeId } from "./practices";
import { chance, pick, type Rng } from "./rng";
import type { Interview, Mention, School, SchoolTruth, Turn } from "./types";

export interface Question {
  id: string;
  hi: string;
  en: string;
  probes: PracticeId[];
}

export const SCRIPT: Question[] = [
  { id: "open", hi: "सुबह स्कूल शुरू होने के बाद पहले आधे घंटे में कक्षा 1 से 3 के बच्चे क्या करते हैं?", en: "In the first half hour after school starts, what do children in classes 1–3 do?", probes: ["level_groups", "number_talk", "circular_compliance"] },
  { id: "levels", hi: "एक ही कक्षा में बच्चे अलग-अलग स्तर पर होते हैं। आप इसे कैसे संभालते हैं?", en: "Children in one class are at very different levels. How do you handle that?", probes: ["level_groups", "weekly_tests"] },
  { id: "numeracy", hi: "गिनती और जोड़-घटाव के लिए रोज़ क्या होता है?", en: "What happens every day for counting and addition/subtraction?", probes: ["number_talk", "extra_worksheets"] },
  { id: "language", hi: "जिन बच्चों के घर में हिंदी नहीं बोली जाती, उनके साथ आप क्या करते हैं?", en: "What do you do with children who don't speak Hindi at home?", probes: ["home_language"] },
  { id: "absent", hi: "जो बच्चा कुछ दिन नहीं आता, लौटने पर उसके साथ क्या होता है?", en: "When a child misses a few days, what happens when they come back?", probes: ["absent_buddies"] },
  { id: "parents", hi: "बच्चों की पढ़ाई में माता-पिता क्या करते हैं?", en: "What do parents do for their children's learning?", probes: ["parent_voice", "extra_worksheets"] },
  { id: "one_thing", hi: "अगर पास के स्कूल की कोई शिक्षिका कल से आपकी एक चीज़ अपनाए, तो वह क्या हो?", en: "If a teacher from a nearby school could copy one thing you do starting tomorrow, what should it be?", probes: [] },
];

export const FOLLOW_UP = {
  hi: "ज़रा विस्तार से बताइए — ठीक-ठीक क्या होता है? कितने मिनट, कौन-सी चीज़ें, बच्चे क्या करते हैं?",
  en: "Could you describe exactly what happens — how many minutes, what materials, what do the children do?",
};

const SPECIFIC_ANSWERS: Record<PracticeId, { hi: string; en: string }[]> = {
  level_groups: [
    { hi: "रोज़ पहले 45 मिनट हम बच्चों को कक्षा से नहीं, स्तर से बाँटते हैं — अक्षर, शब्द, अनुच्छेद, कहानी। हर सोमवार समूह फिर से बनाते हैं।", en: "Every day for the first 45 minutes we group children by level, not class — letters, words, paragraph, story. Every Monday we re-form the groups." },
    { hi: "चार टोली हैं — जो अक्षर पर हैं वो कार्ड से खेलते हैं, कहानी वाले एक-दूसरे को पढ़कर सुनाते हैं। हर हफ़्ते बच्चे ऊपर की टोली में जाते हैं।", en: "There are four groups — letter-level children play with cards, story-level children read to each other. Every week children move up a group." },
  ],
  number_talk: [
    { hi: "रोज़ 10 मिनट तीलियों के बंडल से गिनती-बातचीत — मैं सवाल देती हूँ, बच्चे बंडल खोलकर बताते हैं कि जवाब कैसे आया।", en: "Every day, 10 minutes of number talk with bundles of sticks — I give a sum, children open bundles and explain how they got it." },
    { hi: "हर बच्चे के पास 20 कंकड़ और 5 बंडल हैं। पहले बच्चे खुद करते हैं, फिर जोड़ी में समझाते हैं।", en: "Every child has 20 pebbles and 5 bundles. First they do it themselves, then explain to a partner." },
  ],
  home_language: [
    { hi: "नया शब्द पहले भीली में समझाती हूँ, फिर हिंदी में। बच्चे पहले अपनी बोली में जवाब दे सकते हैं — उसके बाद हम मिलकर हिंदी में लिखते हैं।", en: "I explain a new word in Bhili first, then Hindi. Children may answer in their own language first — then we write it together in Hindi." },
    { hi: "हमने घर की बोली के 200 शब्दों का चार्ट बनाया है, रोज़ 5 मिनट उनसे हिंदी शब्द जोड़ते हैं।", en: "We made a chart of 200 home-language words; every day for 5 minutes we link them to Hindi words." },
  ],
  absent_buddies: [
    { hi: "हर बच्चे की एक जोड़ी है। जो नहीं आया, लौटने पर उसका साथी कॉपी दिखाकर 10 मिनट में उस दिन का काम करवाता है।", en: "Every child has a buddy. When a child returns, the buddy shows their notebook and takes them through that day's work in 10 minutes." },
    { hi: "जो बच्चा नहीं आया, लौटने पर पहले 15 मिनट उसका पड़ोसी उसे छूटा हुआ पाठ पढ़ाता है — कॉपी और कार्ड से। फिर मैं 2 सवाल पूछकर देखती हूँ।", en: "When a child comes back, for the first 15 minutes a neighbour teaches the missed lesson with notebook and cards. Then I check with 2 questions." },
  ],
  parent_voice: [
    { hi: "हर शनिवार बच्चे घर पर माँ या पापा को एक पन्ना पढ़कर सुनाते हैं। मैं 1 मिनट का voice note भेजती हूँ कि क्या सुनना है।", en: "Every Saturday children read a page aloud to mum or dad at home. I send a 1-minute voice note on what to listen for." },
    { hi: "माता-पिता के WhatsApp समूह में हर हफ़्ते एक छोटी कहानी भेजती हूँ; रविवार को बच्चे पढ़कर सुनाते हैं और माता-पिता जवाब भेजते हैं।", en: "Every week I send a short story to the parents' WhatsApp group; on Sunday children read it aloud and parents reply." },
  ],
  print_wall: [{ hi: "बच्चों के अपने लिखे वाक्य दीवार पर उनकी आँख की ऊँचाई पर लगाते हैं, हर हफ़्ते पढ़ते हैं।", en: "Children's own sentences go on the wall at their eye level; we read them every week." }],
  circular_compliance: [{ hi: "हम पाठ योजना और परिपत्र के हिसाब से ही पढ़ाते हैं।", en: "We teach exactly as per the lesson plan and circulars." }],
  extra_worksheets: [{ hi: "रोज़ होमवर्क की वर्कशीट देते हैं।", en: "We give a homework worksheet every day." }],
  weekly_tests: [{ hi: "हर हफ़्ते टेस्ट लेते हैं।", en: "We take a test every week." }],
};

const VAGUE: Partial<Record<PracticeId, { hi: string; en: string }>> = {
  level_groups: { hi: "हाँ, कभी-कभी समूह बना देते हैं।", en: "Yes, sometimes we make groups." },
  number_talk: { hi: "गिनती करवाते हैं।", en: "We make them count." },
  home_language: { hi: "थोड़ा बोली में भी बोल देते हैं।", en: "We speak a little in the local language too." },
  parent_voice: { hi: "माता-पिता की बैठक में बताते हैं।", en: "We tell parents in the meeting." },
  absent_buddies: { hi: "जो नहीं आया, उसे बाद में देख लेते हैं।", en: "We look at absent children later." },
};

const GENERIC = [
  { hi: "बच्चों पर पूरा ध्यान देते हैं।", en: "We give children full attention." },
  { hi: "जो सिलेबस है वही करवाते हैं।", en: "We do whatever is in the syllabus." },
  { hi: "बच्चे प्रार्थना के बाद कक्षा में बैठते हैं, फिर पढ़ाई शुरू होती है।", en: "After assembly children sit in class, then teaching begins." },
  { hi: "कोशिश करते हैं कि सब बच्चे सीखें।", en: "We try to make sure every child learns." },
];

const MINUTES = [30, 40, 45, 50];
const DAYS_HI = ["सोमवार", "शनिवार", "शुक्रवार"];
const MATERIALS_HI = ["तीलियों के बंडल", "कंकड़ और बंडल", "इमली के बीज और बंडल", "माचिस की तीलियाँ और बंडल"];

/** Personalise a template answer so no two teachers sound identical. */
function vary(ans: { hi: string; en: string }, rng: Rng): { hi: string; en: string } {
  const min = pick(rng, MINUTES);
  return {
    hi: ans.hi.replace("45 मिनट", `${min} मिनट`).replace("हर सोमवार", `हर ${pick(rng, DAYS_HI)}`).replace("तीलियों के बंडल", pick(rng, MATERIALS_HI)),
    en: ans.en.replace("45 minutes", `${min} minutes`),
  };
}

/** A simulated teacher answering the script from their school's hidden practices. */
export function simulateInterview(school: School, truth: SchoolTruth, group: Interview["group"], rng: Rng): Interview {
  const turns: Turn[] = [{ speaker: "jugnu", text: `नमस्ते ${school.teacher} जी। मैं जुगनू हूँ, ब्लॉक शिक्षा कार्यालय की ओर से। आपके स्कूल के बच्चे अच्छा सीख रहे हैं — हम आपसे सीखना चाहते हैं। 12 मिनट लगेंगे।`, textEn: `Namaste ${school.teacher}. I'm Jugnu, calling for the Block Education Office. Children in your school are learning well — we'd like to learn from you. It takes 12 minutes.` }];
  if (group === "comparison") turns[0] = { speaker: "jugnu", text: `नमस्ते ${school.teacher} जी। मैं जुगनू हूँ, ब्लॉक शिक्षा कार्यालय की ओर से। हम ब्लॉक के सभी स्कूलों से उनके रोज़ के काम के बारे में सीख रहे हैं। 12 मिनट लगेंगे।`, textEn: `Namaste ${school.teacher}. I'm Jugnu, from the Block Education Office. We are learning from schools across the block about their daily routines. It takes 12 minutes.` };
  const has = new Set(truth.practices);
  const mentioned = new Set<PracticeId>();
  for (const q of SCRIPT) {
    turns.push({ speaker: "jugnu", text: q.hi, textEn: q.en });
    let ans: { hi: string; en: string } | null = null;
    let vagueUsed: PracticeId | null = null;
    const own = q.probes.filter((p) => has.has(p) && !mentioned.has(p));
    if (q.id === "one_thing") {
      const effective = truth.practices.filter((p) => PRACTICES[p].effect.reading + PRACTICES[p].effect.numeracy > 0.1);
      ans = effective.length ? vary(pick(rng, SPECIFIC_ANSWERS[pick(rng, effective)]), rng) : pick(rng, GENERIC);
    } else if (own.length) {
      const p = own[0];
      mentioned.add(p);
      const effectiveAndDone = PRACTICES[p].effect.reading + PRACTICES[p].effect.numeracy > 0.1 && truth.fidelity > 0.7;
      ans = effectiveAndDone || chance(rng, 0.5) ? vary(pick(rng, SPECIFIC_ANSWERS[p]), rng) : VAGUE[p] ?? vary(pick(rng, SPECIFIC_ANSWERS[p]), rng);
    } else {
      const vague = q.probes.find((p) => VAGUE[p] && chance(rng, 0.12));
      if (vague) {
        ans = VAGUE[vague]!;
        vagueUsed = vague;
      } else ans = pick(rng, GENERIC);
    }
    turns.push({ speaker: "teacher", text: ans.hi, textEn: ans.en });
    // Follow up when a practice is named without specifics.
    const coded = codeText(ans.hi);
    if (coded.some((m) => m.specificity < 2) || vagueUsed) {
      turns.push({ speaker: "jugnu", text: FOLLOW_UP.hi, textEn: FOLLOW_UP.en });
      const p = coded[0]?.practice ?? vagueUsed;
      const deeper = p && has.has(p) && truth.fidelity > 0.75 ? vary(pick(rng, SPECIFIC_ANSWERS[p]), rng) : { hi: "बस, ऐसे ही — जैसा समय मिलता है।", en: "Just like that — whenever there is time." };
      turns.push({ speaker: "teacher", text: deeper.hi, textEn: deeper.en });
    }
  }
  turns.push({ speaker: "jugnu", text: "बहुत धन्यवाद! आपकी बात दूसरे शिक्षकों तक आपके नाम के साथ पहुँचेगी — आपकी अनुमति से।", textEn: "Thank you! With your permission, what you shared will reach other teachers with your name on it." });
  return { schoolId: school.id, group, language: "hi", turns, mentions: codeInterview(turns), codedBy: "offline", minutes: 9 + Math.round(rng() * 5) };
}

function codeText(text: string): Mention[] {
  return PRACTICE_IDS.filter((p) => PRACTICES[p].lexicon.test(text)).map((p) => ({ practice: p, quote: text, specificity: specificity(text) }));
}

/** Offline coding: every teacher turn → practice mentions; keep the most specific quote per practice. */
export function codeInterview(turns: Turn[]): Mention[] {
  const best = new Map<PracticeId, Mention>();
  for (const t of turns) {
    if (t.speaker !== "teacher") continue;
    for (const m of codeText(t.text)) {
      const prev = best.get(m.practice);
      if (!prev || m.specificity > prev.specificity) best.set(m.practice, m);
    }
  }
  return [...best.values()];
}

/** The next question for a live interview (offline interviewer). */
export function nextQuestion(turns: Turn[]): Turn | null {
  const asked = turns.filter((t) => t.speaker === "jugnu").map((t) => t.text);
  const lastTeacher = [...turns].reverse().find((t) => t.speaker === "teacher");
  const lastJugnu = [...turns].reverse().find((t) => t.speaker === "jugnu");
  if (lastTeacher && lastJugnu && lastJugnu.text !== FOLLOW_UP.hi && lastJugnu.text !== FOLLOW_UP.en) {
    const coded = codeText(lastTeacher.text);
    if (coded.length && coded.every((m) => m.specificity < 2)) return { speaker: "jugnu", text: FOLLOW_UP.hi, textEn: FOLLOW_UP.en };
  }
  const q = SCRIPT.find((x) => !asked.includes(x.hi));
  return q ? { speaker: "jugnu", text: q.hi, textEn: q.en } : null;
}
