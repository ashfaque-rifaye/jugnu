// End-to-end smoke test against a running server: invite → consent → full interview → coding.
// Usage: node scripts/smoke.mjs [baseUrl]   (default http://localhost:8788)
const base = process.argv[2] ?? "http://localhost:8788";
const pass = process.env.DEMO_PASSCODE ?? "";
const j = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-jugnu-pass": pass }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
};

// Answer whatever Jugnu asks, by topic (a real teacher would; replies are detailed on purpose).
const byTopic = {
  open: "रोज़ पहले 40 मिनट हम बच्चों को कक्षा से नहीं, स्तर से चार टोलियों में बाँटते हैं — अक्षर, शब्द, अनुच्छेद, कहानी। हर सोमवार टोली फिर से बनाते हैं।",
  levels: "स्तर के हिसाब से टोली बनती है; हर हफ़्ते बच्चे पढ़कर सुनाते हैं, फिर जो आगे बढ़ा वह ऊपर की टोली में जाता है।",
  numeracy: "रोज़ 10 मिनट तीलियों के बंडल से गिनती-बातचीत होती है — मैं सवाल देती हूँ, बच्चे बंडल खोलकर बताते हैं कि जवाब कैसे आया।",
  language: "नया शब्द पहले भीली में समझाती हूँ, फिर हिंदी में। रोज़ 5 मिनट घर की बोली के शब्दों का चार्ट दोहराते हैं।",
  absent: "जो बच्चा नहीं आया, लौटने पर उसका साथी 10 मिनट में कॉपी दिखाकर उस दिन का काम करवाता है।",
  parents: "हर शनिवार बच्चे घर पर माँ या पापा को एक पन्ना पढ़कर सुनाते हैं; मैं 1 मिनट का voice note भेजती हूँ।",
  one_thing: "रोज़ पहले 40 मिनट स्तर वाली टोलियाँ — यही सबसे ज़रूरी है।",
};
const followUp = "रोज़ 15 मिनट, पहले बच्चे खुद करते हैं, फिर कॉपी में लिखते हैं।";

const { interview, link } = await j("POST", "/api/interviews", { teacherName: "Smoke Test", schoolName: "GPS Smoke", group: "bright" });
console.log("invite", link);
await j("POST", `/api/talk/${interview.token}/start`, {});
let reply = { kind: "consent", topic: null };
for (let i = 0; i < 20; i++) {
  const text = reply.kind === "consent" ? "हाँ जी, शुरू कीजिए" : reply.kind === "follow_up" ? followUp : byTopic[reply.topic] ?? "जी, ठीक है।";
  const r = await j("POST", `/api/talk/${interview.token}/answer`, { text, source: "typed" });
  console.log(r.status.padEnd(11), (r.reply.kind ?? "").padEnd(9), r.source.padEnd(7), r.reply.say.slice(0, 60));
  reply = r.reply;
  if (r.status === "completed") break;
}
await new Promise((ok) => setTimeout(ok, 1500));
const d = await j("GET", `/api/interviews/${interview.id}`);
console.log(`\n${d.codings.length} codings:`);
for (const c of d.codings) console.log(" -", (c.practice ?? c.new_name).padEnd(16), `spec ${c.specificity}`, c.grounded ? "grounded" : "UNGROUNDED", c.coder);
const practices = new Set(d.codings.map((c) => c.practice));
const expected = ["level_groups", "number_talk", "home_language", "absent_buddies", "parent_voice"];
const missing = expected.filter((p) => !practices.has(p));
if (missing.length) {
  console.error("missing:", missing.join(", "));
  process.exit(1);
}
console.log("\nOK — all five practices coded");
