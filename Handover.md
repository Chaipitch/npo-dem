# Handover — ABC Hope · Christmas Giving 2026

_Last updated: 2026‑10‑22_

## TL;DR

The public donation journey, the signed-in donor portal and the Agentforce agent are built, deployed
and published on the ABC Hope LWR site. Donations create real NPC records (payment simulated).
Donors can pick any open campaign from the dashboard. **One manual step remains:** place the
Embedded Messaging component in Experience Builder so the chat appears on the site.

**Site:** https://te1791557923677.my.site.com/ —
`/` campaign home · `/donate` (`?campaign=…`, `?src=…`) · `/dashboard` · `/my-giving` · `/my-profile`

## Status

| Area                                  | State                                                                                                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo data                             | ✅ 4 fundraising campaigns (Christmas Giving 2026, Clean Water for Rural Schools, Girls' Education Scholarships, Green Communities Tree Planting) with goals and default designations; 6 designations; source code `XMAS26-EMAIL`; Maya's 2023–2025 gift history |
| Apex                                  | ✅ 33 test methods pass. Coverage: DonationIntakeService 98%, DonationIntakeController 84%, DonorPortalController 96%, agent actions 70–100%                                                                                                                     |
| LWC                                   | ✅ donationJourney (11 Jest tests), abcHopeHero, donorDashboard, donorProfile, abcHopeIcon, public + portal theme layouts                                                                                                                                        |
| Site                                  | ✅ Live. Home + Donate are public; portal pages require login (guests go to login, then back to `/dashboard`)                                                                                                                                                    |
| Dashboard campaigns                   | ✅ Card grid: raised (real gifts) vs goal (`Campaign.ExpectedRevenue`), days left, designations. A card opens `/donate?campaign=<name>`                                                                                                                          |
| Signed-in donor                       | ✅ Maya Grande portal user. Email set to `wchaipitch@terrasky.co.th` and a password-reset email sent; the user chooses the password (none stored anywhere)                                                                                                       |
| Agent                                 | ✅ ABC Hope Donor Assistant active (new version with D-20: lists every open campaign); routing flow `ABC_Hope_Chat_Routing`; channel + deployment `ABC_Hope_Chat` (Auth, guests allowed)                                                                         |
| Chat on site                          | 🟨 Embedded Messaging component not yet placed (manual — see below)                                                                                                                                                                                              |
| Photos                                | ✅ Unsplash: hero (Christian Bowen), dashboard banner (Ben Kupke), sidebar (Artem Makarov); credits shown                                                                                                                                                        |
| Git                                   | ✅ `git@github.com:Chaipitch/npo-dem.git`, `main`                                                                                                                                                                                                                |
| Flows / VRs / custom objects / fields | Only `ABC_Hope_Chat_Routing` (approved exception). Nothing else.                                                                                                                                                                                                 |

## How to sign in as Maya

- **With password:** use the reset email sent to `wchaipitch@terrasky.co.th` to set one, then
  https://te1791557923677.my.site.com/ → **Sign in** → username `maya.grande@abchope.demo.00dg700000kmyyx`.
- **Without password:** Setup → Contacts → Maya Grande → **Log in to Experience as User** → ABC Hope.

## Manual step: chat widget

1. Experience Builder → ABC Hope → open a page that uses the _ABC Hope Public_ layout.
2. Components → **Embedded Messaging** → drag into the theme **Footer**; deployment **ABC Hope Chat**;
   enable **Experience Cloud site authentication** (so signed-in donors are verified).
3. Repeat on a page that uses the _ABC Hope Portal_ layout. **Publish.**
4. `sf project retrieve start -o npo-demo -m "DigitalExperienceBundle:site/ABC_Hope1"`, commit, then run
   the agent checks in `testing-steps.md` §7.

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

## Open items

1. Place the Embedded Messaging component (above), then test signed-in agent conversations end to end.
2. Images for the three non-Christmas campaign cards and the story cards (currently SVG illustrations;
   set the `campaignImages` and story properties).
3. Header nav "Our Work" and "About" point to `/` until those pages exist.
4. Optional: raise `AbcHopeAgentSupport` coverage (the real MessagingSession path can't be built in tests).
