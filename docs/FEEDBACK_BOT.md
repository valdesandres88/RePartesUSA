# Automated feedback improvement bot

Status: prepared; inactive until the owner configures the API secret and enables it. No AI execution or spending is enabled by default.

## Activate

1. Create a funded OpenAI API project and a project API key. API usage is billed separately from ChatGPT subscriptions. Set usage alerts/limits in that project.
2. In this GitHub repository, open Settings → Secrets and variables → Actions. Save a **secret** named `OPENAI_API_KEY`. Never paste the key into code, a public issue, or chat.
3. In Actions settings, allow GitHub Actions to create pull requests.
4. Add the repository Actions **variable** `FEEDBACK_BOT_ENABLED` with value `true`.
5. Open Actions → Customer feedback improvement bot → Run workflow. Inspect the first run before leaving it enabled.

The workflow runs daily at 14:17 UTC (9:17 AM Eastern standard time / 10:17 AM Eastern daylight time). Disable it by setting the variable to `false` or disabling the workflow.

## Actual behavior and limits

- Reads the live site's public, approved website reviews and public reviews of parts in the current public catalog. It does not read unpublished reviews, private orders, external Amazon reviews, or social media. The existing API returns the latest 100 reviews per scope and at most 100 live listings.
- Processes one previously unhandled review rated 1–3 stars per run; pauses while a feedback-bot pull request is open. Previously opened pull requests prevent duplicate handling, including closed requests. A failed run without a pull request can retry on the next schedule.
- Uses the official OpenAI Codex GitHub Action to inspect real source code. It may propose a small frontend change with checks or report that owner action is needed. It cannot repair physical products, issue refunds, or guarantee that every complaint can be fixed in code.
- Creates a draft pull request containing the investigation report and any proposed fix after `npm run check` succeeds. It does not auto-merge, deploy, delete negative reviews, send messages to customers, or claim an issue is resolved.
- No Supabase service key is required. Published comments are sent to OpenAI for analysis; email addresses and number-like contact strings are removed first. The report must not quote customer text or include customer identifiers. Review it before merging.
- Allowed file checks restrict proposed changes to frontend JavaScript/CSS and tests, plus a generated report. The owner must review security and business behavior even when tests pass.
- The bot uses API credits only when there is new feedback to investigate. Daily scheduling and one-at-a-time handling bound frequency, not the exact dollar cost. GitHub Actions availability and billing depend on the repository's plan.

## Owner workflow

Review the draft PR's evidence and validation. Approve/merge a sound software fix to let the normal Netlify deployment run. Handle complaints about shipping, damaged parts or seller conduct through support. Close irrelevant or unsafe proposals with an explanation. A closed review is not treated as proof of customer resolution.
