# Ride Along Dashboard — Vercel deployment

Standalone version of the Cowork ride-along dashboard. Same dashboard, same live monday.com
data, same AI insights — but running as a normal website instead of inside Cowork, so it
needs its own credentials.

## What's here

- `index.html` — the dashboard. Identical to the Cowork artifact, except it talks to this
  project's own `/api/monday` and `/api/ai` routes instead of Cowork's built-in bridge.
- `api/monday.js` — serverless function that proxies GraphQL queries to monday.com using a
  server-side API token. The browser never sees this token.
- `api/ai.js` — serverless function that proxies AI insight/synopsis requests to Anthropic's
  API using a server-side API key. The browser never sees this key.

## One-time setup

1. **Get a monday.com API token**
   In monday.com: avatar (bottom-left) → Administration → API, or your profile → Developers →
   "My access tokens" → generate one. It needs read access to the "Ride Along" board
   (`18391482563`) and the linked Employee Directory board.

2. **Get an Anthropic API key**
   From the [Claude Console](https://console.anthropic.com/) → API Keys. This is a paid,
   metered key — every AI insight and AI synopsis click is a small API call billed to this key.

3. **Deploy to Vercel**
   - Push this folder to a GitHub repo (or run `vercel` from inside it with the Vercel CLI).
   - Import the repo in Vercel, or run `vercel --prod` from this directory.

4. **Set environment variables** in Vercel → Project Settings → Environment Variables:

   | Name | Value | Required |
   |---|---|---|
   | `MONDAY_API_TOKEN` | your monday.com API token | Yes |
   | `ANTHROPIC_API_KEY` | your Anthropic API key | Yes (for AI insight/synopsis to work) |
   | `ANTHROPIC_MODEL` | e.g. `claude-haiku-4-5-20251001` | No — defaults to Haiku for speed/cost |

   Redeploy after adding env vars (Vercel doesn't pick them up on already-built deployments).

That's it — no build step, no database. Every page load fetches live data straight from
monday.com through `/api/monday`, and every AI insight/synopsis is generated on demand
through `/api/ai`.

## Access control

This deployment has **no login or password** — anyone with the URL can view live ride-along
data for every branch, manager, and technician. If that's not acceptable, add protection
before sharing the URL widely:

- Vercel's built-in **Deployment Protection** (Project Settings → Deployment Protection) can
  require a Vercel login or a shared password without any code changes.
- Alternatively, restrict the URL to your internal network (VPN) or put it behind your own
  SSO proxy.

## Cost notes

- monday.com API calls: free within monday's standard API rate limits.
- Anthropic API calls: each AI insight blurb and AI synopsis (per-item or aggregate) is a
  separate metered call. With Haiku as the default model this is cheap, but a branch with many
  managers regularly opening per-tech breakdowns will generate steady usage — keep an eye on
  the [Anthropic Console usage page](https://console.anthropic.com/settings/usage).

## Changing the board

The board ID and every column mapping live at the top of `index.html`'s `<script>` block
(`BOARD_ID`, `COLUMN_MAP`). If you duplicate the monday board or add/rename columns, update
those constants to match.
