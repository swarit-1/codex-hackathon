import { NextResponse } from "next/server";

const EUREKA_URL = "https://eureka-prod.herokuapp.com/opportunities";

const TASK_PROMPT = `You are a browser automation agent helping a UT Austin student find research lab openings.

GOAL: Navigate to the UT Eureka research opportunities page, scan for open lab positions,
and extract details about each available position.

Step-by-step instructions:

1. Navigate to ${EUREKA_URL}. Wait for the page to fully load.

2. If you are redirected to a UT EID login page (login.utexas.edu or similar):
   - Enter the UT EID: rv25852
   - Enter the password: Tac0bellisgood$

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
    const response = await fetch("https://api.browser-use.com/api/v2/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Browser-Use-API-Key": apiKey,
      },
      body: JSON.stringify({
        task: TASK_PROMPT,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { ok: false, message: `Browser Use API error: ${errorText}` },
        { status: 500 },
      );
    }

    const data = await response.json();
    const sessionId = data.id ?? data.task_id ?? "";
    const liveUrl =
      data.liveUrl ??
      data.live_url ??
      data.publicShareUrl ??
      `https://cloud.browser-use.com/tasks/${sessionId}`;

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
