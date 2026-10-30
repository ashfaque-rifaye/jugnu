// Each teaching method in everyday words: what it is, how to do it tomorrow, and what children do.
// This is what a teacher reads; the numbers beside it come from the block's own data.
import type { PracticeId } from "../engine/practices";

export interface MethodWords {
  plain: [string, string];
  steps: [string, string][];
  children: [string, string];
  needs: [string, string];
  classes: number[];
}

export const METHOD_WORDS: Record<PracticeId, MethodWords> = {
  level_groups: {
    plain: ["Group children by how well they read, not by their class, for the first part of each day.", "दिन के पहले हिस्से में बच्चों को कक्षा से नहीं, पढ़ने के स्तर से समूह में बैठाएँ।"],
    steps: [
      ["On Monday, listen to each child read and note their level: letters, words, paragraph or story.", "सोमवार को हर बच्चे को पढ़ते सुनें और स्तर लिखें: अक्षर, शब्द, अनुच्छेद या कहानी।"],
      ["For the first 40 minutes each day, seat children in those four groups and give each group its own task.", "रोज़ पहले 40 मिनट बच्चों को इन चार समूहों में बैठाएँ और हर समूह को अलग काम दें।"],
      ["Listen again next Monday and move children up as they improve.", "अगले सोमवार फिर सुनें और जो आगे बढ़े उन्हें अगले समूह में भेजें।"],
    ],
    children: ["Each child works at their own level, and stronger readers read to the others.", "हर बच्चा अपने स्तर पर काम करता है, और अच्छा पढ़ने वाले दूसरों को पढ़कर सुनाते हैं।"],
    needs: ["No cost. Cards made from old notebooks are enough.", "कोई खर्च नहीं। पुरानी कॉपियों से बने कार्ड काफ़ी हैं।"],
    classes: [1, 2, 3, 4, 5],
  },
  number_talk: {
    plain: ["Start each day with 10 minutes of spoken maths using sticks or pebbles.", "हर दिन की शुरुआत तीलियों या कंकड़ से 10 मिनट मौखिक गणित से करें।"],
    steps: [
      ["Give every child bundles of 10 sticks or a handful of pebbles.", "हर बच्चे को 10-10 तीलियों के बंडल या मुट्ठी भर कंकड़ दें।"],
      ["Say a problem aloud. Children solve it with their hands, then in pairs.", "सवाल बोलकर दें। बच्चे हाथों से हल करें, फिर जोड़ी में।"],
      ["Ask two children to explain how they got the answer.", "दो बच्चों से पूछें कि उन्हें जवाब कैसे मिला।"],
    ],
    children: ["Children explain their thinking aloud, instead of copying from the board.", "बच्चे बोर्ड से उतारने के बजाय अपनी सोच बोलकर बताते हैं।"],
    needs: ["No cost. Sticks and pebbles from the school yard.", "कोई खर्च नहीं। स्कूल के आँगन की तीलियाँ और कंकड़।"],
    classes: [1, 2, 3, 4, 5],
  },
  home_language: {
    plain: ["Explain new words first in the language children speak at home, then move to Hindi.", "नए शब्द पहले घर की बोली में समझाएँ, फिर हिंदी पर आएँ।"],
    steps: [
      ["Make a chart of common words in the children's home language beside their Hindi words.", "घर की बोली के आम शब्दों और उनके हिंदी शब्दों का चार्ट बनाएँ।"],
      ["Introduce each new idea in the home language first.", "हर नई बात पहले घर की बोली में बताएँ।"],
      ["Let children answer in either language, then say it together in Hindi.", "बच्चों को किसी भी भाषा में जवाब देने दें, फिर साथ में हिंदी में बोलें।"],
    ],
    children: ["Children speak up from the first day, because they understand the question.", "बच्चे पहले दिन से बोलते हैं, क्योंकि उन्हें सवाल समझ आता है।"],
    needs: ["No cost. One chart paper.", "कोई खर्च नहीं। एक चार्ट पेपर।"],
    classes: [1, 2, 3],
  },
  absent_buddies: {
    plain: ["When a child comes back after missing school, a classmate helps them catch up.", "जब कोई बच्चा छुट्टी के बाद लौटे, तो उसका साथी छूटा काम करवाता है।"],
    steps: [
      ["Pair every child with a buddy at the start of the term.", "सत्र की शुरुआत में हर बच्चे की एक जोड़ी बनाएँ।"],
      ["When a child returns, the buddy shows the notebook and goes through the missed work for 10 minutes.", "बच्चा लौटे तो साथी कॉपी दिखाकर 10 मिनट छूटा काम करवाए।"],
      ["Ask two quick questions to check the child has caught up.", "दो छोटे सवाल पूछकर देखें कि बच्चा समझ गया।"],
    ],
    children: ["Children who miss school do not fall behind, and buddies learn by teaching.", "छुट्टी करने वाले बच्चे पीछे नहीं छूटते, और साथी सिखाकर सीखते हैं।"],
    needs: ["No cost.", "कोई खर्च नहीं।"],
    classes: [1, 2, 3, 4, 5],
  },
  parent_voice: {
    plain: ["Every Saturday, children read aloud to a parent at home.", "हर शनिवार बच्चे घर पर माता या पिता को पढ़कर सुनाते हैं।"],
    steps: [
      ["Choose one short page for the week.", "हफ़्ते के लिए एक छोटा पन्ना चुनें।"],
      ["Send parents a one-minute voice note about what to listen for.", "माता-पिता को एक मिनट का वॉइस नोट भेजें कि क्या सुनना है।"],
      ["On Monday, ask children what their parent said.", "सोमवार को बच्चों से पूछें कि घर पर क्या कहा गया।"],
    ],
    children: ["Children practise reading at home, and parents see their progress.", "बच्चे घर पर पढ़ने का अभ्यास करते हैं, और माता-पिता प्रगति देखते हैं।"],
    needs: ["Almost no cost. A basic phone for the voice note.", "लगभग कोई खर्च नहीं। वॉइस नोट के लिए साधारण फ़ोन।"],
    classes: [1, 2, 3, 4, 5],
  },
  print_wall: {
    plain: ["Put children's own sentences on the wall at their eye level, and read them each week.", "बच्चों के लिखे वाक्य उनकी आँखों की ऊँचाई पर दीवार पर लगाएँ और हर हफ़्ते पढ़ें।"],
    steps: [
      ["Each child writes one sentence about their week.", "हर बच्चा अपने हफ़्ते के बारे में एक वाक्य लिखे।"],
      ["Put them on the wall at the children's eye level.", "उन्हें बच्चों की आँखों की ऊँचाई पर लगाएँ।"],
      ["Children read each other's sentences aloud once a week.", "हफ़्ते में एक बार बच्चे एक-दूसरे के वाक्य पढ़ें।"],
    ],
    children: ["Children read what their friends wrote, which they want to read.", "बच्चे अपने दोस्तों का लिखा पढ़ते हैं, जो उन्हें पढ़ने का मन होता है।"],
    needs: ["Low cost. Paper and tape.", "कम खर्च। कागज़ और टेप।"],
    classes: [1, 2, 3, 4, 5],
  },
  circular_compliance: { plain: ["Teaching strictly as the official lesson plan says.", "सिर्फ़ पाठ योजना के अनुसार पढ़ाना।"], steps: [], children: ["", ""], needs: ["", ""], classes: [] },
  extra_worksheets: { plain: ["Sending extra worksheets home every day.", "रोज़ अतिरिक्त वर्कशीट घर भेजना।"], steps: [], children: ["", ""], needs: ["", ""], classes: [] },
  weekly_tests: { plain: ["A written test every week.", "हर हफ़्ते लिखित टेस्ट।"], steps: [], children: ["", ""], needs: ["", ""], classes: [] },
};
