import type { Clip } from "../components/media";

// Cinematic clips generated with Google Flow (Veo 3.1) for this project — see public/media.
export const MEDIA = {
  hero: "/media/jugnu-hero.mp4",
  map: "/media/jugnu-map.mp4",
  call: "/media/jugnu-call.mp4",
  demo: "/media/jugnu-demo.mp4",
  spread: "/media/jugnu-spread.mp4",
  officer: "/media/jugnu-officer.mp4",
  voicenote: "/media/jugnu-voicenote.mp4",
  fireflies: "/media/jugnu-fireflies.mp4",
  ribbonsMono: "/media/jugnu-ribbons-mono.mp4",
  sunrise: "/media/jugnu-sunrise.mp4",
  lantern: "/media/jugnu-lantern.mp4",
  pillars: "/media/jugnu-pillars.mp4",
  welcome: "/media/jugnu-welcome.mp4",
  welcomePoster: "/media/jugnu-welcome.jpg",
  network: "/media/jugnu-network.mp4",
  networkPoster: "/media/jugnu-network.jpg",
};

export const TOUR: Clip[] = [
  {
    src: MEDIA.hero,
    title: "The answer is often already in the block",
    caption: "In every block a few schools — with the same poverty, languages and staff shortages — get children reading and counting. Jugnu finds them.",
    captionHi: "हर ब्लॉक में कुछ स्कूल, उन्हीं हालात में, बच्चों को पढ़ना-गिनना सिखा रहे हैं। जुगनू उन्हें ढूँढता है।",
  },
  {
    src: MEDIA.map,
    title: "1 · Find & verify",
    caption: "Context the state already holds predicts each school's expected score. Schools that beat it in 2 of 3 years become candidates — then a 15-minute spot check separates real bright spots from inflated data.",
    captionHi: "हर स्कूल का अपेक्षित परिणाम निकालते हैं; जो 3 में से 2 साल उससे आगे हैं, उनकी मौके पर जाँच होती है।",
  },
  {
    src: MEDIA.call,
    title: "2 · Ask the teachers",
    caption: "An AI voice interviewer calls bright-spot teachers — and similar ordinary schools — for 12 minutes in their language, and asks for concrete routines.",
    captionHi: "AI आवाज़ में 12 मिनट की बातचीत — ठीक-ठीक क्या होता है, कितने मिनट, कौन-सी चीज़ें।",
  },
  {
    src: MEDIA.demo,
    title: "3 · What actually makes the difference",
    caption: "Only practices that are specific to bright spots, cost nothing extra, and are described in concrete detail survive the contrast.",
    captionHi: "वही तरीके बचते हैं जो सिर्फ़ अच्छे स्कूलों में हैं, मुफ़्त हैं और ठोस रूप से बताए गए हैं।",
  },
  {
    src: MEDIA.voicenote,
    title: "4 · Spread sideways, in a teacher's own voice",
    caption: "Each struggling school gets one practice, a 60-second voice note in a nearby teacher's own words, and a peer visit organised by the cluster resource person.",
    captionHi: "हर स्कूल को एक तरीका, पास के शिक्षक की आवाज़ में संदेश, और उनके स्कूल जाकर देखने का मौका।",
  },
  {
    src: MEDIA.lantern,
    title: "Teacher to teacher, not top-down",
    caption: "The practice travels between peers — each teacher who adopts it becomes the next demonstrator for the schools around them.",
    captionHi: "तरीका शिक्षक से शिक्षक तक पहुँचता है — जो अपनाता है, वही अगले स्कूलों के लिए उदाहरण बनता है।",
  },
  {
    src: MEDIA.spread,
    title: "5 · Track what transfers",
    caption: "Follow-up calls at day 14, then wave 1 vs wave 2 at the next assessment — the block learns which practices actually work here.",
    captionHi: "14वें दिन फ़ॉलो-अप, फिर अगली परीक्षा में पहली और दूसरी लहर की तुलना।",
  },
  {
    src: MEDIA.officer,
    title: "Every gap gets an owner",
    caption: "The Block Education Officer sees locally proven actions, who owns each one, and what's stuck — instead of just where learning is low.",
    captionHi: "BEO को दिखता है: कौन-सा काम, किसके ज़िम्मे, और कहाँ अटका है।",
  },
  {
    src: MEDIA.sunrise,
    title: "Every block, every term",
    caption: "The loop runs again after each assessment cycle — so every block keeps finding, verifying and spreading what already works in its own schools.",
    captionHi: "हर परीक्षा के बाद यह चक्र फिर चलता है — हर ब्लॉक अपने ही स्कूलों से सीखता रहता है।",
  },
];
