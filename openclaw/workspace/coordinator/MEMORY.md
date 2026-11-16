# MEMORY.md — durable facts and decisions

## Project: My Insurance — insurance subscription platform
<!-- project: path:C:\Users\<user>\.openclaw\workspace\coordinator -->

- Started 2026-11-13. Client: Ilies (`gateway-owner`), an insurance company.
- Goal: an online platform where customers subscribe to insurance (home first, car later).
- Organisation: Manager (coordination, single point of contact) + Dev agent (internal id `writer`, display name "Dev") + Tester agent (QA / security review). Everything goes through the Manager.

### Environments

**Production (`master`)** — verified live 2026-11-13 and 2026-11-15:
- Front: https://my-insurance-front.netlify.app/ → HTTP 200, title "My Insurance". Bundle asset `index-CZ3C-Grv.js`, API base `https://my-insurance-back.onrender.com/api/v1`.
- Back: https://my-insurance-back.onrender.com → 503 "Application loading" on first probe (Render free-tier cold start); later measured warm at 0.5 s.

**Preproduction (`develop`)** — verified live 2026-11-15:
- Front: Netlify "branch deployment" of the same project → https://develop--my-insurance-front.netlify.app/ → HTTP 200. Bundle asset `index-p2F8k_1u.js` after Lot 1, API base `https://my-insurance-back-preprod.onrender.com/api/v1`.
- Back: **separate Render project** (Render does not allow multiple environments per project) → https://my-insurance-back-preprod.onrender.com → HTTP 401 on `/` (service up, request unauthenticated; no 503).
- The preprod back runs on Render, not yet on the self-hosted Docker container.

### Testable surface without an account
Verified 2026-11-15 independently by the Manager and by Tester:
- `GET /api/v1/plans` → 200 (essential 12.00 / standard 22.00 / premium 35.00 EUR).
- `POST /api/v1/quotes/home` → 200; the pricing engine matches the reference formula exactly on three cases: standard/homeowner/2000/age 36 = **26.40**; essential/tenant/1940/age 21 = **14.98**; premium/homeowner/2020/age 76 = **35.91**.
- Public endpoints (no token): `/plans`, `/auth/register`, `/auth/login`, `/auth/logout`, `/quotes/home`. Everything else (`/me`, `/contracts`, `/dashboard`) requires a bearer.
- `GET /` and `/api/v1` → 401 in ~0.4 s when warm. `GET /api/v1/auth/login` → 405 with `allow: POST` (endpoint exists).
- CORS works for the preprod origin: `OPTIONS` preflight → 200, `access-control-allow-origin` echoes `https://develop--my-insurance-front.netlify.app`, `allow-methods: GET,POST,PATCH,OPTIONS` (PATCH added with Lot 1), `max-age 3600`.
- The front does **not** proxy `/api/v1` (Netlify returns its 404): the deployed bundle calls the Render API **directly** and sends `Authorization` read from `sessionStorage` under key `myinsurance-token`. Consequence: `CORS_ORIGINS` must contain exactly the preprod origin (it does).
- Auth (from source): opaque bearer (not JWT), TTL `PT12H`, password 5–15 with lowercase + uppercase + digit, IBAN validated MOD-97, duplicate email → 409.
- **Front stack reality: React 19 + Vite + Tailwind + an Express mock server (`server/`)** — **not Angular**, contrary to the original spec. Deviation still to be settled with Ilies.

