import { NextResponse } from "next/server";

const SCHOLAR_SEARCH_URL =
  "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search";

const TASK_PROMPT = `You are a browser automation agent helping a UT Austin student review a scholarship application flow.

GOAL: Navigate to the scholarship search page, find the "CREEES McWilliams Scholarship",
click its "Apply Now" button, and review the application flow as far as authorized access allows.
Do NOT submit any final application.

Step-by-step instructions:

1. Navigate to ${SCHOLAR_SEARCH_URL}. Wait for the page to fully load.

2. Look through the list of scholarships on the page for "CREEES McWilliams Scholarship".
   You may need to scroll down or paginate through results to find it.
   Once you find it, click the "Apply Now" button next to it.

3. If you are redirected to a UT EID login page (login.utexas.edu or similar):
   - Enter the UT EID: rv25852
   - Enter the password: Tac0bellisgood$

   - Click the login/sign-in button.
   - Handle any Duo or MFA prompts if they appear (e.g. click "Send Me a Push"
     or approve via the Duo app — wait for it to complete).
   - After login, you should be redirected back to the scholarship application.

4. If you reach the scholarship application form, fill out the visible fields with
   reasonable placeholder values for a UT Austin undergraduate Computer Science student.
   For text fields that ask for essays or explanations, write 2-3 thoughtful sentences.

5. After completing all visible fields on a page, click "Next", "Continue", or the next
   step/page button to proceed.

6. Continue until you either reach the final review/submit page or hit an authentication wall.

7. On the FINAL page/step, STOP. Do NOT click "Submit", "Finish", or any button
   that would finalize or submit the application.

8. Report back:
   - what pages or steps you reached,
   - what fields you found,
   - what values you entered,
   - and whether authentication was required.

CRITICAL RULES:
- DO NOT click any Submit or Finish button that would finalize the application.
- DO NOT guess or invent login credentials.
- If a dropdown does not have an exact match, pick the closest available option.
- If a file upload field appears, skip the upload and report it instead.
- Take your time and be thorough, but stop immediately at any unauthorized boundary.`;

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
        sessionSettings: {
          profileId: "bcf273d4-abc4-40c4-b506-8ad330d4c678",
          proxyCountryCode: "us",
        },
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
      message: "ScholarBot demo launched in Browser Use Cloud.",
      sessionId,
      liveUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
