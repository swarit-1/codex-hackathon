import { NextResponse } from "next/server";

const SCHOLAR_SEARCH_URL =
  "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search";

const TASK_PROMPT = `You are a browser automation agent helping a UT Austin student apply to a scholarship.

GOAL: Navigate to the scholarship search page, find the "CREEES McWilliams Scholarship",
click its "Apply Now" button, and then fill out the entire scholarship application
form across all pages — but DO NOT submit at the end.

Step-by-step instructions:

1. Navigate to ${SCHOLAR_SEARCH_URL}. Wait for the page to fully load.

2. Look through the list of scholarships on the page for "CREEES McWilliams Scholarship".
   You may need to scroll down or paginate through results to find it.
   Once you find it, click the "Apply Now" button next to it.

3. If you are redirected to a UT EID login page (login.utexas.edu or similar):
   - Enter the UT EID: ap64646
   - Enter the password: Applea14x135
   - Click the login/sign-in button.
   - Handle any Duo or MFA prompts if they appear (e.g. click "Send Me a Push"
     or approve via the Duo app — wait for it to complete).
   - After login, you should be redirected back to the scholarship application.

4. Once on the scholarship application form, fill out ALL available fields on
   each page. Use reasonable values for a UT Austin undergraduate Computer Science student.
   For text fields that ask for essays or explanations, write 2-3 thoughtful sentences.

5. After completing all fields on a page, click "Next", "Continue", or the next
   step/page button to proceed.

6. Continue filling out ALL pages of the application.

7. On the FINAL page/step, STOP. Do NOT click "Submit", "Finish", or any button
   that would finalize/submit the application.

8. Report back what fields you found on each page and what values you entered.

CRITICAL RULES:
- DO NOT click any Submit or Finish button that would finalize the application.
- Fill out EVERY field on EVERY page before moving to the next page.
- If a dropdown does not have an exact match, pick the closest available option.
- For file upload fields, upload a small dummy text file if possible, otherwise skip.
- Take your time and be thorough — fill ALL fields before proceeding.`;

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

    // Create a session with the task — don't await completion (it takes minutes)
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
      message: "ScholarBot demo launched in Browser Use Cloud.",
      sessionId,
      liveUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