### Tooling access (state 2026-11-14)
- **Netlify**: official MCP connector `https://mcp.netlify.com/mcp`, **OAuth** → authorised and operational. No secret on disk. Exposed surface is narrow: deploy, get-deploy, feedback, extension, user — **no environment-variable read/write**.
- **Render**: official MCP connector `https://mcp.render.com/mcp`, authenticated by **API key** read from the user environment variable `RENDER_API_KEY` (Render OAuth is impossible: `api.render.com` exposes no `registration_endpoint`, so no dynamic client registration). Connected, verified by a real `list_workspaces` call → a single workspace, "My Workspace" (team), id `<render-workspace-id>`, to be passed explicitly per call.
- **GitHub**: OpenClaw-managed identity (`tools.github`), fine-grained PAT stored in the secrets vault (never in chat or config), account `ilies-t`. Access verified to `ilies-t/my-insurance-front` and `ilies-t/my-insurance-back`.
  - ⚠️ The PAT is scoped to **All repositories** → 31 repositories writable (verified 2026-11-14). Least privilege still to fix.
  - Integration Git author kept as `dev@openclaw` (deliberately different from Ilies' own identity).
  - `gh` (GitHub CLI 2.104.0) is installed but **not on the Gateway process PATH** → call it by absolute path `C:\Program Files\GitHub CLI\gh.exe`, or through Git Bash. Ilies' decision (2026-11-14): stay on the absolute path until a Gateway restart.
  - Hygiene: `credential.helper = store` (plaintext credentials in `%USERPROFILE%\.git-credentials`, 6 entries, no GitHub token found).
- Config modified: `C:\Users\<user>\.openclaw\openclaw.json` (`mcp.servers` section only); backup `openclaw.json.pre-mcp-20261114`. No plaintext secret in the config or the backup.
- Known constraint: an environment variable is only read at Gateway process start → adding one requires a restart **from a context that already has it** (fresh logon or a new terminal).
- Security: the Render key transited through chat on 2026-11-14 → regeneration recommended to Ilies (his call).

### Repositories and Git workflow
- 2 separate repositories: front and back. `master` = production, `develop` = preproduction.
- `ilies-t/my-insurance-front` and `ilies-t/my-insurance-back`: **private**, default branch `master`, `develop` exists in both.
- Features/bugfixes → `develop`. Hotfix → `master` first, then merge `master` into `develop`.
- Every shell command runs through **Git Bash** (`C:\Program Files\Git\bin\bash.exe`) — never PowerShell or cmd. Ilies' standing instruction (2026-11-15): PowerShell quoting repeatedly broke commands; inline quoting inside `bash -lc` also breaks, so write a `.sh` file and run it.

### Functional specification (source: prompt supplied by Ilies)
- Front: complete front end + a mocked back end (Express suggested) + OpenAPI specs describing each endpoint. The real Spring Boot back end builds on those specs.
- Journeys:
  1. Welcome page (modern design, insurance sector).
  2. New-customer auth: first name, last name, valid email, password (5–15 chars, ≥1 digit, ≥1 lowercase, ≥1 uppercase), SEPA IBAN.
  3. Existing-customer auth: email + password.
  4. Home insurance subscription: US address (number, street, city, ZIP), building year, policyholder birth date, owner/tenant status, Essential/Standard/Premium plan. Congratulations message + summary, then a "My dashboard" link.
  5. Dashboard: total monthly amount, current contracts, subscribe to a new contract.
- Monthly price formula (EUR): base(plan) × coef(status) × coef(building year) × coef(age), rounded to 2 decimals.
  - status: tenant 0.8; owner 1.2
  - building year: <1950 → 1.3; <1990 → 1.1; <2010 → 1.0; otherwise 0.9
  - age: <25 → 1.2; >65 → 0.95; otherwise 1.0

### Technical constraints
- Back: Spring Boot, PostgreSQL, Liquibase migrations in **YAML**.
- Every table: `id` (generated UUID) + `created_at`. Avoid reserved names (e.g. `user_account` rather than `user`). Use relationships.
- Front: Angular *(per spec — actual implementation is React, see above)*.
- Tests: services only; 1 to 5 tests max per method; no over-testing.
- Code: senior level, separation of concerns, sparse comments, English naming.
- Deployment: `Dockerfile` for the Java app (self-hosted by Ilies in a container); front deployed by Ilies on Netlify (nothing to do); CORS through an environment variable on the back.

### Development workflow (current — decided by Ilies 2026-11-15 12:44)
1. Dev works on a **feature branch**.
2. At the end of development, Dev opens a **PR from that branch into `develop`**.
3. **Ilies reviews the code** of the PR.
4. When Ilies approves or leaves comments, he **tells the Manager** → the Manager asks Dev to handle it (fix, reply, update the PR).
5. Once the PR is **merged into `develop`**, Dev **verifies the deployment state** of front and back through the Netlify and Render MCPs.
- Neither Dev nor the Manager merges, approves, or marks a PR "ready": **all merges are done by Ilies**.
- Hotfix: `master` first, then merge `master` into `develop`.
- **Production promotion (`develop` → `master`)** — decided 2026-11-15 15:20: **Ilies** opens the promotion PR and merges it **directly onto `master`** (no extra review round on his side). Cadence: **batched** — Dev opens one PR per feature into `develop`, and Ilies merges `develop` → `master` when he judges there is enough to ship.
- **PRODUCTION GATE — decided by Ilies 2026-11-15 15:43: the `develop` → `master` PR is BLOCKED while Tester is not "green".** No production promotion without Tester's green report for the batch. The Manager is the gatekeeper: he relays and validates no promotion to `master` without a green Tester report, and states the block explicitly when Tester has not run or is not green. Tester only reports: it does not block the PR itself; the Manager refuses the promotion.
  - **Technical enforcement — verified 2026-11-15: IMPOSSIBLE today.** Both repos are **private on a GitHub Free plan**: the rulesets API answers "Upgrade to GitHub Pro or make this repository public". The fine-grained PAT also lacks the *Administration* permission (branch protection read/write → 403) and *Commit statuses* (cannot publish the verdict as a status). The gate therefore stays **procedural** (the Manager refuses the promotion). Options: (A) move to GitHub Pro (~$4/user/month) + widen the PAT to *Administration* and *Commit statuses*, then require the `tester/gate` context on `master` in both repos; (B) make the repos public (not advised); (C) stay procedural. **Ilies' choice on 2026-11-15 18:18: option (C), procedural gate.**
  - **PR comments — verified 2026-11-15**: read access OK on both repos (PR list, issue comments, review comments → 200, zero items). Write access unproven at that time (no PR existed yet); PR #1 later proved the workflow end to end. `tools.github` is **global** (profile `<github-pat>`, `gitAuthor dev@openclaw`) → Tester inherits `gh` exactly like Dev. Permission reminder: PR conversation comment = Issues API → *Issues: R/W*; inline review = *Pull requests: R/W*.
  - **"Green" = a Tester report to the Manager with no blocking finding.** Default definition (proposed by the Manager, confirmed by Ilies): **no critical or high security vulnerability**, **and 100% of the regression scenario steps pass**. Refined 2026-11-15: the scenario is validated **at UI level** (user journey), with API traces as per-step evidence — an API-only smoke test can never make the gate green (it may serve as an iteration pre-check).
- Previous workflow (obsolete, replaced): direct push to `develop` + a `develop` → `master` PR that accumulated features.

### Production gate status (2026-11-15)
- **First run: NOT GREEN** — first pass of Ilies' scenario on preprod. Steps: (1) login dialog opens → **PASS**; (2) account creation → **FAIL**; (3) login → **FAIL**.
- **Single root cause (independently verified by the Manager)**: the front deployed on `develop` called the back **without the `/api/v1` prefix**. Evidence: `POST /auth/register` → **401** while `POST /api/v1/auth/register` → **400** (endpoint present); bundle `index-Dh0B6sAr.js` contained `https://my-insurance-back-preprod.onrender.com` and **zero occurrences** of `/api/v1`. `src/api.ts` uses `baseUrl = import.meta.env.VITE_API_URL || "/api/v1"` → the Netlify variable on the `develop` deploy was the bare host.
- **Fix** (Ilies' manual action, no agent could do it): in Netlify, scope **branch deploy `develop`**, set `VITE_API_URL=https://my-insurance-back-preprod.onrender.com/api/v1`, then redeploy. He applied it to **preprod and prod**. The back was healthy throughout (`/plans`, `/quotes/home`, prices exact).
- **Tooling limitation**: the Netlify MCP exposed here cannot read or write environment variables (only deploy / get-deploy / feedback / extension / user), so the fix was necessarily manual.
- **Second run (2026-11-15 ~19:00): GREEN** — all 3 steps pass at **UI** level with API traces: register **201**, login **200**, `GET /api/v1/dashboard` **200**, logout **204**. No critical/high finding. `GET /api/v1/me` returns only id/createdAt/firstName/lastName/email/ibanLast4 (no password hash, no full IBAN).
- **Independent verification by the Manager**: preprod asset `index-CssWtxmT.js` then `index-p2F8k_1u.js`, base `…/api/v1`; **prod** asset `index-CZ3C-Grv.js`, base `https://my-insurance-back.onrender.com/api/v1`.
- ⚠️ **Render cold starts are a recurring, intermittent risk (measured 2026-11-15)**: on preprod, three consecutive preflights timed out at 45 s (0 bytes) before the service woke; once warm, `GET /api/v1/plans` answered **200 in 7.0 s**. On prod the same check came back warm in 0.5 s, though an earlier probe had returned 000. A real customer's first request can hang 30–60 s. To be addressed before public launch (wake ping, paid plan, or keep-alive).
- Remaining non-blocking observation: bearer token in `sessionStorage` (XSS-readable). The former CORS `allow-methods` observation is **resolved**: post-deploy preflight returns `GET,POST,PATCH,OPTIONS`.

### Tester agent — role (decided 2026-11-15 15:36)
- Agent `tester` (display name "Tester"), workspace `C:\Users\<user>\.openclaw\workspace\tester`. Independent from Dev: Dev cannot invoke it (Manager allowlist = `["writer","tester"]`; Dev allowlist = Dev only).
- **Trigger: after the PR is merged into `develop`** (never before), against the **preprod** environment (branch `develop`): front https://develop--my-insurance-front.netlify.app/ , back https://my-insurance-back-preprod.onrender.com.
- Ilies' rationale: the test scenario needs the preprod environment, so it can only run once `develop` is deployed.
- Scope: security code review (auth, injection, secret exposure, CORS, dependencies, sensitive data) + a precise, repeatable regression scenario.
- **Ilies defines the scenario** with Tester in its session (journeys/steps, test accounts and permitted data, expected result per step). Tester never invents or hardcodes a test plan.
- Guardrails: reports findings only, never merges/approves/pushes, no secrets, test/read-only access, no production, reproducible evidence + stated uncertainty.
- **Production gate role (decided 2026-11-15 15:43)**: Tester's report conditions the `develop` → `master` promotion. "Green" = no critical/high finding + 100% of scenario steps pass. Tester does not block the PR itself: it renders its verdict to the Manager, who refuses the promotion while Tester is not green.
- **Tester access (verified 2026-11-15)**: drives the real preprod front through OpenClaw's managed Chromium (CDP 127.0.0.1:18800), no secrets vault needed (URLs are public). Validated preference: **full UI test** + API traces per step.
- **Early Tester observations (tracked, non-blocking)**: (1) bearer token in `sessionStorage` → XSS-exposed; (2) CORS `allow-methods` limited to `GET,POST` → will silently break any future PUT/DELETE endpoint (CORS item now resolved for PATCH; PUT/DELETE still absent by design).
- **Ilies' scenario received 2026-11-15 18:47** (3 steps) and executed by Tester: (1) open "Log in"; (2) create an account (fresh email, valid password, IBAN `FR7630004015870002601171220`); (3) sign in again with the same credentials. **Disposable-signup authorization + test IBAN: granted.**
- **Direct Ilies ↔ Tester channel**: Tester reported the GREEN verdict to Ilies in its own session, with screenshots. That direction works; **Manager → Ilies has no outbound channel** on this Gateway (no chat channel configured; `message` rejects `webchat`; `conversations_list` is empty). Anything the Manager must tell Ilies is delivered on Ilies' next message.
- Ilies-visible session title: "Tester role for My Insurance security and regression QA".

### Gate scenario v2 — "Profile" feature (defined by Ilies 2026-11-15, Manager decisions)
Runs after the merge into `develop`, on preprod, UI-driven with API traces per step.
1. Sign in (existing account, or a disposable one: unique email + IBAN `FR7630004015870002601171220`).
2. Open the "Profile" page.
3. Non-editable fields (first name **and** last name) are read-only and show a tooltip. Tolerant assertion: case-insensitive, trailing punctuation not required. Ilies' requirement was written in English; the shipped constant is `This field can’t be changed here. Please contact your insurance advisor.` (typographic apostrophe U+2019, normalise to `'`). Meaningful wording drift = step failure.
4. Update email + password + IBAN **with the current password** (`currentPassword`, a Manager security requirement). If the UI lacks that field → **blocking** finding.
5. Log out, then sign in with the NEW credentials → must work.
6. Sign in with the OLD credentials (old email + old password) → must FAIL (401). Added sub-check: new email + old password → 401 as well (no credential mixing).
- **Out of scenario, non-blocking observation**: if a bearer obtained BEFORE the password change still works after it, that is a **high-severity** finding to document with the exact request — but it does not fail the gate (outside the feature's scope). Decision to raise with Ilies.
- GREEN only if all 6 steps pass.

### Lot 1 — "Profile" feature (2026-11-15)
- Branch `feature/profile-update`, **PRs merged by Ilies 2026-11-15 18:44 UTC**: back https://github.com/ilies-t/my-insurance-back/pull/1 (11 files), front https://github.com/ilies-t/my-insurance-front/pull/1 (12 files). Merge verified via `gh` (state=MERGED).
- Back: `PATCH /api/v1/me` (bearer), `ProfileUpdateRequest/Service/Validator`, `currentPassword` required for email or password changes (400 if missing, 403 if wrong), unique email → 409, IBAN MOD-97, **other sessions revoked** on password change. No Liquibase migration needed.
- **`CorsConfig`: `PATCH` added to the allowlist** — verified AFTER the merge on preprod: `OPTIONS /api/v1/me` with `Access-Control-Request-Method: PATCH` → **200**, `access-control-allow-methods: GET,POST,PATCH,OPTIONS`. The browser-level block is lifted. (Pre-merge baseline measured by Tester: PATCH → 403 with no CORS headers; POST → 200 with `GET,POST,OPTIONS`.)
- **Post-merge deployment (verified 2026-11-15 ~19:47)**: front asset `index-CssWtxmT.js` → **`index-p2F8k_1u.js`**, base `…/api/v1`; back `GET /api/v1/plans` → **200** (3.6 s), `PATCH /api/v1/me` without a token → **401** (endpoint live and protected).
- **Deployed SHAs verified via MCP (Dev) and cross-checked by the Manager (`gh`)**: `develop` heads = back `136cc0c8…`, front `6e61a944…` — identical to the deployed commits (Netlify deploy `<netlify-deploy-id>` status `ready`, branch-deploy context; Render `<render-deploy-id>` status `live`, finished 18:47Z). Earlier Render deploys are `deactivated`. These are the merge commits, not an older build.
- Front: `profile` page (no router in this project — state-based navigation), `src/ProfilePage.tsx`, tooltips on first/last name (read-only), IBAN shown masked (`•••• 3000`).
- Dev-announced tests: back `mvn test` 24/24, front `npm test` 22/22, typecheck + build clean. Dev could not exercise the endpoint against a real local Postgres (local credentials refused) nor do a visual check (localhost navigation blocked) — both gaps were covered by Tester on preprod after the merge.
- **Lot 1 gate verdict: GREEN (2026-11-15 ~19:55)** — scenario v2: **6/6 steps PASS** plus sub-check 6b (new email + old password → 401). `currentPassword` present in the UI (blocking security control satisfied). **Session revocation verified for real**: Tester opened a second session (token T2) BEFORE the change, changed the password from the browser, then re-tested T2 → **401**; old password → 401, new password → 200. No critical/high finding. Only remaining observation: bearer token in `sessionStorage`.
- **Lot 1 cleared for promotion `develop` → `master`** (opening and merging remain Ilies' actions).

### Open questions (to settle with Ilies)
- Front stack: spec says **Angular**, the live product is **React 19 + Vite**. Either the spec or the implementation must be corrected so nobody "fixes" it later.
- **Reset/seed policy for preprod**: QA creates disposable accounts that accumulate. A wipe/reset rule is still undefined.
- Inconsistency: **US address** but **EUR currency** (IBAN/SEPA is European).
- PAT scoped to "All repositories" (31 repos writable) — raised with Ilies, residual risk noted.
- Back currently on Render vs the target self-hosted Docker container → status and migration plan.
- Multi-product extensibility (home today, car later).

### Identified risks
- Sensitive data (IBAN/SEPA, personal data) → GDPR, encryption, log masking.
- The price must be computed server-side (authoritative), never only client-side.
- Production had no preprod for a while (accepted 2026-11-15, then **lifted**: preprod now exists).
- Render free-tier cold starts (30–60 s first request) — bad for a subscription funnel.