// Follow-up call replies a teacher might give two weeks after trying a peer's practice, each with
// a one-line summary and what it means for the officer. Simulator data (drafted with an LLM,
// reviewed by hand). {demo} is replaced with the demonstrating teacher's first name.
import type { PracticeId } from "./practices";
import type { FollowUp } from "./types";

export interface FollowUpLine {
  hi: string;
  en: string;
  summary: [en: string, hi: string];
  insight: [en: string, hi: string];
  barrier?: string;
  owner?: "BEO" | "CRP" | "Teacher";
}

/** Replies that describe the practice itself, so the call matches what was recommended. */
export const PRACTICE_LINES: Partial<Record<PracticeId, Record<"adopted" | "trying", FollowUpLine[]>>> = {
  level_groups: {
    adopted: [
      {
        hi: "हओ सर, रोज़ सुबह पौन घंटा स्तर के हिसाब से ही बैठा रहे हैं। जो बच्चे अक्षर पर थे, अब शब्द पढ़ने लगे हैं।",
        en: "Yes sir, every morning for forty-five minutes we seat them by level. Kids stuck on letters are now reading words.",
        summary: ["Teacher runs level groups daily with visible reading progress", "रोज़ स्तर अनुसार समूह बनाकर पढ़ाने से बच्चे आगे बढ़े"],
        insight: ["Method is working well. CRP can help teacher design the weekly regrouping assessment.", "अभ्यास सफल है। संकुल समन्वयक साप्ताहिक स्तर जांच में मदद करें।"],
        owner: "CRP",
      },
      {
        hi: "कक्षा छोड़ के स्तर अनुसार बैठाना शुरू कर दिया। {demo} की तरह हर शनिवार स्तर जांच के समूह बदल भी रहे।",
        en: "We stopped grouping by grade and seat by level now. Like {demo}, we assess and re-group every Saturday.",
        summary: ["Adopted weekly regrouping routine inspired by peer school visit", "{demo} की तरह हर शनिवार स्तर जांच कर समूह बदलते हैं"],
        insight: ["Teacher shows great ownership. Encourage them to share this routine at the cluster meeting.", "शिक्षक ने पूरा अपनाया। संकुल बैठक में इनका अनुभव साझा करवाएं।"],
        owner: "BEO",
      },
      {
        hi: "तीनों कक्षाओं को मिला दिया है, सब अपने स्तर वाले समूह में बैठते हैं। बच्चों की झिझक बिल्कुल खुल गई।",
        en: "Combined all three grades so everyone sits with peers at their level. Children have opened up completely.",
        summary: ["Combined grades successfully into level-based reading groups daily", "कक्षाएं मिलाकर स्तर अनुसार समूह बनाए, बच्चों की झिझक मिटी"],
        insight: ["Strong implementation. Observe during next routine visit to validate fluency growth.", "बेहतरीन शुरुआत। अगले दौरे पर बच्चों की प्रवाह गति देखें।"],
        owner: "CRP",
      },
    ],
    trying: [
      {
        hi: "शुरू तो किया था सर, पर रोज़ समूह बदलने और बैठाने में पंद्रह-बीस मिनट निकल जाते हैं।",
        en: "We started sir, but seating them into different groups daily eats up fifteen to twenty minutes.",
        summary: ["Seating transitions take too long each morning", "रोज़ बच्चों को स्तर अनुसार बैठाने में बहुत समय लग रहा"],
        insight: ["CRP can model a quick color-coded seating routine to save morning transition time.", "संकुल समन्वयक जल्दी बैठाने का आसान तरीका कक्षा में दिखाकर सिखाएं।"],
        owner: "CRP",
      },
      {
        hi: "{demo} के यहाँ देखा तो आसान लगा, पर हमारे यहाँ कहानी समूह वाले बच्चे दूसरों को चिढ़ाते हैं।",
        en: "It looked easy at {demo}'s school, but here story-level kids tease the slower ones.",
        summary: ["Advanced readers tease children in lower level groups", "कहानी पढ़ने वाले बच्चे धीमे बच्चों को चिढ़ाने लगे हैं"],
        insight: ["Suggest naming groups after animals or colors rather than performance levels.", "स्तरों की जगह समूहों के नाम रंग या पशुओं पर रखने की सलाह दें।"],
        owner: "Teacher",
      },
      {
        hi: "कर रहे हैं सर, लेकिन यह समझ नहीं आ रहा कि अक्षर से शब्द वाले समूह में कब भेजें।",
        en: "We are trying sir, but we are unsure when to promote a child from letters to words.",
        summary: ["Teacher unsure when to move children between reading levels", "बच्चों का स्तर कब और कैसे बदलना है, यह स्पष्ट नहीं"],
        insight: ["Provide a simple four-point rubric for weekly level reassessments.", "साप्ताहिक स्तर तय करने के लिए चार बिंदुओं की सरल जांच सूची दें।"],
        owner: "CRP",
      },
    ],
  },
  number_talk: {
    adopted: [
      {
        hi: "रोज़ घंटी लगते ही कंकड़ और तीली से दस मिनट मौखिक सवाल करते हैं। बच्चे खुद बताते हैं उन्होंने कैसे जोड़ा।",
        en: "Every day as school starts, we do ten minutes of oral math with pebbles. Children explain their steps.",
        summary: ["Daily ten-minute oral math routine with objects running smoothly", "कंकड़-तीली से रोज़ दस मिनट मौखिक गणित नियमित चल रहा"],
        insight: ["Excellent adoption. Teacher has made children articulate their mathematical thinking daily.", "उत्कृष्ट। बच्चे अपने तरीके बोलकर समझाने लगे हैं, इसे जारी रखें।"],
      },
      {
        hi: "हओ सर, {demo} जैसी तीली-बंडल वाली बात जमा ली है। अब तो बच्चे बिना लिखे मन में हल बता देते हैं।",
        en: "Yes sir, settled into bundle-and-stick talks like {demo}. Now kids solve problems mentally without writing.",
        summary: ["Mental math routine with bundles adopted successfully from peer", "{demo} की तरह तीली बंडल से मौखिक बातचीत नियमित अपनाई"],
        insight: [
          "Peer learning succeeded. Encourage teacher to document child reasoning strategies.",
          "सहकर्मी से अच्छा सीखा। बच्चों के हल करने के तरीके डायरी में नोट करने को कहें।",
        ],
        owner: "Teacher",
      },
      {
        hi: "दस मिनट की बातचीत से गणित का डर खत्म हो गया। जो कभी नहीं बोलते थे, वो भी तीली गिनकर जवाब दे रहे।",
        en: "Ten minutes of discussion removed fear of math. Even silent children count sticks and answer now.",
        summary: ["Math anxiety dropped through morning stick talk routine", "सुबह की बातचीत से गणित का डर खत्म हुआ"],
        insight: ["Great boost in student confidence. Keep nudging them toward word problems.", "बच्चों का आत्मविश्वास बढ़ा। अब शाब्दिक प्रश्नों की ओर आगे बढ़ें।"],
        owner: "Teacher",
      },
    ],
    trying: [
      {
        hi: "तीली और कंकड़ तो रख लिए हैं, पर बच्चे बस रटा हुआ उत्तर चिल्लाते हैं, तरीका कोई नहीं बताता।",
        en: "We kept sticks and pebbles, but children just shout rote answers instead of explaining their steps.",
        summary: ["Children shout final answers without explaining their reasoning", "बच्चे सिर्फ उत्तर चिल्लाते हैं, निकालने का तरीका नहीं बताते"],
        insight: ["Teacher should ask open prompts like 'show me with pebbles how you found this'.", "शिक्षक बच्चों से पूछें 'कंकड़ रखकर दिखाओ यह कैसे आया'।"],
        owner: "Teacher",
      },
      {
        hi: "शुरू किया था, पर दस मिनट की जगह आधा घंटा खिंच जाता है और बाकी विषय छूट जाते हैं।",
        en: "We started, but ten minutes drags on to half an hour and other subjects suffer.",
        summary: ["Number talks run over time and delay other lessons", "दस मिनट की बातचीत आधा घंटा खिंच जाती है"],
        insight: ["Advise teacher to pick only two student responses per day to stay on time.", "समय सीमा के लिए रोज़ सिर्फ दो बच्चों के तरीके सुनने की सलाह दें।"],
        owner: "CRP",
      },
      {
        hi: "{demo} की कक्षा में सब बोल रहे थे, पर हमारे यहाँ केवल आगे की बेंच वाले दो-तीन लड़के ही बोलते हैं।",
        en: "At {demo}'s school all kids spoke, but here only two or three front-bench boys speak.",
        summary: ["Only front bench boys participate during number talks", "मौखिक गणित में सिर्फ आगे बैठने वाले छात्र ही बोलते हैं"],
        insight: ["Suggest turn-and-talk in pairs before inviting answers to involve back-benchers.", "सभी को शामिल करने के लिए पहले जोड़ी में फुसफुसाकर बात करने को कहें।"],
        owner: "Teacher",
      },
    ],
  },
  home_language: {
    adopted: [
      {
        hi: "पहले बुंदेली में बात समझाते हैं, फिर किताब की हिंदी पर आते हैं। बच्चों ने झिझक छोड़ के बोलना शुरू किया।",
        en: "We explain first in Bundeli, then connect to textbook Hindi. Children shed hesitation and started speaking.",
        summary: ["Bundeli-first explanations help bridge children to textbook Hindi", "पहले बुंदेली फिर हिंदी समझाने से बच्चों की झिझक खुली"],
        insight: [
          "Effective mother-tongue bridge. Encourage teacher to create bilingual vocabulary charts.",
          "मातृभाषा का बढ़िया उपयोग। कक्षा में बुंदेली-हिंदी शब्द चार्ट लगाने को कहें।",
        ],
        owner: "Teacher",
      },
      {
        hi: "हमारे गौंड बस्ती के बच्चे पहले चुप रहते थे। अब जब गोंडी में उत्तर देने की छूट दी, तो सब हाथ उठाते हैं।",
        en: "Tribal Gond children stayed quiet before. Now that they can answer in Gondi, all raise hands.",
        summary: ["Allowing Gondi answers triggered universal class participation", "गोंडी में उत्तर देने की छूट से सभी बच्चे बोलने लगे"],
        insight: [
          "Incredible breakthrough in classroom inclusion. Appreciate teacher's sensitivity in BEO monthly note.",
          "समावेशी शिक्षण की मिसाल। मासिक समीक्षा में इस पहल की प्रशंसा करें।",
        ],
        owner: "BEO",
      },
      {
        hi: "{demo} ने जैसे बताया था, नया पाठ पहले अपनी बोली में गपशप करके समझाते हैं। समझना बहुत तेज़ हो गया है।",
        en: "Just as {demo} suggested, we discuss new lessons first in local dialect. Comprehension is much faster.",
        summary: ["Dialect chat before textbook reading accelerated comprehension", "{demo} के तरीके से पहले बोली में बात करने से समझ बढ़ी"],
        insight: ["Pedagogical bridge functioning as intended. Share method across cluster meetings.", "सटीक शिक्षण विधि। यह तरीका संकुल की अन्य शालाओं में साझा करें।"],
        owner: "CRP",
      },
    ],
    trying: [
      {
        hi: "कोशिश की सर, पर पालक कहते हैं कि स्कूल में देहाती भाषा नहीं, सीधी अंग्रेज़ी-हिंदी सिखाई जाए।",
        en: "We tried sir, but parents complain we should teach proper Hindi and English, not rural dialect.",
        summary: ["Parents push back against using local dialect in school", "अभिभावक स्कूल में स्थानीय बोली उपयोग करने पर आपत्ति जता रहे"],
        insight: [
          "Help teacher explain to parents that mother tongue builds a faster bridge to standard Hindi.",
          "पालक बैठक में समझाएं कि बोली से ही मानक भाषा जल्दी सीखी जाती है।",
        ],
        owner: "BEO",
      },
      {
        hi: "{demo} की तरह शुरू तो किया, पर गोंडी के कई शब्दों का मुझे खुद मतलब नहीं मालूम, अटक जाते हैं।",
        en: "Started like {demo}, but I get stuck because I don't know many Gondi words myself.",
        summary: ["Teacher struggles with personal lack of Gondi vocabulary", "शिक्षक को खुद गोंडी शब्दों की पूरी जानकारी नहीं है"],
        insight: ["Connect teacher with a local Gondi-speaking senior student or community volunteer.", "कक्षा के किसी बड़े छात्र या स्थानीय साथी की मदद लेने की सलाह दें।"],
        owner: "CRP",
      },
      {
        hi: "बुंदेली में बच्चे बात तो समझ जाते हैं, पर जब परीक्षा में हिंदी में लिखना होता है तो अटक जाते हैं।",
        en: "Children understand in Bundeli, but they get totally stuck when writing answers in Hindi exams.",
        summary: ["Oral Bundeli understanding is not translating into written Hindi", "बुंदेली समझ लेते हैं पर हिंदी में लिखने में अटकते हैं"],
        insight: ["Guide teacher on gradual scaffolding from spoken dialect to written standard sentences.", "बोली से मानक हिंदी वाक्य लेखन तक की क्रमिक प्रक्रिया सिखाएं।"],
        owner: "CRP",
      },
    ],
  },
  absent_buddies: {
    adopted: [
      {
        hi: "जो बच्चा छुट्टी के बाद आता है, उसका जोड़ीदार दस मिनट कॉपी खोलकर पढ़ा देता है। अब किसी का काम नहीं छूटता।",
        en: "When an absent child returns, their buddy spends ten minutes teaching from notebook. No one falls behind.",
        summary: ["Ten-minute peer buddy notebook routine adopted successfully", "लौटने वाले बच्चों को जोड़ीदार दस मिनट कॉपी से पढ़ाते हैं"],
        insight: [
          "Effective peer support system. Ensures learning continuity despite seasonal farm absences.",
          "उत्कृष्ट सहपाठी शिक्षण। फसल कटाई के दौरान छूटी पढ़ाई में बहुत उपयोगी।",
        ],
      },
      {
        hi: "{demo} वाला साथी नियम पक्का कर दिया। हार्वेस्टर के समय कई बच्चे छूटे, पर आते ही साथियों ने सिखा दिया।",
        en: "We locked in the buddy rule like {demo}. Harvest season caused absences, but buddies caught them up.",
        summary: ["Peer catch-up protected learning continuity during harvest season", "फसल कटाई के दौरान साथियों ने छूटा हुआ काम तुरंत सिखाया"],
        insight: [
          "Resilient system for seasonal absenteeism. Document this model for other agricultural belt schools.",
          "कटाई के समय की अनुपस्थिति से निपटने का सफल मॉडल, अन्य स्कूलों को बताएं।",
        ],
        owner: "BEO",
      },
      {
        hi: "हओ सर, बच्चे खुद ही अपनी जोड़ीदार की कॉपी जांच लेते हैं और जो छूटा था वो समझा देते हैं।",
        en: "Yes sir, children themselves check their buddy's notebook and explain whatever was missed.",
        summary: ["Children independently check and re-teach absent partners", "बच्चे खुद जोड़ीदार की कॉपी जांच कर छूटा पाठ समझाते हैं"],
        insight: ["High student agency. Praise classroom culture during next cluster school visit.", "बच्चों में सीखने की स्वतंत्र लगन बनी। अगली शाला भेंट पर सराहना करें।"],
        owner: "CRP",
      },
    ],
    trying: [
      {
        hi: "जोड़ी तो बना दी, पर जो पढ़ा-लिखा साथी है वो कॉपी बस नकल करने दे देता है, समझाता कुछ नहीं।",
        en: "Paired them up, but the stronger buddy just lets the other copy without explaining anything.",
        summary: ["Buddies share notebooks for copying rather than re-teaching", "जोड़ीदार समझाने के बजाय सिर्फ कॉपी से नकल करवा देते हैं"],
        insight: ["Teacher should demonstrate how buddies ask questions instead of just sharing notebooks.", "शिक्षक खुद कक्षा में दिखाएं कि साथी को समझाना कैसे है, न कि नकल।"],
        owner: "Teacher",
      },
      {
        hi: "दो दिन बच्चे आए नहीं तो जोड़ीदार भी परेशान हो गया कि रोज़-रोज़ अपना समय क्यों दे।",
        en: "When kids missed two days, the buddy got frustrated about giving up their own time daily.",
        summary: ["Helper buddies resent losing their own learning time repeatedly", "मदद करने वाले बच्चे रोज़ समय देने से खीझने लगे हैं"],
        insight: ["Limit catch-up to fixed ten minutes during morning assembly or library period.", "जोड़ीदार का समय प्रार्थना या खेल घंटी के केवल दस मिनट तक सीमित रखें।"],
        owner: "Teacher",
      },
      {
        hi: "{demo} के यहाँ देखा था, पर हमारे यहाँ दोनों ही बच्चे कई बार एक साथ हफ़्ते भर गायब रहते हैं।",
        en: "Saw it at {demo}'s, but here both buddies often stay absent together for whole weeks.",
        summary: ["Both paired buddies go absent at the same time", "जोड़ी के दोनों बच्चे एक साथ कई दिन अनुपस्थित रहते हैं"],
        insight: ["Advise creating three-child triads so at least one student is present regularly.", "दो की जगह तीन बच्चों का समूह बनाएं ताकि एक बच्चा नियमित रहे।"],
        owner: "CRP",
      },
    ],
  },
  parent_voice: {
    adopted: [
      {
        hi: "शनिवार को एक मिनट का वॉइस नोट भेजते हैं कि क्या सुनना है। अब पालक बताते हैं कि बच्चे ने घर पर पढ़ा।",
        en: "We send a one-minute voice note on Saturdays. Now parents confirm that their child read at home.",
        summary: ["Weekly voice note engages parents in listening to reading", "शनिवार वॉइस नोट भेजने से पालक बच्चों को घर पर सुन रहे"],
        insight: [
          "Effective parental involvement. Suggest tracking which parents respond most consistently.",
          "अभिभावकों की अच्छी भागीदारी। सक्रिय पालकों की सूची संकुल बैठक में साझा करें।",
        ],
        owner: "Teacher",
      },
      {
        hi: "{demo} जैसी तरकीब काम कर गई। अनपढ़ माता-पिता भी आवाज़ सुनकर समझ जाते हैं कि बच्चे से क्या पढ़वाना है।",
        en: "The idea from {demo} worked. Even non-literate parents listen to audio and know what to hear.",
        summary: ["Voice notes enabled illiterate parents to monitor reading method", "{demo} की तरह ऑडियो संदेश से अनपढ़ पालक भी सहयोग कर रहे"],
        insight: ["Bridged home literacy gap. Highlight this low-cost innovation across the block.", "कम पढ़ी-लिखी माताओं तक संदेश पहुंचा। इस नवाचार को पूरे ब्लॉक में बताएं।"],
        owner: "BEO",
      },
      {
        hi: "वॉइस नोट से पालकों को पता रहता है कि अटकने पर टोकना नहीं है। शनिवार की पढ़ाई अब घर-घर हो रही।",
        en: "Through voice notes parents know not to scold stumbles. Saturday reading is happening in every home now.",
        summary: ["Voice notes guided parents to listen supportively without scolding", "ऑडियो से पालकों ने बच्चों को बिना डांटे सुनना सीख लिया"],
        insight: ["Remarkable shift in home learning culture. Keep audio clips short and encouraging.", "सकारात्मक बदलाव। शिक्षक संदेश हमेशा छोटा और उत्साहवर्धक ही रखें।"],
      },
    ],
    trying: [
      {
        hi: "वॉइस नोट भेजा तो था, पर कई पालकों के पास कीपैड फोन हैं, व्हाट्सएप चलता ही नहीं।",
        en: "Sent voice notes, but many parents have basic keypad phones with no WhatsApp access.",
        summary: ["Parents with basic keypad phones cannot receive voice notes", "साधारण कीपैड फोन होने से कई पालक ऑडियो नहीं सुन पाते"],
        insight: ["Suggest sending brief printed slips via children for families without smartphones.", "बिना स्मार्टफोन वाले घरों के लिए बच्चों की कॉपी में छोटी पर्ची चिपकाएं।"],
        owner: "Teacher",
      },
      {
        hi: "{demo} के यहाँ सबने सुना, पर हमारे यहाँ नंबर तो हैं पर पालक रिचार्ज ही नहीं करवाते।",
        en: "Everyone listened at {demo}'s school, but here parents lack active balance to download audio.",
        summary: ["Unrecharged parent phones prevent downloading audio voice messages", "पालकों के फोन में रिचार्ज न होने से संदेश नहीं पहुंच पा रहे"],
        insight: ["Pair with village volunteer youth to play the voice note in evening mohalla groups.", "गाँव के किसी शिक्षित युवा से शाम को मोहल्ले में संदेश सुनवाने को कहें।"],
        owner: "CRP",
      },
      {
        hi: "मैसेज भेजते हैं पर शनिवार रात को पिता काम से थककर आते हैं, कोई बच्चे की किताब नहीं खोलता।",
        en: "We send messages, but fathers return exhausted from labor on Saturday night and open no books.",
        summary: ["Exhausted laboring parents struggle to find reading time Saturdays", "मजदूरी से थके पालक शनिवार रात बच्चों को समय नहीं दे पाते"],
        insight: ["Encourage older siblings or literate neighbors to act as listeners instead.", "माता-पिता व्यस्त हों तो बड़े भाई-बहन या पड़ोसियों को श्रोता बनाएं।"],
        owner: "Teacher",
      },
    ],
  },
  print_wall: {
    adopted: [
      {
        hi: "बच्चों की लिखी चार-चार लाइनें उनकी आँख के बराबर दीवार पर टांग दी हैं। रोज़ सुबह खुद ही पढ़कर सुनाते हैं।",
        en: "Hung kids' four-line writings at eye-level on the wall. Every morning they read them aloud proudly.",
        summary: ["Eye-level student writings displayed and read aloud daily", "बच्चों की लिखी पंक्तियां दीवार पर लगाईं, वे रोज़ पढ़ते हैं"],
        insight: [
          "Rich print environment created. Review progress during next regular school visit.",
          "कक्षा में भाषाई माहौल बना। अगले निरीक्षण में बच्चों से यह दीवार पढ़वाकर देखें।",
        ],
        owner: "BEO",
      },
      {
        hi: "हओ सर, {demo} जैसी डोरी बांधकर बच्चों की कहानियां लटकाई हैं। जो नहीं पढ़ पाते थे वो भी अपनी कहानी पहचानते हैं।",
        en: "Yes sir, strung lines like {demo} to hang children's stories. Even non-readers recognize their own words.",
        summary: ["Children recognize and read own hung stories with pride", "{demo} की तरह डोरी पर कहानियां टांगी, बच्चे अपनी रचना पहचानते हैं"],
        insight: ["Great visual print ownership. Encourage weekly rotation of fresh child writing.", "बच्चों का जुड़ाव बढ़ा। हर हफ्ते नई लिखी सामग्री बदलने की आदत बनाएं।"],
        owner: "CRP",
      },
      {
        hi: "दीवार पर अपने नाम और वाक्य देखकर बच्चे बहुत खुश हैं। हर शुक्रवार पूरी क्लास मिलकर नए वाक्य पढ़ती है।",
        en: "Seeing their names and sentences on wall thrills kids. Every Friday the whole class reads together.",
        summary: ["Whole-class weekly reading routine around wall displays established", "हर शुक्रवार पूरी कक्षा दीवार पर लगे नए वाक्य पढ़ती है"],
        insight: ["Routine is well established. Suggest adding child-drawn pictures next to text.", "नियमित अभ्यास बन चुका है। वाक्यों के साथ बच्चों के बनाए चित्र भी लगाएं।"],
      },
    ],
    trying: [
      {
        hi: "कागज नीचे लगाए तो छोटे बच्चे नोंचकर फाड़ देते हैं, दो दिन भी दीवार पर टिक नहीं पाते।",
        en: "Hanging papers low leads younger kids to tear them down; they don't last two days.",
        summary: ["Low-hung display papers get torn down by young children", "नीचे लगे कागज छोटे बच्चे फाड़ देते हैं, टिकते नहीं"],
        insight: ["Suggest using cheap plastic sheet covers or a clipped twine line higher up.", "कागजों को पारदर्शी थैली में रखें या डोरी पर क्लिप से टांगने को कहें।"],
        owner: "CRP",
      },
      {
        hi: "{demo} के यहाँ चार्ट साफ़ थे, हमारे यहाँ कच्ची दीवार में सीलन है, गोंद लगाते ही सब छूटकर गिर जाता है।",
        en: "Charts stayed clean at {demo}'s, but our damp mud walls drop anything pasted with glue.",
        summary: ["Damp mud walls prevent pasting paper displays securely", "दीवारों की सीलन से चिपकाए गए चार्ट तुरंत गिर जाते हैं"],
        insight: ["Advise tying a string across window grilles or pillars instead of pasting walls.", "दीवार पर चिपकाने के बजाय खंभों या खिड़कियों के बीच सुतली बांधें।"],
        owner: "Teacher",
      },
      {
        hi: "लगा तो दिए हैं पर बच्चे वही पुराने वाक्य रट लिए हैं, नई चीज़ लिखने में बहुत झिझकते हैं।",
        en: "Displayed them, but children memorized the old sentences and hesitate to write anything new.",
        summary: ["Children memorize static wall sentences and resist writing new ones", "बच्चे पुराने वाक्य रट चुके हैं, नया लिखने में झिझकते हैं"],
        insight: ["CRP should model a shared writing session during next visit to spark new topics.", "संकुल समन्वयक अगली भेंट में साझा लेखन गतिविधि कराकर नए विचार लिखाएं।"],
        owner: "CRP",
      },
    ],
  },
};

