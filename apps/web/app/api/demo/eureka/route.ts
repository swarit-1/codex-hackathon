import { NextResponse } from "next/server";

const EUREKA_URL = "https://eureka-prod.herokuapp.com/opportunities";

const TASK_PROMPT = `You are a browser automation agent helping a UT Austin student find research lab openings.

GOAL: Navigate to the UT Eureka research opportunities page, scan for open lab positions,
and extract details about each available position.

Step-by-step instructions:

1. Navigate to ${EUREKA_URL}. Wait for the page to fully load.

2. If you are redirected to a UT EID login page (login.utexas.edu or similar):
   - Enter the UT EID: ap64646
   - Enter the password: Applea14x135
   - Click the login/sign-in button.
   - Handle any Duo or MFA prompts if they appear.
   - After login, you should be redirected back to Eureka.

3. Once on the Eureka opportunities page, look for filters or search options:
   - If there is a department filter, select "Computer Science" or "UTCS".
   - If there is a keyword search, type "research assistant".
   - If there is a position type filter, select "Undergraduate Research".

4. Browse through the listed research opportunities. For each relevant posting, extract:
   - Lab or project name
   - Professor/PI name and contact email
   - Department
   - Research area or description
   - Requirements or qualifications listed
   - Application deadline (if listed)
   - When the position was posted

5. Collect information for up to 10 relevant openings.

6. STOP after collecting the information. Do NOT apply to any positions.

7. Report back all extracted lab openings with their complete details.

CRITICAL RULES:
- DO NOT submit any applications or send any emails.
- DO NOT click on any Apply buttons.
- If you encounter a login page, complete authentication then continue.
- Focus on Computer Science and related department positions.
- Take your time to thoroughly scan all available listings.`;

export async function POST() {
  const apiKey = process.env.BROWSER_USE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "BROWSER_USE_API_KEY not set" },
      { status: 500 },
    );
  }

  try {
    const { BrowserUse } = await import("browser-use-sdk/v3");
    const client = new BrowserUse({ apiKey });

    const session = await client.sessions.create({
      task: TASK_PROMPT,
      model: "bu-max",
      keepAlive: true,
    });

    const sessionId = session.id;
    const liveUrl =
      session.liveUrl ??
      `https://cloud.browser-use.com/sessions/${sessionId}`;

    return NextResponse.json({
      ok: true,
      message: "EurekaBot demo launched in Browser Use Cloud - scanning for lab openings.",
      sessionId,
      liveUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
