# Handover — ABC Hope · Christmas Giving 2026

_Last updated: 2026‑10‑22_

## TL;DR

The public donation journey, the signed-in donor portal and the Agentforce agent are built, deployed
and published on the ABC Hope LWR site. Donations create real NPC records (payment simulated).
Donors can pick any open campaign from the dashboard. Chat lives in one place: the dashboard's Ask panel, on the
Agent API with the donor's verified identity (D-23, D-25).

**Site:** https://te1791557923677.my.site.com/ —
`/` campaign home · `/donate` (`?campaign=…`, `?src=…`) · `/dashboard` · `/my-giving` · `/my-profile`

## Status

| Area                                  | State                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo data                             | ✅ 4 fundraising campaigns (Christmas Giving 2026, Clean Water for Rural Schools, Girls' Education Scholarships, Green Communities Tree Planting) with goals and default designations; 6 designations; source code `XMAS26-EMAIL`; Maya's 2023–2025 gift history                                                                                              |
| Apex                                  | ✅ 45 test methods pass. Coverage: DonationIntakeService 98%, DonationIntakeController 84%, DonorPortalController 96%, MonthlyGiftService 89%, agent actions 64–100%                                                                                                                                                                                          |
| LWC                                   | ✅ donationJourney (14 Jest tests), donorMonthlyGifts (9 Jest tests), abcHopeHero, donorDashboard, donorProfile, abcHopeIcon, public + portal theme layouts                                                                                                                                                                                                   |
| Site                                  | ✅ Live. Home + Donate are public; portal pages require login (guests go to login, then back to `/dashboard`)                                                                                                                                                                                                                                                 |
| Dashboard campaigns                   | ✅ Card grid: raised (real gifts) vs goal (`Campaign.ExpectedRevenue`), days left, designations. A card opens `/donate?campaign=<name>`                                                                                                                                                                                                                       |
| Signed-in donor                       | ✅ Maya Grande portal user. Email set to `wchaipitch@terrasky.co.th` and a password-reset email sent; the user chooses the password (none stored anywhere)                                                                                                                                                                                                    |
| Agent                                 | ✅ ABC Hope Donor Assistant active (new version with D-20: lists every open campaign); routing flow `ABC_Hope_Chat_Routing`; channel + deployment `ABC_Hope_Chat` (Auth, guests allowed)                                                                                                                                                                      |
| Chat on site                          | ✅ Dashboard Ask panel only (D-25); Embedded Messaging stays deployed but unused                                                                                                                                                                                                                                                                              |
| Photos                                | ✅ Unsplash (free licence): hero (Christian Bowen), banner (Ben Kupke), sidebar (Artem Makarov); campaign cards — water (Lisa Marie Theck), education (Yogendra Singh), environment (Kate Cullen), other (Larm Rmah); stories (Andrew Itaga, Yannis H, Elly M); the donation journey's review/thank-you photo follows the campaign. Credits shown or on hover |
| Git                                   | ✅ `git@github.com:Chaipitch/npo-dem.git`, `main`                                                                                                                                                                                                                                                                                                             |
| Flows / VRs / custom objects / fields | Only `ABC_Hope_Chat_Routing` (approved exception). Nothing else.                                                                                                                                                                                                                                                                                              |

## How to sign in as Maya

- **With password:** use the reset email sent to `wchaipitch@terrasky.co.th` to set one, then
  https://te1791557923677.my.site.com/ → **Sign in** → username `maya.grande@abchope.demo.00dg700000kmyyx`.
- **Without password:** Setup → Contacts → Maya Grande → **Log in to Experience as User** → ABC Hope.

## Chat widget — not used (D-25)

The Embedded Messaging channel, deployment and routing flow stay deployed but are not placed on the site: the
dashboard's Ask panel is the only chat. To add the widget later: Experience Builder → Embedded Messaging component →
deployment **ABC Hope Chat**, Experience Cloud site authentication on, publish.

## Gotchas

- Publish after every deploy of site LWCs: `sf community publish -n "ABC Hope" -o npo-demo`.
- Re-run `scripts/sitePages.py` rather than hand-editing route/view JSON.
- Synthetic shadow leaks theme `a:link` styles (D-11); SVG `url(#id)` breaks (D-14).
- Paid gifts get an automatic designation (D-13). NPC standard actions want String Ids.
- The dashboard also lists the org's pre-existing _Non Profit Event_ and _Capital Campaign_ because they
  are active and have default designations (D-18). Deactivate them to hide them.
- The org is USD-only; the UI labels amounts THB (D-05).

## Target object schema (user, 2026‑10‑22) — in progress

User's diagram: Account – Contact; Account ─< Campaign; Campaign ─< Program; Campaign ─< Gift Commitment
Schedule (recurring) and ─< Gift Transaction (one-time); Schedule ─< Gift Transaction.
**Program = what a campaign spends the donated money on.**

How the build compares:

- ✅ Person Accounts (1 Account : 1 Contact); `CampaignId` on GiftCommitmentSchedule (monthly) and
  GiftTransaction (one-time); schedules generate the monthly transactions.
- Diagram omits **GiftCommitment**: the real chain is Account ─< GiftCommitment (DonorId, CampaignId) ─<
  GiftCommitmentSchedule ─< GiftTransaction. One-time gifts link to the donor directly (`GiftTransaction.DonorId`).
- No direct Account → Campaign field; the link is derived from gifts (no CampaignMembers are created).
- **Campaign → Program is not built.** Plan: designations are NPC's "what the money is for"
  (Campaign ─< GiftDefaultDesignation >─ GiftDesignation; gifts ─< GiftTransactionDesignation). Next step:
  `sf sobject describe` GiftDesignation, Program and Campaign and look for a standard lookup to Program.
  If one exists, use it. If not: (A) recommended, no schema change — one GiftDesignation per Program, same
  name; (B) a custom lookup GiftDesignation → Program, which needs the user's approval (guardrail).
  Avoid a Campaign lookup on Program (a program could then belong to only one campaign).
  Don't create Program records or seed data without asking.
- Data gap: Maya's seeded 2023–2025 gifts (`seedMayaHistory.apex`) have no `CampaignId`.

## Campaign → Program and monthly gift self-service (2026‑10‑22)

- **Programs (D-21):** Campaign ─< GiftDefaultDesignation >─ GiftDesignation ─> Program via the existing
  `NGOTV_Program__c` lookup. Seed: `sf apex run -o npo-demo -f scripts/apex/seedPrograms.apex`.
- **My Giving → Monthly Gifts (D-22):** pause / resume / change amount / cancel for the signed-in donor;
  the dashboard shows paused gifts separately. Test: `testing-steps.md` §8.
- **Site outage fixed:** on 2026‑10‑21 ~16:00 UTC the templates of `abcHopePublicLayout`, `abcHopePortalLayout` and
  `abcHopeHero` were commented out directly in the org (not in git). The next publish blanked the site; the repo
  versions were redeployed and republished on 2026‑10‑22. Before publishing, check the org still matches git.

## Dashboard agent panel (D-23) — live with the Agent API (2026‑10‑26)

The panel sends every question to the **ABC Hope Donor Assistant** through the Agent API (`DonorAgentController`,
`USE_AGENT_API = true`), with `verified_account_id` = the signed-in donor's account, so the agent answers personal
questions from her own data ("You have 1 recurring gift: Recurring (Monthly): THB 1,000 per month…"). Page links the
dashboard answer would offer (e.g. Manage recurring gifts) stay under the reply. If the agent call fails, the panel
falls back to the dashboard-data answer.

Setup that makes it work: External Client App **ABC Hope Agent API** (client credentials, run-as
`agentapi.abchope@…`), its consumer key/secret on the `AgentApiPrincipal` principal (admin-entered, never in git),
permission set **ABC Hope Agent API Access** assigned to the run-as user and selected under the app's OAuth policies
(Permitted Users: admin approved), agent version 6 active (2026‑10‑26: causes vs programs wording). Portal users reach the principal through
`ABC_Hope_Donor_Portal`.

Troubleshooting: `invalid_app_access … not admin approved` = the run-as user's permission set isn't selected on the
app; a rotated secret must be re-pasted on the principal.

## Campaign detail page (2026‑10‑22)

Dashboard campaign cards have **Donate now** (`/donate?campaign=…`) and **View more** (`/campaign?name=…`). The new
portal page `Campaign` (sign-in required, Portal layout, `c:campaignDetail`) shows the photo, description, raised vs
goal, gifts, time left, dates, the programs the campaign funds and the causes donors can choose, with Donate now.
Data: `DonationIntakeController.getCampaignDetail` — open fundraising campaigns only (D-18), else "Campaign not found".
Photos come from the shared `abcHopeCampaignPhotos` module. Route added in `scripts/sitePages.py`.

## Recurring gifts and journey banner (2026‑10‑22, D-24)

Step 1 of `/donate` offers **One-time | Recurring**; Recurring adds **Weekly · Monthly · Yearly** (Monthly
preselected). The period is stored on the gift's schedule (`TransactionPeriod`), and My Giving shows it after the
amount ("THB 300 / week") under a "Recurring (Weekly)" label; the dashboard says "N active recurring gifts (types)"
and the section is "Recurring Gifts". Steps 1–2 show the campaign photo as a banner across the top of the card.

## Open items

1. Done 2026‑10‑26: chat stays in the dashboard Ask panel only; no site-wide chat widget (D-25).
2. Done 2026‑10‑22: campaign cards, story cards and the journey's review/thank-you image use Unsplash photos.
3. Header nav "Our Work" and "About" point to `/` until those pages exist.
4. Optional: raise `AbcHopeAgentSupport` coverage (the real MessagingSession path can't be built in tests).
