// The takes of the demo film. Each is run by demo/capture.mjs against the real app and the real agent.
const openChat = async (a) => {
  // The helpers beside the orb fade in on hover: rest on the orb first.
  await a.hover("[data-agent] .dock-orb", undefined, 300);
  await a.click('[data-agent] button[aria-label="Chat with Jugnu"]');
  await a.wait(500);
};
const nav = async (a, text, title = text) => {
  await a.click("aside a, nav a", text, 500);
  await a.ready(title);
  await a.wait(700);
};
const anyText = "main *";
const hovers = async (a, list, ms = 1100) => {
  for (const t of list) {
    await a.hover(anyText, t, ms);
  }
};

export const scenarios = {
  dtest: {
    before: (a) => a.go("/plan", 3000),
    run: async (a) => {
      await nav(a, "District");
      await a.hover(anyText, "Confirmed", 900);
      await a.scroll(560, 1400);
      a.log("scrolled");
      await a.wait(2000);
      await a.scroll(900, 1800);
      await a.hover(anyText, "Methods that stand out", 1500);
      a.log("end");
    },
  },
  /** The guided walk through the pages, under the narration. Marks name the parts the edit uses. */
  tour: {
    reset: true,
    before: (a) => a.go("/", 3500),
    run: async (a) => {
      a.mark("home");
      await a.wait(3500);
      await a.scroll(900, 2400);
      await a.wait(2500);
      await a.go("/today", 2000);
      a.mark("today");
      await a.wait(800);
      await hovers(a, ["This term", "Live activity"], 1000);
      a.mark("find");
      await nav(a, "Find schools", "Schools");
      await hovers(a, ["Doing well"], 700);
      await a.click(anyText, "Doing well", 1500);
      await a.hover("main tbody tr", undefined, 1400);
      await a.click("main tbody tr a, main tbody tr", undefined, 2200);
      a.mark("school");
      await a.scroll(420, 1500);
      await a.wait(1800);
      a.mark("rollout");
      await nav(a, "Share with schools", "Block office");
      await a.scroll(180, 700);
      await hovers(a, ["Block office", "Cluster coordinators", "School heads", "Class teachers", "2,369 children"], 1300);
      a.mark("progress");
      await hovers(a, ["Voice note sent", "Saw it in a real class", "Doing it regularly"], 800);
      a.mark("approvals");
      await nav(a, "Approvals", "Listen");
      await a.hover(anyText, "Voice note to a teacher", 900);
      await a.click("main button", "Listen", 7000);
      await a.hover("main button", "Approve", 900);
      await a.click("main button", "Approve", 2200);
      a.mark("board");
      await nav(a, "Share with schools", "Block office");
      await a.click("main button, main [role=tab]", "Task board", 2200);
      await a.scroll(240, 900);
      await a.wait(1600);
      await a.scroll(-240, 700);
      a.mark("history");
      await a.click("main [role=tab], main [role=radio], main .seg-item, main button:not([aria-label])", "History", 2600);
      a.mark("district");
      await nav(a, "District", "Confirmed doing well");
      await hovers(a, ["Confirmed doing well", "Schools that need support"], 900);
      await a.scroll(560, 1400);
      await a.wait(2200);
      await a.scroll(900, 1800);
      await hovers(a, ["Methods that stand out"], 2200);
      a.mark("term");
      await nav(a, "Today", "Namaste");
      await a.click("main button", "Play the term", 1500);
      await a.wait(44000);
      a.mark("results");
      await nav(a, "Check progress", "");
      await a.wait(2000);
      await a.scroll(500, 1400);
      await a.wait(2200);
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
      await a.wait(1500);
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
      await a.wait(1200);
      a.mark("v3");
      await a.say("V3", { tap: false });
      await a.stopVoice();
      a.mark("ringing");
      await a.followCall();
      a.mark("end");
    },
  },

  /** After the call: what was learned by voice, the plan by chat, the district by voice. */
  plan: {
    before: (a) => a.go("/interviews?tab=phone", 3000),
    run: async (a) => {
      await a.wait(1000);
      a.mark("v4");
      await a.say("V4");
      await a.wait(2000);
      await a.stopVoice();
      a.mark("chat");
      await openChat(a);
      await a.type("Which nearby schools need this method most? Show me the plan.");
      a.mark("schedule");
      await a.type("For the first of those schools, schedule the peer voice note and the classroom visit, and put a follow-up call on the clock in 14 days.");
      await a.wait(2500);
      a.mark("close");
      await a.click('[data-agent] button[aria-label="Close"]');
      a.mark("v5");
      await a.say("V5");
      await a.wait(1500);
      await a.stopVoice();
      a.mark("end");
    },
  },
};