/** Any practice: what gets in the way, and calls nobody picks up. Adopted/trying fall back here too. */
export const FOLLOW_UP_LINES: Record<FollowUp["outcome"], FollowUpLine[]> = {
  adopted: [
    {
      hi: "हाँ, दो हफ़्ते से रोज़ कर रहे हैं। बच्चे खुद आकर बैठ जाते हैं।",
      en: "Yes, doing it daily for two weeks. Children now sit down for it on their own.",
      summary: ["Doing it daily for two weeks", "दो हफ़्ते से रोज़ कर रहे हैं"],
      insight: ["It has stuck. Ask the teacher to show a neighbouring school next.", "आदत बन गई। अगली बार पास के स्कूल को दिखाने को कहें।"],
      owner: "CRP",
    },
  ],
  trying: [
    {
      hi: "शुरू किया है, पर अभी हफ़्ते में दो-तीन दिन ही हो पाता है।",
      en: "Started, but only two or three days a week so far.",
      summary: ["Started, two or three days a week", "शुरू किया, हफ़्ते में दो-तीन दिन"],
      insight: ["A fixed daily slot helps it become routine. Check in again next week.", "रोज़ का तय समय आदत बनाता है। अगले हफ़्ते फिर बात करें।"],
      owner: "Teacher",
    },
  ],
  barrier: [
    {
      hi: "सर, पिछले दस दिन से बीएलओ और मतदाता सूची के काम में लगे हैं। स्कूल में पढ़ाने का वक्त ही नहीं मिला।",
      en: "Sir, engaged in BLO voter list duty for ten days. Got no teaching time in school.",
      summary: ["Teacher assigned to BLO election survey duty outside school", "बीएलओ निर्वाचन कार्य में व्यस्तता; शिक्षण समय नहीं मिला"],
      insight: [
        "Administrative duty disrupted teaching; BEO should streamline non-academic duties or protect school instructional hours.",
        "बीएलओ कार्य से पढ़ाई रुकी; बीईओ शिक्षण घंटों के दौरान गैर-शैक्षणिक कार्य सीमित करें।",
      ],
      barrier: "BLO election duty",
      owner: "BEO",
    },
    {
      hi: "गांव में चने और गेहूं की कटाई चल रही है। आधे से ज्यादा बच्चे खेत पर हैं, कक्षा में 4-5 ही आ रहे।",
      en: "Gram and wheat harvesting is ongoing. Over half the kids are in fields; only 4-5 attend.",
      summary: ["Harvest season caused severe drop in student classroom attendance", "फसल कटाई के कारण छात्र उपस्थिति बहुत कम रही"],
      insight: [
        "Seasonal harvest absence; run small-group foundational revision with present students until full attendance resumes.",
        "कटाई के समय उपस्थित बच्चों के साथ छोटे समूह में दोहराव करें।",
      ],
      barrier: "Harvest season absence",
      owner: "Teacher",
    },
    {
      hi: "शाला अनुदान से मिलने वाला टीएलएम और चार्ट पेपर अभी तक नहीं आया। बिना सामग्री कार्ड कैसे बनाएं?",
      en: "TLM and chart paper from school grant haven't arrived. How to make cards without materials?",
      summary: ["TLM grant and stationary materials not yet received", "टीएलएम व चार्ट सामग्री उपलब्ध न होना"],
      insight: [
        "Material bottleneck; BEO office must expedite composite school grant disbursal and basic stationeries distribution.",
        "सामग्री की कमी; बीईओ स्तर से शाला अनुदान राशि और सामग्री तुरंत जारी करवाएं।",
      ],
      barrier: "Missing TLM supplies",
      owner: "BEO",
    },
    {
      hi: "अकेले हमीं हैं पांचों कक्षाओं के लिए। गतिविधि कराएं तो बाकी चार कमरों में हल्ला मचने लगता है।",
      en: "I am alone for all five grades. If I do activities, other rooms get chaotic.",
      summary: ["Single teacher unable to manage multigrade activity noise", "एकल शिक्षक; गतिविधि के दौरान अन्य कक्षाएं संभालना कठिन"],
      insight: [
        "Severe multigrade constraint; CRP should demonstrate specific self-learning silent worksheets for unoccupied classes.",
        "एकल शिक्षकीय चुनौती; संकुल समन्वयक अन्य कक्षाओं के लिए स्व-अध्ययन कार्यपत्रक सुझाएं।",
      ],
      barrier: "Single teacher multigrade",
      owner: "CRP",
    },
    {
      hi: "हमारे यहां गोंडी बोलने वाले बच्चे हैं, हिंदी के लंबे निर्देश समझ ही नहीं पाते। हम भाषा में अटक गए।",
      en: "We have Gondi-speaking children; they don't understand long Hindi instructions. Language is stuck.",
      summary: ["Gondi-speaking children struggle with standard Hindi instructions", "गोंडी भाषी बच्चों को हिंदी निर्देश समझने में समस्या"],
      insight: [
        "Linguistic gap; CRP should provide bilingual picture glossaries and demonstrate action-led physical gestures.",
        "भाषा बाधा; संकुल समन्वयक द्विभाषी चित्र सामग्री व अभिनय आधारित निर्देश प्रदर्शित करें।",
      ],
      barrier: "Home language Gondi",
      owner: "CRP",
    },
    {
      hi: "प्रधानाध्यापक जी बोले कि पहले वार्षिक परीक्षा का कोर्स पूरा कराओ, खेल-कूद कराने का समय नहीं है।",
      en: "Headmaster insisted on finishing annual exam syllabus first, saying no time for games.",
      summary: ["Headmaster prioritized textbook completion over FLN activity pedagogy", "प्रधानाध्यापक ने गतिविधि रोककर पाठ्यक्रम पूरा करने को कहा"],
      insight: [
        "Leadership misalignment; BEO should brief headmasters during monthly meetings that FLN activities support syllabus learning.",
        "बीईओ प्रधानाध्यापकों को स्पष्ट करें कि बुनियादी दक्षताएं ही पाठ्यक्रम का मूल हैं।",
      ],
      barrier: "Headmaster syllabus pressure",
      owner: "BEO",
    },
    {
      hi: "{demo} ने जल्दी-जल्दी बताया था, हमें क्रम ठीक से समझ नहीं आया कि पहले ध्वनि लें या अक्षर।",
      en: "{demo} explained very quickly; I didn't grasp the sequence: sound first or letter first.",
      summary: ["Teacher unclear on exact pedagogical steps shown by peer", "गतिविधि के चरणों का सही क्रम स्पष्ट नहीं"],
      insight: [
        "Clarity missing; CRP should schedule a live 20-minute classroom modeling visit to demonstrate sequence.",
        "भ्रम दूर करने हेतु संकुल समन्वयक स्वयं कक्षा में आकर 20 मिनट डेमो दें।",
      ],
      barrier: "Unclear activity steps",
      owner: "CRP",
    },
    {
      hi: "ईंट-भट्ठों पर कई परिवार चले गए हैं, 10 बच्चे शाला छोड़कर पलायन कर गए। कक्षा खाली पड़ी है।",
      en: "Families migrated to brick kilns; ten enrolled children migrated. Classroom is half empty.",
      summary: ["Seasonal brick kiln migration caused steep drop in students", "ईंट भट्ठा पलायन से बच्चे शाला छोड़कर चले गए"],
      insight: [
        "Seasonal migration impact; compile migrant student list for BEO to coordinate transit education facility.",
        "पलायन की समस्या; बीईओ स्तर पर पलायन ट्रैकिंग और मौसमी हॉस्टल व्यवस्था देखें।",
      ],
      barrier: "Brick kiln migration",
      owner: "BEO",
    },
    {
      hi: "छात्रवृत्ति पोर्टल पर समग्र आईडी की ई-केवाईसी और मैपिंग करनी पड़ रही। पूरा हफ्ता कंप्यूटर सेंटर में बीता।",
      en: "Had to do Samagra ID e-KYC and scholarship mapping. Spent whole week at computer center.",
      summary: ["Online student portal administrative work took full teaching week", "छात्रवृत्ति पोर्टल और केवाईसी कार्य में पूरा हफ्ता बीता"],
      insight: [
        "Administrative data entry burden; BEO can arrange cluster-level common data entry camps on weekends.",
        "डाटा एंट्री का बोझ; बीईओ संकुल स्तर पर साझा ऑपरेटर शिविर लगवाएं।",
      ],
      barrier: "Scholarship portal duty",
      owner: "BEO",
    },
    {
      hi: "बरसात की सीलन से छत का प्लास्टर गिर रहा है, एक ही सूखा कमरा बचा है। गतिविधि कराने की जगह नहीं है।",
      en: "Ceiling plaster falling from moisture; only one dry room remains. No space to conduct activities.",
      summary: ["Damaged classroom roof left inadequate physical space for activities", "क्षतिग्रस्त छत; गतिविधि कराने के लिए पर्याप्त जगह नहीं"],
      insight: [
        "Infrastructure emergency; BEO must flag room repair under civil maintenance grants immediately.",
        "भवन मरम्मत की दरकार; बीईओ तत्काल मरम्मत मद से कार्य स्वीकृत कराएं।",
      ],
      barrier: "Damaged classroom space",
      owner: "BEO",
    },
    {
      hi: "कुछ पालकों ने शिकायत की कि मास्टर जी दिनभर खेल खिलाते हैं, कापी में कुछ लिखवाते नहीं।",
      en: "Some parents complained that teacher only plays games all day without notebook writing.",
      summary: ["Parents objected, viewing foundational games as wasted learning time", "अभिभावकों ने खेल-खेल में सीखने पर आपत्ति जताई"],
      insight: [
        "Parental expectation mismatch; CRP can help conduct a short parent meeting demonstrating FLN workbook progress.",
        "पालक-शिक्षक बैठक में खेल और सीखने के संबंध को समझाएं।",
      ],
      barrier: "Parental community resistance",
      owner: "CRP",
    },
    {
      hi: "कार्यपुस्तिकाएं अभी तक भोपाल से नहीं पहुंची हैं। बिना किताब के अभ्यास कैसे करवाएं?",
      en: "FLN workbooks have not arrived from Bhopal yet. How to conduct exercises without books?",
      summary: ["State FLN workbooks delayed; method halted without print materials", "एफएलएन कार्यपुस्तिकाएं न मिलने से अभ्यास रुका"],
      insight: [
        "Textbook supply chain delay; BEO office must follow up textbook depot distribution immediately.",
        "पुस्तिका वितरण में देरी; बीईओ कार्यालय पाठ्यपुस्तक डिपो से शीघ्र वितरण कराए।",
      ],
      barrier: "Delayed FLN workbooks",
      owner: "BEO",
    },
    {
      hi: "हम दस दिन से अस्वस्थ थे, मेडिकल छुट्टी पर रहे। कल ही स्कूल लौटे हैं, अभी शुरू नहीं कर पाए।",
      en: "I was unwell on medical leave for ten days. Just returned yesterday; haven't started.",
      summary: ["Teacher was on approved medical leave; couldn't initiate method", "शिक्षक के अस्वस्थ होने से अभ्यास शुरू नहीं हुआ"],
      insight: [
        "Legitimate medical absence; CRP should check in next week without pressure to support fresh start.",
        "स्वास्थ्य अवकाश पर थे; अगले सप्ताह संकुल समन्वयक सहज शुरुआत में मदद करें।",
      ],
      barrier: "Teacher medical leave",
      owner: "CRP",
    },
    {
      hi: "{demo} के स्कूल में अलग-अलग कमरे हैं, हमारे यहां एक ही हाल में 5 क्लास बैठती हैं। बहुत शोर मचता है।",
      en: "{demo}'s school has separate rooms; here 5 classes share one hall. Too noisy.",
      summary: ["Single hall for all grades creates overwhelming activity noise", "एक ही कमरे में पांच कक्षाएं; गतिविधि से अत्यधिक शोर"],
      insight: [
        "Acoustic space constraint; suggest outdoor open-air FLN circles under tree shade to avoid hall noise.",
        "जगह की कमी; खुले मैदान या पेड़ की छांव में भाषा-गणित चक्र लगवाएं।",
      ],
      barrier: "Single room overcrowding",
      owner: "CRP",
    },
    {
      hi: "माध्यमिक शाला के शिक्षक का ट्रांसफर हो गया, हमें वहां भी दो पीरियड गणित पढ़ाने जाना पड़ता है।",
      en: "Middle school teacher transferred; I must go there to teach two math periods daily.",
      summary: ["Teacher deputed to cover middle school periods daily", "माध्यमिक शाला में अध्यापन की अतिरिक्त जिम्मेदारी"],
      insight: [
        "Workload stretching; BEO needs to rationalise teacher deployment to protect primary foundational hours.",
        "शिक्षक पर अतिरिक्त प्रभार; बीईओ प्राथमिक शाला में समय की सुरक्षा हेतु व्यवस्था देखें।",
      ],
      barrier: "Middle school deputation",
      owner: "BEO",
    },
  ],
  no_answer: [
    {
      hi: "(फ़ोन की घंटी बजती रही, पर शिक्षक ने कॉल नहीं उठाया।)",
      en: "(Phone kept ringing, but the teacher did not answer the call.)",
      summary: ["Phone rang completely with no response from teacher", "घंटी बजी किंतु शिक्षक ने कॉल नहीं उठाया"],
      insight: [
        "Teacher may be teaching; reschedule automated call or reminder text message after 4:00 PM.",
        "शिक्षक अध्यापन में व्यस्त हो सकते हैं; शाम 4 बजे बाद पुनः संपर्क करें।",
      ],
    },
    {
      hi: "(नंबर नेटवर्क क्षेत्र से बाहर होने का संदेश आ रहा है।)",
      en: "(Automated message: The dialed number is out of network coverage.)",
      summary: ["Teacher's phone is currently out of network coverage", "शिक्षक का नंबर नेटवर्क क्षेत्र से बाहर मिला"],
      insight: [
        "Rural network issue; task local CRP to meet teacher directly during regular cluster school rounds.",
        "ग्रामीण नेटवर्क समस्या; संकुल समन्वयक शाला भ्रमण के दौरान व्यक्तिगत चर्चा करें।",
      ],
      owner: "CRP",
    },
    {
      hi: "(कॉल सीधे कट गया और स्विच ऑफ बताने लगा।)",
      en: "(Call disconnected immediately and switched to 'switched off' status.)",
      summary: ["Call disconnected immediately; phone appears switched off", "कॉल तुरंत कट गया; फोन बंद मिला"],
      insight: [
        "Battery drained or poor tower connectivity; retry call next morning during official school assembly hour.",
        "फोन बंद मिला; अगले कार्यदिवस सुबह प्रार्थना सत्र के समय पुनः कॉल करें।",
      ],
    },
    {
      hi: "(दो बार घंटी जाने के बाद व्यस्त टोन आई, कॉल काट दिया गया।)",
      en: "(Busy tone after two rings; call was disconnected by receiver.)",
      summary: ["Teacher busy and disconnected the call after two rings", "दो घंटी बाद कॉल काटा गया; शिक्षक व्यस्त"],
      insight: [
        "Likely managing active classroom; send a friendly SMS requesting a convenient callback window.",
        "कक्षा में व्यस्त होने की संभावना; व्हाट्सएप या संदेश भेजकर बात का समय पूछें।",
      ],
    },
  ],
};
