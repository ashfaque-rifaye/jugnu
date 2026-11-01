// The takes of the demo film. Each is run by demo/capture.mjs against the real app and the real agent.
// The whole film must stay under 3 minutes, so each walk is brisk: about as long as the words over it.
const openChat = async (a) => {
  // The helpers beside the orb fade in on hover: rest on the orb first.
  await a.hover("[data-agent] .dock-orb", undefined, 300);
  await a.click('[data-agent] button[aria-label="Chat with Jugnu"]');
  await a.wait(500);
};
const nav = async (a, text, title = text) => {
  await a.click("aside a, nav a", text, 400);
  await a.ready(title);
  await a.wait(500);
};
const anyText = "main *";
const hovers = async (a, list, ms) => {
  for (const t of list) await a.hover(anyText, t, ms);
};

export const scenarios = {
  /** The real call, placed directly on the phone line (for when the agent cannot place it), filmed on the live page. */
  line: {
    reset: true,
    before: (a) => a.go("/interviews?tab=phone", 3000),
    run: async (a) => {
      await a.wait(1500);
      a.mark("ringing");
      await a.dial({ teacherName: "Rajendra Patel", schoolName: "GPS Bandhna", group: "bright", language: "hi" });
      await a.followCall();
      a.mark("end");
    },
  },
  /** The guided walk under the narration. Marks name the parts the edit uses. Taken last, so the board shows the agent's work. */
  tour: {
    before: (a) => a.go("/", 3500),
    run: async (a) => {
      a.mark("home");
      await a.wait(3000);
      await a.scroll(900, 2200);
      await a.wait(1500);
      await a.go("/schools", 1800);
      a.mark("find");
      await hovers(a, ["Doing well"], 500);
      await a.click(anyText, "Doing well", 900);
      await a.hover("main tbody tr", undefined, 800);
      await a.click("main tbody tr a, main tbody tr", undefined, 1400);
      await a.scroll(380, 1000);
      await a.wait(700);
      a.mark("rollout");
      await nav(a, "Share with schools", "Block office");
      await a.scroll(180, 500);
      await hovers(a, ["Block office", "Cluster coordinators", "School heads", "Class teachers"], 500);
      a.mark("approvals");
      await nav(a, "Approvals", "Listen");
      await a.hover(anyText, "Voice note to a teacher", 500);
      await a.hover("main button", "Approve", 500);
      await a.click("main button", "Approve", 900);
      a.mark("board");
      await nav(a, "Share with schools", "Block office");
      await a.click("main button, main [role=tab]", "Task board", 1200);
      await a.hover(anyText, "Waiting for sign-off", 700);
      a.mark("history");
      await a.click("main [role=tab], main [role=radio], main .seg-item, main button:not([aria-label])", "History", 1600);
      a.mark("district");
      await nav(a, "District", "Confirmed doing well");
      await hovers(a, ["Confirmed doing well"], 500);
      await a.scroll(560, 900);
      await a.wait(900);
      await a.scroll(900, 1000);
      await hovers(a, ["Methods that stand out"], 800);
      a.mark("term");
      await nav(a, "Today", "Namaste");
      await a.click("main button", "Play the term", 800);
      await a.wait(44000);
      a.mark("results");
      await nav(a, "Check progress", "progress");
      await a.wait(600);
      await a.hover(anyText, "Did children learn more", 1200);
      await a.wait(600);
      a.mark("end");
    },
  },

  /** The officer's voice: finds the school and shows it. Stops short of calling, for rehearsals. */
  dry1: {
    reset: true,
    before: (a) => a.go("/today", 3000),
    run: async (a) => {
      await a.wait(1200);
      a.mark("v1");
      await a.say("V1");
      a.mark("v2");
      await a.say("V2", { tap: false });
      await a.wait(800);
      await a.stopVoice();
      a.mark("end");
      console.log(await a.lastWords());
    },
  },

  /** The same, and then the real call: this one rings the phone. */
  call: {
    reset: true,
    before: (a) => a.go("/today", 3000),
    run: async (a) => {
      await a.wait(1200);
      a.mark("v1");
      await a.say("V1");
      a.mark("v2");
      await a.say("V2", { tap: false });
      await a.wait(800);
      a.mark("v3");
      await a.say("V3", { tap: false });
      await a.stopVoice();
      a.mark("ringing");
      // The agent normally opens the phone line itself; if not, go there so the live words are on screen.
      const onLine = await a.page.evaluate(() => location.search.includes("tab=phone"));
      if (!onLine) {
        a.log("opening-phone-line");
        await a.click("aside a, nav a", "Talk to teachers", 900);
        await a.click("main button", "Phone line", 900);
      }
      await a.followCall();
      a.mark("end");
    },
  },

  /** After the call: what was learned by voice, the plan by chat, the district by voice. */
  plan: {
    reset: true,
    before: (a) => a.go("/interviews?tab=phone", 3000),
    run: async (a) => {
      await a.wait(800);
      a.mark("v4");
      await a.say("V4");
      await a.wait(1500);
      await a.stopVoice();
      a.mark("chat");
      await openChat(a);
      // In the chat, replies are read on screen: no voice, so the work moves faster.
      await a.click('[data-agent] button[aria-label="Mute voice"]', undefined, 300);
      await a.type("Which nearby schools need this method most? Show me the plan.");
      a.mark("schedule");
      await a.type("For the first of those schools, schedule the peer voice note and the classroom visit, and put a follow-up call on the clock in 14 days.");
      await a.wait(1500);
      a.mark("close");
      await a.click('[data-agent] button[aria-label="Read replies aloud"]', undefined, 300);
      await a.click('[data-agent] button[aria-label="Close"]');
      a.mark("v5");
      await a.say("V5");
      await a.wait(1200);
      await a.stopVoice();
      a.mark("end");
    },
  },
};
