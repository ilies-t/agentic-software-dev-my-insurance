# MEMORY.md

Durable facts and decisions for this agent. Not for secrets.

## My Insurance — platform access (host `<host-name>`)

- Netlify: official MCP connector `https://mcp.netlify.com/mcp`, authenticated via OAuth (account authorised 2026-11-14). <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- Render: official MCP connector `https://mcp.render.com/mcp`, authenticated with an API key read from the user environment variable `RENDER_API_KEY` (never in plaintext in the config). <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- Render: OAuth is impossible with OpenClaw — the `api.render.com` authorisation server exposes no `registration_endpoint` (no dynamic client registration). <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- Render: a single workspace, "My Workspace", id `<render-workspace-id>` (pass it explicitly in calls). <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- GitHub: OpenClaw-managed identity (`tools.github`, fine-grained PAT, account `ilies-t`); the commit author is deliberately `dev@openclaw`, different from the human, on Ilies' decision. <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- GitHub CLI is installed (2.104.0) but **not on the Gateway process PATH**: call it by absolute path `C:\Program Files\GitHub CLI\gh.exe` (2026-11-14 decision: stay on the absolute path until the Gateway is restarted). <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- Target repositories: `ilies-t/my-insurance-front` and `ilies-t/my-insurance-back` (private, default branch `master`, `develop` at the same commit initially). `master` = production, `develop` = preproduction. <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- Shell rule: run every command through **Git Bash** (`C:\Program Files\Git\bin\bash.exe`), never PowerShell or cmd. Inline quoting inside `bash -lc` breaks easily — write a `.sh` file and run it. <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- OpenClaw config modified: `C:\Users\<user>\.openclaw\openclaw.json` (backup: `openclaw.json.pre-mcp-20261114`). <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->

## Deployment check (after a merge into `develop`)

- Verify deployment state in both environments through the MCPs, not by assumption: Netlify `get-deploy` for the `develop` branch deploy, Render `list_deploys` for the `my-insurance-back-preprod` service.
- Compare the **deployed commit SHA** with the `develop` head of each repository (`gh api repos/<owner>/<repo>/commits/develop`). A green HTTP status does not prove which build is live; only the deploy metadata does. <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->
- Preprod URLs: front `https://develop--my-insurance-front.netlify.app/`, back `https://my-insurance-back-preprod.onrender.com` (API base `…/api/v1`). <!-- project: path:C:\Users\<user>\.openclaw\workspace\writer -->