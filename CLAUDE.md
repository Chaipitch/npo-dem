# CLAUDE.md — npo-demo (ABC Hope · Christmas Giving 2026)

Context for Claude Code (and humans) working in this repo. Read this first, then
`Handover.md` for current status, `decisions.md` for why things are the way they are,
and `testing-steps.md` before demoing.

## What this project is

A Salesforce **Nonprofit Cloud (NPC)** demo on the **ABC Hope** Experience Cloud **LWR** site:

- **Public:** campaign home (`/`) and a 4-step donation journey (`/donate`) for any open campaign.
- **Signed-in donor portal:** dashboard with campaign cards, KPIs, impact and journey (`/dashboard`),
  giving history (`/my-giving`), profile (`/my-profile`).
- **Agentforce:** _ABC Hope Donor Assistant_ answers campaign questions for anyone and helps
  signed-in donors with their giving, monthly gifts and contact details.

Payment is **simulated** everywhere — no money is collected.

Source designs (UI concept images from the user, 2026‑10‑21): donor portal home (mockup #1),
re-engagement journey for Maya Grande (#2), guest donation journey (#3), 10-item task sheet (#4).

## Org & site

| Item                 | Value                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| CLI alias            | `npo-demo` (default org in `.sf/config.json`)                                                                       |
| Org Id / instance    | `00Dg700000KmYYXEA3` · `https://te1791557923677.my.salesforce.com`                                                  |
| API version          | 68.0 (project); classes and LWC at 65.0                                                                             |
| Person Accounts      | Enabled (`NGO_Fundraising_Supporter` record type for new donors)                                                    |
| Time zone            | Org default **Asia/Bangkok** (D-42); NPC judges "today" in the acting user's zone                                   |
| Currency             | USD only; the UI labels amounts **USD** ("USD 1,000"; D-05, changed from THB on 2026‑10‑26)                         |
| Site URL             | **https://te1791557923677.my.site.com/** (LWR at the domain root; `/vforcesite` is only the Visualforce/login side) |
| Site metadata        | Network `ABC Hope`, LWR bundle `site/ABC_Hope1`, CustomSite `ABC_Hope`                                              |
| Guest user / profile | `ABC Hope Site Guest User` / `ABC Hope Profile` (Apex access: `TSAbcHopeDonationIntakeController` only)             |
| Demo donor           | Maya Grande — Person Account `001g70000175AtRAAU`, portal user `maya.grande@abchope.demo.00dg700000kmyyx`           |
| Agent                | `ABC_Hope_Donor_Assistant` (Agentforce Service Agent), runs as the `ServiceAgent Agentforce` user                   |
| Git remote           | `git@github.com:Chaipitch/npo-dem.git` (`main`)                                                                     |

## Hard guardrails (from the user)

- **No Flows, Validation Rules, Custom Objects or Custom Fields** — except the one approved routing
  flow `ABC_Hope_Chat_Routing` (D-16). Plan anything else; don't build it without asking.
- Never collect or store payment data. Every payment surface says "Payment simulation only".
- Never set, store or commit passwords. Users get passwords through Salesforce's reset email.
- Ask before changes that affect site access or shared org config (other agents, deployments).

## Repo layout

```
force-app/main/default/
  lwc/tsAbcHopeDonationJourney    4-step donation journey; campaign picker, ?campaign= and ?src=  (+ Jest tests)
  lwc/tsAbcHopeHero               Home carousel (featured slide + open campaigns)
  lwc/tsAbcHopeDonorDashboard     Container (D-51): loads data, view=home|giving, layout, section headings, #section scroll
  lwc/tsAbcHopeDashboard*         Its sections: Banner, Kpis, Campaigns, Impact, Stories, Causes, Journey,
                                  History (paged, loads itself), Assistant (Ask panel); Utils = shared helpers
  lwc/tsAbcHopeDonorMonthlyGifts  My Giving → Recurring Gifts: pause / resume / change / cancel (D-22)
  lwc/tsAbcHopeCampaignDetail     /campaign?name=… detail page: story, progress, programs, causes, Donate now
  lwc/tsAbcHopeProgramDetail      /program?name=… public program page: raised, people served, deliveries (D-33)
  lwc/tsAbcHopeOurWork, tsAbcHopeAbout   Public Our Work and About pages (D-26)
  lwc/tsAbcHopeCampaignPhotos     Shared campaign photo choice (cards, detail page, donation journey)
  lwc/tsAbcHopeGiftEvents         "Gifts changed" signal so cached data reloads after a donation
  lwc/tsAbcHopeDonorProfile       My Profile / Communication / Giving History tabs
  lwc/tsAbcHopePublicLayout       Theme layout for public pages (header nav, Donate, footer)
  lwc/tsAbcHopePortalLayout       Theme layout for portal pages (sidebar, top bar, user menu)
  lwc/tsAbcHopeIcon               Shared inline-SVG icon set
  Apex layers (D-51): *Controller = @AuraEnabled entry points only; *Service = logic + queries; *Dto = data shapes
  classes/TSAbcHopeDonationIntake{Controller,Service,Dto}   Donation journey: options, submitDonation; the controller
                                  also serves campaigns/programs (guest profile's only Apex class)
  classes/TSAbcHopeCampaign{Service,Dto}         Campaign cards/detail, programs, About totals (read side)
  classes/TSAbcHopeDonorPortal{Controller,Service,Dto}  Dashboard, giving pages, profile, recurring gifts (signed-in donor)
  classes/TSAbcHopeDonorAgent{Controller,Service,Dto}   Dashboard Ask panel → Agent API
  classes/TSAbcHopeMonthlyGift{Service,Dto}      Recurring gift list and NPC pause/resume/change/cancel (site and agent)
  classes/TSAbcHopeAgent*         Agent actions: CampaignInfo, GivingSummary, MonthlyGifts, UpdateProfile, Support (+ tests)
  classes/TSAbcHopeGiftNaming*    Gift naming rule "Campaign - Cause - Donor - date time", org time zone (D-38, D-39)
  triggers/TSAbcHopeGift*Naming   Name every new gift/commitment; re-name when its cause changes (D-39)
  classes/TSAbcHopeCommitmentPauseSync*, triggers/TSAbcHopeGiftScheduleSync   Status Paused/Active + Next Transaction Date from pause schedules; hourly job (D-40, D-42)
  classes/TSAbcHopeCommitmentCampaign*    New schedules/instalments without a campaign take the commitment's (D-41)
  aiAuthoringBundles/ABC_Hope_Donor_Assistant   Agent Script (.agent) for the agent
  flows/ABC_Hope_Chat_Routing    Omni-Channel routing → the agent (the only flow; approved exception)
  messagingChannels/, EmbeddedServiceConfig/    ABC Hope Chat channel + deployment
  permissionsets/                ABC_Hope_Donor_Portal (portal users), ABC_Hope_Agent_Actions (agent user)
  cspTrustedSites/               Unsplash_Images (img-src for the site); ABC_Hope_Site (agent links not redacted, D-49)
  digitalExperiences/site/ABC_Hope1/            LWR routes, views, theme, theme layouts
  networks/, sites/, profiles/   Site settings and guest profile
scripts/sitePages.py             Regenerates routes/views/theme layouts — use instead of hand-editing JSON
scripts/apex/seed*.apex          Idempotent demo data (campaigns, designations, programs, program delivery, source code, Maya history)
```

## Commands

```bash
# deploy + publish (LWR freezes component code at publish — always publish after deploying site LWCs)
sf project deploy start -o npo-demo -d force-app/main/default/lwc/tsAbcHopeDonationJourney
sf community publish -n "ABC Hope" -o npo-demo

# tests
sf apex run test -o npo-demo -n TSAbcHopeDonationIntakeServiceTest,TSAbcHopeDonationIntakeControllerTest,TSAbcHopeDonorPortalControllerTest,TSAbcHopeAgentActionsTest -c -r human -w 15
npm run test:unit

# demo data (idempotent)
sf apex run -o npo-demo -f scripts/apex/seedChristmasGiving.apex
sf apex run -o npo-demo -f scripts/apex/seedCampaigns.apex
sf apex run -o npo-demo -f scripts/apex/seedMayaHistory.apex
sf apex run -o npo-demo -f scripts/apex/seedPrograms.apex
sf apex run -o npo-demo -f scripts/apex/seedProgramDelivery.apex
sf apex run -o npo-demo -f scripts/apex/fillCommitmentCampaigns.apex   # instalments missing a campaign (D-41)
sf apex run -o npo-demo -f scripts/apex/renameGifts.apex   # gift names: Campaign - Cause - Donor - date (D-38)

# site pages after editing scripts/sitePages.py
python3 scripts/sitePages.py && sf project deploy start -o npo-demo -d force-app/main/default/digitalExperiences/site/ABC_Hope1

# agent
sf agent validate authoring-bundle -o npo-demo --api-name ABC_Hope_Donor_Assistant
sf agent preview start -o npo-demo --authoring-bundle ABC_Hope_Donor_Assistant --use-live-actions
sf agent publish authoring-bundle -o npo-demo --api-name ABC_Hope_Donor_Assistant
sf agent activate -o npo-demo -n ABC_Hope_Donor_Assistant --version <n>   # without --version it prompts
```

## Conventions & gotchas

- **Naming (D-37):** our LWCs and Apex classes are **TS** (company) + **AbcHope** (project) + usage:
  LWC `tsAbcHope<Usage>` (markup `c-ts-abc-hope-…`), Apex `TSAbcHope<Usage>`. Apex names stay ≤ 40 characters.
  The org's other components (sdo…, b2b…, xdo…) are not ours.

- **LWC:** custom CSS with `:host` tokens, mobile-first, native inputs. The site runs **synthetic shadow**,
  so global theme `a:link` styles leak in — use parent-qualified selectors for links (D-11).
  Never use SVG `url(#id)` references in templates — LWC rewrites ids (D-14).
- **Apex:** guest- and agent-facing classes are `without sharing` and validate every input server-side.
  Donor identity comes only from the running portal user or, for the agent, from
  `MessagingEndUser.AuthenticatedEndUserId` — never from typed input (D-12, D-15).
- **NPC quirks:** Paid gifts get an automatic 100% designation (re-point it, D-13); NPC standard
  actions want Id inputs as Strings; schedule changes must target the open-ended schedule; tests need
  an org-wide default designation.
- **Campaign cards** list campaigns that are active, not ended and have a `GiftDefaultDesignation` (D-18).
- **Cloud sessions:** `.claude/hooks/session-start.sh` runs `npm install`, installs the `sf` CLI and logs in
  as `npo-demo` from the `SF_AUTH_URL` environment secret. Never echo that URL — it holds a refresh token.
- `sf agent publish` retrieves metadata back into the repo (unformatted class files, new `aiAgents/` and
  `aiAgentDefinitionVersions/` folders) — discard those with `git checkout`/`rm` after publishing.
- Prettier runs on commit (husky + lint-staged) and reformats files — re-read before scripted edits.
- Docs: decisions → `decisions.md` (D-xx); status → `Handover.md`; demo/test → `testing-steps.md`.
- Commits end with the `Co-Authored-By` line.
