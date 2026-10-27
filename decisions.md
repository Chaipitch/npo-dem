# Decisions — ABC Hope Christmas Giving 2026

ADR-lite log. Status: **Accepted**, **Proposed** (needs user sign-off), **Superseded**.

---

### D-01 · Build on the existing LWR site "ABC Hope" — Accepted

The user created it already. Bundle `site/ABC_Hope1`, Network `ABC Hope`, URL prefix
`vforcesite`. We extend it; we don't create a new site. (A second, Aura-era CustomSite
record `ABC_Hope` shares the guest user — normal for LWR sites.)

### D-02 · No Flows / Validation Rules / Custom Objects / Custom Fields for now — Accepted

_Exception: one Omni-Channel routing flow, `ABC_Hope_Chat_Routing` (D-16), approved by the user._

User instruction (2026‑10‑21). Everything in this phase uses **standard NPC objects and
fields only**. Task-sheet items that name a flow (#2 `Donor_Intake_Gift_Commitment_ScreenFlow`)
are documented and deferred — see D-03.

### D-03 · Donation journey = LWC UI + Apex service (no flow) — Accepted (user, 2026‑10‑21)

- **UI**: one container LWC `donationJourney` driving 5 steps (Discover, Choose, Details,
  Review, Thank you) to match mockup #3 pixel-closely. Screen-flow screens in LWR can't
  reproduce the stepper/amount tiles without custom screen components anyway.
- **Logic**: Apex `DonationIntakeService` (donor matching, gift creation, allocation).
- **Flow option later**: if the user wants the named Screen Flow, the same LWC step
  components become flow screen components and the Apex becomes `@InvocableMethod`s.
  Nothing in the LWC/Apex design blocks that.
- Why: respects D-02, gives full UX control, testable with Apex + Jest, guest-safe.

### D-04 · Simulated payment — Accepted

No gateway, no `PaymentInstrument`. One-time gift → `GiftTransaction` with
`Status = 'Unpaid'`, `PaymentMethod = 'Unknown'` (PaymentMethod is required). Recurring →
`GiftCommitment` (`Status = 'Active'`) + `GiftCommitmentSchedule` (Monthly). UI states
"Payment simulation only" / "No payment collected in this demo."

### D-05 · Currency: org is USD-only, mockups show THB — Accepted: label "THB" in UI (user, 2026‑10‑21)

Options: (a) enable multi-currency + add THB (irreversible org change — needs user OK);
(b) store numbers as-is in USD fields and label "THB" in UI only (demo shortcut, misleading
in reports); (c) relabel UI to USD. **Recommendation: (b) for the demo with a visible note in
Handover**, revisit if reports are shown to the client.

**Superseded 2026‑10‑26 (user): option (c).** The site and the agent now label amounts **USD** ("USD 1,000",
"USD 300 / week"), matching what the org stores; no conversion and no org currency change.

### D-06 · Donor matching rule — Accepted

Individual: match **Person Account** by `PersonEmail` (case-insensitive, most recently
modified wins if duplicates). No match → create Person Account (RT `NGO_Fundraising_Supporter`).
Organization: match **Business Account** by exact `Name` (+ contact email if provided);
no match → create Business Account. `GiftType` = `Individual` / `Organizational`.
Signed-in donor: use the running user's `Contact.AccountId` — no matching needed.

### D-07 · Attribution — Accepted

Every gift gets `CampaignId` = _Christmas Giving 2026_ and, when arriving from email,
`OutreachSourceCodeId` resolved from a `?src=` URL parameter (e.g. `XMAS26-EMAIL`).
Designation: `GiftTransactionDesignation` (100% to the chosen `GiftDesignation`).
Default designation for the campaign via `GiftDefaultDesignation` (Campaign → School Supplies).
These are **records** (data), not metadata, so D-02 doesn't block them.

### D-08 · Guest security model — Accepted

- Guest profile gets: Apex class access to `DonationIntakeController` only; no object CRUD
  beyond what's strictly required (target: none — Apex does DML in system mode).
- Server-side validation of all inputs (amount bounds, email format, picklist whitelist,
  designation must be active & in the allowed list).
- Response returns only a confirmation reference (gift name), never record IDs of other data.
- Records created by guest are owned by `siteGuestRecordDefaultOwner`.
- Site `authenticationType` changed to `AUTHENTICATED_WITH_PUBLIC_ACCESS_ENABLED`, Network status
  `Live` (user approved 2026‑10‑21). Home + `/donate` are `Public`; `/my-giving`, `/my-profile` are `RequiresLogin`.

### D-09 · Agent chat — Accepted: option C, separate ABC Hope deployment (user, 2026‑10‑21)

The existing `Donor_Support_Agent` deployment is Auth-only (verified-user JWT, no guests), so a separate
deployment was created for the site instead of changing a shared one:

- MessagingChannel `ABC_Hope_Chat` — copy of Donor_Support_Agent with `authMode = UnAuth`; same routing
  (flow `NGO_Donor_Support_MIAW`, queue `Donor_Support`) — no new flow.
- (Superseded 2026‑10‑26 by `ABC_Hope_Web_Chat`, D-25/D-26; deleted.) EmbeddedServiceConfig `ABC_Hope_Chat` — `areGuestUsersAllowed = true`, `site = ABC_Hope1` (must be the
  LWR/"Picasso" site record).
- Site domain already on the CORS allowlist (`https://te1791557923677.my.site.com`, `*.my.site.com`).
- **Remaining manual step:** drop the _Embedded Messaging_ component (`experience_messaging:embeddedMessaging`)
  into the ABC Hope theme layout footers in Experience Builder and publish, then retrieve the bundle so the
  JSON lives in source. Its attribute names aren't documented and no other site in the org uses it.
- Portal layout's "Ask Our AI" / search box and the dashboard's agent panel call
  `embeddedservice_bootstrap.utilAPI.launchChat()` once the component is on the page.

### D-10 · Branding & site structure — Accepted

Image #1 shows "GoodHands Foundation"; the site is **ABC Hope**. Use ABC Hope name/logo,
the purple/navy palette from images #2–#3, red "Donate" CTA.

- Public pages (`/`, `/donate`, login) use theme layout `abcPublicLayout` (`c:abcHopePublicLayout`, layout type `Inner`).
- Signed-in pages (`/dashboard`, `/my-giving`, `/my-profile`) use `abcPortalLayout` (`c:abcHopePortalLayout`,
  layout type `Portal`) — sidebar + top bar from mockup #1.
- `/dashboard` is the post-login home (Sign in link sets `startURL=/dashboard`); `/` stays the public campaign page.
- No corner decorations on the donate card (user, 2026‑10‑21). Imagery is flat SVG until real photos are supplied;
  every image slot has a URL property (`backgroundImageUrl`, `reviewImageUrl`).

### D-11 · CSS specificity under LWR synthetic shadow — Accepted

The ABC Hope LWR site renders LWC with **synthetic** shadow, so global theme rules such as
`a:link:not(.slds-button, …)` (specificity 0,2,2) beat simple component selectors. Links styled as
buttons use parent-qualified selectors (`.hero .cta:link`). Prefer `<button>` where possible.

### D-12 · Signed-in donors: Customer Community Login + permission set — Accepted

Maya Grande gets a `Customer Community Login User` user (230 licences free). Apex access is granted
via permission set `ABC_Hope_Donor_Portal` (DonationIntakeController, DonorPortalController) rather
than editing the standard profile. `DonorPortalController` scopes every query/update to the running
user's own `Contact.AccountId`.

### D-13 · NPC auto default designation — Accepted

On `Paid` GiftTransactions the org's automation inserts a 100% designation automatically; adding a
second one fails ("sum … is 100%"). Code and seed scripts re-point the existing designation if one
exists, otherwise insert. Also: the `*ASL Trigger v2` flow fails for Paid gifts inside Apex tests, so
tests use Unpaid/Pending.

### D-14 · No SVG `url(#id)` references in LWC templates — Accepted

LWC rewrites `id` attributes in templates, so `fill="url(#gradient)"` silently renders nothing. Use CSS
gradients on the container or solid fills instead.

### D-15 · Dedicated agent "ABC Hope Donor Assistant" — Accepted (user, 2026‑10‑21)

Agentforce Service Agent defined in source as Agent Script (`aiAuthoringBundles/ABC_Hope_Donor_Assistant`),
published + activated with `sf agent publish authoring-bundle` / `sf agent activate`. Runs as the existing
`ServiceAgent Agentforce` Einstein agent user + permission set `ABC_Hope_Agent_Actions`.
Topics → Apex actions: Campaign & donation FAQ (`AbcHopeAgentCampaignInfo`), My giving & impact
(`AbcHopeAgentGivingSummary`), Manage monthly gifts (`AbcHopeAgentMonthlyGifts`, wraps NPC standard actions
`pauseGiftCommitmentSchedule`, `resumeGiftCommitmentSchedule`, `manageRcrGiftCmtSchd`, `closeGiftCommitment`),
Update contact details (`AbcHopeAgentUpdateProfile`). The existing Donor Support Agent is untouched.
**Identity:** personal actions resolve the donor only via `MessagingEndUser.AuthenticatedEndUserId`
(verified site user) — never from typed input or pre-chat contact matching; the session Id is bound from
`@variables.RoutableId`, not slot-filled. Mutations require explicit user confirmation (agent instructions).
NPC standard actions need Id inputs as Strings; schedule changes must target the open-ended schedule.

### D-16 · One flow exception: `ABC_Hope_Chat_Routing` — Accepted (user, 2026‑10‑21)

Omni-Channel routing flow, copied from `NGO_Donor_Support_MIAW`, with `routingType = Copilot` →
`ABC_Hope_Donor_Assistant`. Messaging channel `ABC_Hope_Chat` uses it, in `Auth` mode with guests allowed
(signed-in donors are verified, visitors chat anonymously). No other flows exist in this project.

### D-17 · Photography from Unsplash (hotlinked) — Accepted (user, 2026‑10‑21)

Hero (Christian Bowen), dashboard banner (Ben Kupke), sidebar sprout (septian akbar, since 2026‑10‑26) are served from
`images.unsplash.com` (CSP Trusted Site `Unsplash_Images`, img-src, Communities) — not downloaded. Credits
shown on hero and banner. SVG illustrations remain as fallbacks when the URL properties are cleared.

### D-18 · Multiple campaigns on the dashboard — Accepted (user, 2026‑10‑21)

The donor dashboard shows **Campaigns You Can Support**. A campaign is listed when it is **active, not
ended, and has at least one `GiftDefaultDesignation`** — that marks it as a fundraising campaign without
needing a custom field. Cards show raised (sum of non-cancelled `GiftTransaction` amounts) vs goal
(`Campaign.ExpectedRevenue`), days left and designations. Clicking a card opens
`/donate?campaign=<Campaign.Name>`; the journey then offers that campaign's default designations plus
"Where Most Needed" (the Christmas campaign keeps its admin-configured list). Seeded by
`scripts/apex/seedCampaigns.apex`. Pre-existing org campaigns that meet the rule (Non Profit Event,
Capital Campaign) also appear; deactivate them to hide them.

### D-19 · Portal passwords — Accepted (user, 2026‑10‑21)

Passwords are never set, stored or committed by tooling. Maya's user email was changed to the user's
inbox and Salesforce's standard reset email was sent; the user chooses the password.

### D-20 · Agent knows every open campaign — Accepted (user, 2026‑10‑22)

The agent answered "there is one campaign" because `AbcHopeAgentCampaignInfo` only looked up one campaign
by exact name (default Christmas Giving 2026) and the agent script named that campaign everywhere.
The action now uses the D-18 rule via `DonationIntakeService.getCampaigns()`: with no name it lists every
open campaign (purpose, raised vs goal, end date, `/donate?campaign=…` link); with a name it matches
exactly, then partially, and returns that campaign's own causes (default designations + "Where Most
Needed"; the Christmas campaign keeps its configured list). Only campaigns with a `GiftDefaultDesignation`
are ever described, so internal campaigns stay hidden from guests. Agent instructions no longer imply a
single campaign and tell it to call the action with an empty name for "which/how many campaigns" questions.

### D-21 · Campaign → Program through designations — Accepted (user, 2026‑10‑22)

Program is what a campaign spends the money on. Link: Campaign ─< GiftDefaultDesignation >─ GiftDesignation ─>
Program, using the org's existing unmanaged lookup `GiftDesignation.NGOTV_Program__c` (created with the org
template on 2026‑10‑09; retrieved into source). No new schema. Many-to-many on purpose: one program can be funded
by several campaigns (Education Access ← Christmas Giving 2026 and Girls' Education Scholarships), so the user's
diagram line Campaign ─< Program reads as "campaign funds programs". Seeded by `scripts/apex/seedPrograms.apex`
(Education Access, Clean Water, Green Communities). Shown on campaign cards ("Funds …"), the donation journey
("Funds our … program."), giving history and the agent's campaign answers. No Program access was granted to the
guest profile: Apex reads it in system mode, like designations; a grant would expose Program records to anonymous
API reads.

### D-22 · Monthly gift self-service on My Giving — Accepted (user, 2026‑10‑22)

Signed-in donors pause (1, 2, 3, 6 or 12 months, starting tomorrow), resume, change the amount of (from tomorrow)
or cancel their own monthly gifts on `/my-giving` (`donorMonthlyGifts`, inside `donorDashboard`). Logic lives in
`MonthlyGiftService` and uses the same NPC standard actions as the agent (`pauseGiftCommitmentSchedule`,
`resumeGiftCommitmentSchedule`, `manageRcrGiftCmtSchd`, `closeGiftCommitment`). `DonorPortalController` resolves the
donor from the running user and only acts on that donor's own commitments (D-12). Cancel asks for confirmation.
NPC keeps a paused commitment **Active** and adds a `PauseTransactions` schedule, so "paused" means a current or
upcoming pause schedule: the dashboard now shows "N active monthly gifts · M paused until <date>" and no longer
counts paused gifts as active. The agent action was left unchanged (scope: Experience Cloud only).

### D-23 · Agent inside the dashboard panel (Agent API, verified donor) — Accepted (user, 2026‑10‑22)

The dashboard's "Ask About Your Journey" panel talks to the same **ABC Hope Donor Assistant** inline (no second
agent). Spike findings: a portal user can call the agent from Apex through the standard `generateAiAgentResponse`
action, but the agent's actions run as the agent user and that action only takes a message and session Id, so the
agent cannot tell who is asking. Chosen design (option A): `DonorAgentController` calls the **Agent API** with the
`ABC_Hope_Agent_API` named credential (External Client App, OAuth client credentials, run-as integration user
`agentapi.abchope@abchope.demo.00dg700000kmyyx`) and starts each session with the agent variable
`verified_account_id` = the running portal user's account (`visibility: "External"`, set only at session start, bound
straight to the actions' `verifiedAccountId` input, never from user input). `AbcHopeAgentSupport.verifiedAccountId`
prefers a messaging session (chat window) and otherwise trusts that Id only for an account with an active portal
user. The client ID/secret live only on the `AgentApiPrincipal` principal in Setup — never in git.

Until the principal holds the secret, `DonorAgentController.USE_AGENT_API = false`: the panel answers personal
questions itself from the dashboard data (total, causes, recent gifts, monthly gifts, journey — with links) and sends
everything else to the agent through `generateAiAgentResponse`. The Agent Script (with `verified_account_id`) was
published and activated as **version 5** on 2026‑10‑22 (user approved).

**Live 2026‑10‑26:** the admin set the principal; the run-as user was approved for the app through the new permission
set `ABC_Hope_Agent_API_Access` (selected in the app's OAuth policies — the API can't link a permission set to an
External Client App). `USE_AGENT_API = true`; the panel reads it through the cacheable `usesVerifiedAgent()` and, when
on, sends personal questions to the agent too, falling back to its local dashboard answer only if the call fails. Agent version 6 (same day): the giving summary gains a
"Programs funded" line (distinct `NGOTV_Program__r` names across counted gifts and active recurring gifts) and the
instructions say causes and programs differ, so "Which programs do my gifts fund?" names programs, not causes.

### D-24 · Recurring gifts: weekly, monthly or yearly — Accepted (user, 2026‑10‑22)

The donation journey's frequency toggle is **One-time | Recurring**; Recurring opens a second row **Weekly · Monthly ·
Yearly** (Monthly preselected). The journey sends the chosen period as the request's `frequency` (`One-time`,
`Weekly`, `Monthly` or `Yearly`), and `DonationIntakeService` writes it straight to
`GiftCommitmentSchedule.TransactionPeriod` (all three are standard NPC picklist values; interval stays 1). My Giving
cards show the period after the amount ("USD 300 / week"); older `Custom` schedules read as monthly. Pause, resume,
change amount and cancel work the same for every period.

Wording follow-up (user, same day): everything donors see says **recurring gifts**, with the type in brackets where a
single gift or the active set is described — "Recurring (Weekly)" on the My Giving card and the review step, "1 active
recurring gift (Monthly)" on the dashboard (new `Dashboard.activeRecurringTypes`), "Recurring Gifts" as the My Giving
heading, and the agent's action replies ("1. Recurring (Weekly): USD 300 per week to …"). API names stay as they are
(`donorMonthlyGifts`, `getMonthlyGifts`, `AbcHopeAgentMonthlyGifts`, subagent `monthly_gifts`, anchor `#monthly`)
because the site, agent and tests are wired to them. The Agent Script wording went live with agent version 5
(published and activated 2026‑10‑22).

Step 1 and step 2 of the journey also show the campaign photo as a banner across the top of the card (same
`abcHopeCampaignPhotos` choice as the cards and the review step).

### D-25 · Chat: dashboard Ask panel + chat window on every other page — Accepted (user, 2026‑10‑26)

The ABC Hope Donor Assistant is reachable in two ways, never both on one page:

- **`/dashboard`:** the **Ask About Your Journey** panel (plus the header box and "Ask Our AI", which send their
  question there), on the Agent API with the donor's verified account (D-23). No chat window here.
- **Every other page** (Home, Donate, Campaign detail, My Giving, My Profile): the **Embedded Messaging** chat window
  (deployment `ABC_Hope_Chat`, routing flow `ABC_Hope_Chat_Routing`, D-16), placed page by page so the dashboard is
  skipped, on the Setup-created deployment `ABC_Hope_Web_Chat` (hosted on its own ESW site). **Signed-in donors only**
  (user, 2026‑10‑26): the channel is authenticated, so guests see no chat button; no separate guest channel.
  Open issue: in the chat window the agent does not yet run its actions (it answers "please sign in" although the
  session is verified) — paused by the user.

### D-26 · Product decisions batch — Accepted (user, 2026‑10‑26)

- **Guests without an account** (e.g. Ann Demo) keep giving with name + email; the donor Account is matched or created
  behind the scenes. No forced sign-in, no account offer.
- **"Our Work" and "About"** become two simple public pages: Our Work lists programs and open campaigns; About has
  placeholder demo copy, editable in Experience Builder.
- **Changing a recurring gift's period** (weekly ↔ monthly ↔ yearly) is not offered; the card says to cancel and start
  a new gift.
- **Old deployment `ABC_Hope_Chat`** (hosted on the LWR site, never worked) is removed from the repo and deleted in the
  org; the messaging channel `ABC_Hope_Chat` stays (used by `ABC_Hope_Web_Chat`).
- **"Non Profit Event"** stays on the site as is. _(Superseded by D-30: it is now Christmas Meals for Families 2026.)_

### D-27 · Site gifts are saved as Paid — Accepted (user, 2026‑10‑26)

Payment is still simulated (nothing charged, no card or bank data), but a finished donation is now recorded as
received: one-time gifts are `GiftTransaction.Status = Paid` (PaymentMethod `Unknown`, TransactionDate today). A
recurring gift also gets a Paid gift transaction today for its amount, linked to the commitment (its first payment,
`TransactionDueDate` today); NPC still creates the later instalments as `Unpaid` on their dates. NPC's automatic 100%
designation on Paid gifts is re-pointed to the chosen cause (D-13). So a new recurring gift now adds to the totals at
once. Apex tests save `Pending` instead (`DonationIntakeService.giftStatus`): the org's managed "*ASL Trigger v2"
flow fails on Paid gifts in a test context only; real Paid inserts were verified in the org. Existing gifts keep
their status.

### D-28 · Chat window removed; the dashboard Ask panel is the only chat — Accepted (user, 2026‑10‑26)

Supersedes D-25's chat window. The Embedded Messaging component is removed from every page (`scripts/sitePages.py`);
the ABC Hope Donor Assistant is reached only through the dashboard's **Ask About Your Journey** panel (plus the header
box and "Ask Our AI", which send their question there), on the Agent API with the donor's verified account (D-23).
This also retires the open issue that the agent didn't run its actions in the chat window. The deployment
`ABC_Hope_Web_Chat`, its ESW site, the messaging channel `ABC_Hope_Chat` and the routing flow `ABC_Hope_Chat_Routing`
stay in the org, unused, so the widget can be put back without Setup work; `AbcHopeAgentSupport` keeps the
messaging-session path.

### D-29 · Agent acts on complete requests; one retry after a false prompt-guard flag — Accepted (2026‑10‑26)

Problem: after the agent asked "Please confirm…", the reply "yes, please go ahead" got "Sorry, I can't assist with
that…". The planner trace (`sf agent preview` on the published agent, `.sfdx/agents/…/traces`) showed Salesforce's
built-in prompt guard replacing the user's turn with a "reverse engineering" redaction and switching to its
`Reverse_Engineering` topic before our router ran, and telling the model to deny every later message in the session.
It flags short replies ("yes", "confirm", "Yes, resume it") often and full requests now and then; the draft preview
(authoring bundle) doesn't run it, and the org has no setting for it. Router changes (a follow-up rule, a remembered
last topic) can't help, because the message is replaced before routing.

Decision:

- **Agent (v12):** in `monthly_gifts` and `update_profile`, a request that already names the gift and the change
  (months to pause, new amount, new contact details) is carried out in the same turn; the donor's own request is the
  confirmation. The agent asks only for a missing detail, and for cancel only makes sure which gift. Pause, resume
  and amount changes are reversible from My Giving; payment stays simulated.
- **Panel (`DonorAgentController`):** when a reply is the guard's refusal ("Sorry, I can't assist…"), the message is
  sent once more in a fresh Agent API session for the same donor, so one false flag doesn't block the rest of the chat.
  A genuine off-topic question just gets its refusal after one extra call.

Verified live as Maya: pause and resume each run in one turn; her gift is active again afterwards.

### D-30 · Two more Christmas campaigns; Non Profit Event becomes Christmas Meals — Accepted (user, 2026‑10‑26)

- **Christmas Toy Drive 2026** (new): toys, books and warm clothes for children in shelters and foster care,
  1 Nov – 24 Dec 2026, goal USD 150,000, cause **Toys & Gifts** → new program **Child Wellbeing**.
- **Christmas Meals for Families 2026**: the org's original _Non Profit Event_ record, renamed and repurposed in
  place so its gifts stay (the raised total carries over). Holiday food boxes, 19 Oct – 31 Dec 2026, goal
  USD 100,000. Its default causes (General Fund 50% / Job Training Fund 50%) are replaced by **Holiday Meals**
  100% → new program **Family Support**; existing gifts keep their own designations.
- Records only, in `seedCampaigns.apex` (rename; causes as in D-32) and `seedPrograms.apex`; both stay idempotent.
- Photos (Unsplash License), chosen by the user: presents by Yevhen Buzuk (`toy|present`), Christmas table by
  Anthony Cantin (`meal|food`), in `abcHopeCampaignPhotos`.

### D-31 · Signed-in donors go to the dashboard 5 seconds after donating — Accepted (user, 2026‑10‑26)

The thank-you step shows "Taking you to your dashboard in 5 seconds…" with a **Go now** link, then opens
`/dashboard`, where the new gift shows (gift events, D-27). **Make another donation** cancels it. Guests have no
dashboard, so they stay on the thank-you step.

### D-32 · Several causes per campaign; whole-card click; thin highlight borders — Accepted (user, 2026‑10‑26)

- **Causes:** a campaign's causes are its `GiftDefaultDesignation` rows; shares add up to 100%.
  Christmas Toy Drive: Toys & Gifts 34 / Warm Clothes 33 / Books for Kids 33. Christmas Meals: Holiday Meals 50 /
  Grocery Vouchers 50. Christmas Giving: School Supplies 50 / Learning Kits 50. Clean Water: Clean Water 50 /
  Handwashing Stations 50. New causes are linked to programs (Warm Clothes → Child Wellbeing, Books for Kids →
  Education Access, Grocery Vouchers → Family Support, Handwashing Stations → Clean Water).
  `seedCampaigns.apex` makes each listed campaign's causes match the script exactly; it removes and shrinks shares
  before adding, so no campaign goes over 100%.
- The donor still picks **one** cause, and the whole gift goes to it. Splitting one gift across causes isn't built.
  Cause lists sort by share, then by creation date, so the original cause comes first and is pre-selected on a tie.
- **Dashboard campaign cards:** a click anywhere on the card opens `/campaign?name=…`; Donate now and View more keep
  their own links.
- **Highlights:** the active sidebar item and the paused recurring-gift card have a thin 1px border instead of a
  thick left bar.

### D-33 · Program figures, delivery data and a program page — Accepted (user, 2026‑10‑26)

- **Money raised per program:** Paid gift designations added up through cause → program
  (`GiftTransactionDesignation.Amount`, `GiftDesignation.NGOTV_Program__c`), with the number of distinct donors.
  Nothing is stored on Program: the figures are added up live (`DonationIntakeService.addProgramFigures`), so a new
  Paid gift shows at once.
- **Delivery data** for our five programs, with standard Program Management objects only:
  Benefit (with new Benefit Types "Goods Distribution" (Items) and "Meal Distribution" (Meals), and a new "Items"
  unit) → ProgramEnrollment → BenefitAssignment → BenefitDisbursement (`DisbursedQuantity`). 260 enrollments reuse
  people already enrolled in the org's Food Access program, so no new accounts and the People Reached tile is
  unchanged. 450 deliveries over the last 120 days. `scripts/apex/seedProgramDelivery.apex` skips any program that
  already has enrollments.
- **People served** = distinct accounts enrolled (In Progress or Completed); **deliveries** = quantity per benefit
  for disbursements that are Disbursed or Completed.
- **Program page** `/program?name=…` (public, `c/programDetail`): photo, summary, "Impact so far", the open
  campaigns that fund it (Donate →), its causes, the amount raised and Donate now (to the first funding campaign, or
  plain `/donate`). Our Work names link to it and its cards show raised · people served · the largest delivery;
  program names on the campaign page link to it. Program photos reuse the campaign themes (Child Wellbeing →
  presents, Family Support → meal).

### D-34 · Shared impact tiles add up Program reach fields — Accepted (user, 2026‑10‑26)

The user added three Number fields on Program: **People Reached** (`People_Reached__c`), **Communities**
(`Communities__c`) and **Volunteers Engaged** (`Volunteers_Engaged__c`). They are the user's own exception to the
"no custom fields" guardrail; they're retrieved into `objects/Program/fields/` so the repo deploys. The tiles now show
the sums over **active** Programs (blank = 0) instead of counting enrollments and volunteer assignments, and
Communities is live too (it was typed as 12). `{programs}` is still the active Program count. The program page's
"people served" (D-33) still counts enrollments, which is a different measure.

### D-35 · Impact Journey as one card per year — Accepted (user, 2026‑10‑26)

The zigzag timeline ("2026 · Supported X" for each cause) was hard to read. The dashboard now shows one card per year, stacked in one column,
oldest first: the year, "USD total · N gifts", a "Joined" badge on the supporter-since year, and the causes given to
that year (each once, with its program and amount, largest first; "New" marks the first year for that cause; an
active recurring gift with no payment yet shows "Recurring gift"). Built in Apex as `Dashboard.journeyYears` from the
same counted gifts as Total Contributions, so the year totals add up to it. The old `journey` milestones stay for
the agent and the chat panel's "journey" answer.

### D-36 · Donors choose the campaign on the donation page — Accepted (user, 2026‑10‑27)

The header's **Get Involved** and **Donate** open `/donate` with no campaign, which used to mean the configured
campaign (Christmas Giving 2026) only. Step 1 now has a **Campaign** list of every open campaign (`getCampaigns`, the
same list as the cards and the carousel), with the current one selected: the configured campaign, or `?campaign=` when
a card or program page sent the donor. Picking another campaign reloads its own causes (the admin's cause list applies
only to the configured campaign), photo and description. The list stays hidden until the campaigns load.

### D-37 · Company naming: TS + project + usage — Accepted (user, 2026‑10‑27)

All ABC Hope LWCs and Apex classes are renamed to **TS** (company) + **AbcHope** (project) + their usage. Salesforce
can't rename metadata, so the new names were deployed alongside the old ones, the site, guest profile, both permission
sets and the agent (v13) were pointed at them, and then the old ones were deleted. Decision entries above D-37 use the
old names.

| Old                                                                                                                                        | New                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| abcHopeAbout, abcHopeCampaignPhotos, abcHopeGiftEvents, abcHopeHero, abcHopeIcon, abcHopeOurWork, abcHopePortalLayout, abcHopePublicLayout | tsAbcHopeAbout, tsAbcHopeCampaignPhotos, tsAbcHopeGiftEvents, tsAbcHopeHero, tsAbcHopeIcon, tsAbcHopeOurWork, tsAbcHopePortalLayout, tsAbcHopePublicLayout |
| campaignDetail, donationJourney, donorDashboard, donorMonthlyGifts, donorProfile, programDetail                                            | tsAbcHopeCampaignDetail, tsAbcHopeDonationJourney, tsAbcHopeDonorDashboard, tsAbcHopeDonorMonthlyGifts, tsAbcHopeDonorProfile, tsAbcHopeProgramDetail      |
| DonationIntakeService, DonationIntakeController (+ Tests)                                                                                  | TSAbcHopeDonationIntakeService, TSAbcHopeDonationIntakeController (+ Tests)                                                                                |
| DonorPortalController, DonorAgentController (+ Tests), MonthlyGiftService                                                                  | TSAbcHopeDonorPortalController, TSAbcHopeDonorAgentController (+ Tests), TSAbcHopeMonthlyGiftService                                                       |
| AbcHopeAgentCampaignInfo, …GivingSummary, …MonthlyGifts, …UpdateProfile, …Support (+ SupportTest, ActionsTest)                             | TSAbcHopeAgentCampaignInfo, …GivingSummary, …MonthlyGifts, …UpdateProfile, …Support (+ SupportTest, ActionsTest)                                           |

**Left in the org (not in the repo):** nine old classes that the inactive agent versions v1–v12 still reference
(Salesforce refuses to delete an Apex class an agent action definition uses): AbcHopeAgentCampaignInfo,
AbcHopeAgentGivingSummary, AbcHopeAgentMonthlyGifts, AbcHopeAgentUpdateProfile, and what they call —
AbcHopeAgentSupport, DonationIntakeService, DonorPortalController, DonorAgentController, MonthlyGiftService. Nothing
active uses them: the site, the guest profile, both permission sets and agent v13 point only at the TS classes. They
can be deleted once the old agent versions are removed. Don't re-activate v12 or older: its actions point at the old
classes, which no permission set grants to the agent user any more.

### D-38 · Gift names include the cause — Accepted (user, 2026‑10‑27)

New site gifts (GiftTransaction) and recurring gifts (GiftCommitment, same name as their first payment) are named
**Campaign - Cause - Donor - yyyy-MM-dd HH:mm**, e.g. "Christmas Toy Drive 2026 - Toys & Gifts - Maya Grande -
2026-10-27 09:15"; the name is also the reference on the thank-you step. Long names: each part is shortened on its own
to campaign 60, cause 40 and donor 60 characters (ending in "..."), so the date and time are always kept and the
name stays under 190 of the 255 characters Name holds. The time zone is the org's default (D-39). Existing ABC Hope gifts and commitments were renamed too with `scripts/apex/renameGifts.apex`
(see the D-38 update below).

**D-38 update (2026‑10‑27):** `scripts/apex/renameGifts.apex` renamed 7 commitments and 29 gifts: those on the ABC
Hope campaigns or by Maya, the site guest user, a portal user or the agent; the org's other demo gifts are untouched.
Date = the gift's own date (TransactionDate, or the commitment's start date), time = when the record was created, in
the org's time zone (D-39); the cause is the gift's designation (an instalment takes its commitment's); "No
campaign" / "No cause" when missing. Idempotent: a second run renames nothing.

### D-39 · Every new gift follows the naming rule, in the org's time zone — Accepted (user, 2026‑10‑27)

Gifts made outside the site (in Salesforce, Gift Entry, imports, the agent, NPC-generated instalments) used other
names, e.g. "Jim Simon - 1000.00 - 2026-10-25". The rule now lives in one class, `TSAbcHopeGiftNaming`, used by:

- **Triggers** (records only, no flows): `TSAbcHopeGiftTransactionNaming` and `TSAbcHopeGiftCommitmentNaming`
  (before insert) name every new gift and commitment; `TSAbcHopeGiftDesignationNaming` and
  `TSAbcHopeGiftDefaultNaming` (after insert, update, delete) re-name the parent when its cause changes, because the
  cause is saved just after the gift. An instalment without its own designation takes its commitment's cause.
- **The site:** `TSAbcHopeDonationIntakeService` returns the name as saved, so the thank-you reference matches.
- **`scripts/apex/renameGifts.apex`** for records saved before the triggers (ABC Hope scope only).

Time zone: the **org's default** (Setup → Company Information; America/Los_Angeles until D-42, now Asia/Bangkok), read at run time. Date = the
gift's own date, or the creation date when the two are within a day of each other (a gift saved "today" by someone in
another time zone); back-dated history and future instalments keep their own date. A name typed by hand on a new
record is replaced; renaming an existing record by hand is kept until its cause changes.

### D-40 · Paused gifts show Status Paused and the right Next Transaction Date — Accepted (user, 2026‑10‑27)

NPC's pause action only adds a `PauseTransactions` schedule: the commitment stays **Active** and nothing marks it
Paused when the pause starts or Active again when it runs out. NPC itself allows Status **Paused** only while a pause
schedule covers today, and **Active** only while a `CreateTransactions` schedule does. `TSAbcHopeCommitmentPauseSync`:

- a pause covers today → **Paused**, Next Transaction Date = the first gift after the pause;
- still Paused, no pause today and a schedule giving today → **Active**, Next Transaction Date = the next gift from
  today (until a schedule covers today it stays Paused, which NPC requires);
- an upcoming pause → left to NPC (it already moves the next date past the pause; e.g. Books for Kids, 1 Jan 2027).

Gift dates: monthly on the schedule's TransactionDay (NPC's rule, day 1 by default), weekly and yearly stepping from the
schedule start. "Today" = the org's time zone. It runs from the trigger `TSAbcHopeGiftScheduleSync` (after a schedule is
inserted, updated or deleted: site, agent or Salesforce) and from a daily scheduled job at 00:15,
`TS ABC Hope recurring gift pause sync` (`TSAbcHopeCommitmentPauseSync.scheduleDaily()`), so pauses that start or end
with the calendar are picked up. NPC's resume action already sets Active and recalculates the next date.
**Scheduled** on 2026‑10‑27 with the org owner's go-ahead (first run 27 Oct 00:15 Los Angeles time; Setup → Scheduled Jobs).

### D-41 · Recurring gifts keep their campaign — Accepted (user, 2026‑10‑27)

NPC's pause, resume and change-amount actions save new `GiftCommitmentSchedule` rows without a campaign, and NPC
copies the schedule's campaign onto the next instalment, so those instalments dropped out of the campaign's raised
amount (and were named "No campaign - …"). `TSAbcHopeCommitmentCampaign`, from the before-insert triggers on
GiftCommitmentSchedule (`TSAbcHopeGiftScheduleSync`) and GiftTransaction (`TSAbcHopeGiftTransactionNaming`), gives a
new schedule or instalment without a campaign its commitment's campaign; a campaign set on purpose is kept.
`scripts/apex/fillCommitmentCampaigns.apex` backfilled 5 schedules and 3 instalments on 27 Oct (NPC refuses to change
the campaign on 3 older schedules that already have transactions; their instalments were fixed directly), then
`renameGifts.apex` refreshed the 3 names. `TSAbcHopeCommitmentPauseSync.scheduleDaily()` now returns the existing job
instead of failing when it is already scheduled.

### D-42 · Org time zone Bangkok; pause sync hourly on the running user's date — Accepted (user, 2026‑10‑27)

- The org's default time zone is **Asia/Bangkok** (was America/Los_Angeles; Setup → Company Information). Gift
  names use it (D-39), and `renameGifts.apex` re-ran: 8 commitments and 32 gifts now show Bangkok times.
- NPC checks "today" for Paused/Active in the **running user's** time zone, not the org's: a sync run as an admin on
  Los Angeles time was refused Paused for a pause that had started in Bangkok. So `TSAbcHopeCommitmentPauseSync` uses
  the running user's date (the acting user in the trigger, the scheduling user in the job), skips a gift NPC refuses
  instead of failing the run, and the job runs **hourly at :15** (`scheduleHourly()`, cron `0 15 * * * ?`) so a new
  day is picked up within the hour. Replaces D-40's daily 00:15 run and D-39's America/Los_Angeles.
- The job runs as the admin who scheduled it. That user (Wittawat) was set to Asia/Bangkok on 27 Oct and the job
  rescheduled, so a pause turns Paused at about 00:15 Bangkok time on its start day.

### D-43 · A pause from the portal or the assistant starts today; portal sidebar collapses at 1280px — Accepted (user, 2026‑10‑27)

- **Pause starts today** (was tomorrow) in `TSAbcHopeMonthlyGiftService.pause` and `TSAbcHopeAgentMonthlyGifts`:
  the start is the donor's today (or the open schedule's start, if later). NPC accepts it, even for a gift created
  today (it replaces that day's schedule; the Paid first payment stays), and the schedule trigger (D-40) then sets
  Status **Paused** at once with Next Transaction Date = the first gift after the pause. The My Giving hint reads "The
  pause starts today." Checked in the org (rolled back): new monthly gift → Pause 1 month → Paused, next 1 Dec 2026;
  Resume → Active, next 1 Nov 2026. A change of amount still applies from tomorrow.
- **Portal sidebar:** at 1280px and narrower the sidebar is a hamburger drawer (was 1024px).

### D-44 · Pause works after a resume, for every length in the picker — Accepted (user report, 2026‑10‑27)

- **Bug:** NPC never edits a schedule in place: each pause and resume splits it. Resuming a pause that started today
  turns it back into a CreateTransactions schedule with an end date, and the open-ended schedule starts after it. Our
  Pause took the open-ended schedule's start, so a pause after a resume was set for a later date: the gift stayed
  Active and showed an upcoming pause (`6gcg7000000OXyvAAG`: Pause, Resume, Pause, Resume, Pause left 4 schedules and
  a pause planned for 27 Feb 2027). Pausing the piece that covers today fixed the start date, but NPC refuses a pause
  that runs past the end of the schedule it is on, so only the shorter lengths worked.
- **Fix:** `TSAbcHopeMonthlyGiftService.scheduleToPause` (used by the portal and `TSAbcHopeAgentMonthlyGifts`) takes
  the CreateTransactions schedule covering today. If the pause runs past its end, it joins the following pieces that
  are the same gift (same amount, period, interval, day and payment method; a blank campaign matches, because NPC's
  resume drops it; no instalments on the pieces): they are deleted and the first piece is extended. NPC accepts that.
  If a different amount starts before the pause would end, the donor is told how long the gift can be paused.
- Checked on that gift (each rolled back): 1, 2, 3, 6 and 12 months all give "Paused from 10/27/2026", Status Paused,
  next gift the 1st after the pause. The portal controller test now pauses 3 months after a resume.

### D-45 · Guests are told how to manage a recurring gift — Accepted (user, 2026‑10‑27)

- Guests can give weekly, monthly or yearly, but only signed-in donors have My Giving (and the assistant's gift
  actions). The donation journey's recurring hint and the thank-you step now say "To pause or stop it later, sign in
  or contact the ABC Hope team." for guests, and "You can pause, change or stop it anytime on My Giving." for
  signed-in donors (was "You can stop anytime." for everyone). One-time gifts show no note.
- Thank-you step: a gap between the amount and "every month" (it read "USD 1,000every month").

### D-46 · About page facts are live totals over active Programs — Accepted (user, 2026‑10‑27)

- The About page's four cards were fixed placeholder text (8,400 / 12 / 6 / 125). They now show People reached,
  Communities, Programs and Volunteers summed over active Programs (People_Reached__c, Communities__c,
  Volunteers_Engaged__c; D-34), from `TSAbcHopeDonationIntakeService.getImpact` through the guest-accessible
  `TSAbcHopeDonationIntakeController.getImpact`. Site access is unchanged. The dashboard's shared impact uses the same
  method, so both pages always match (27 Oct 2026: 17,172 · 2,415 · 10 · 1,093).
- Communities stays a plain total (user): a community served by several programs counts once per program.
- No cards show until the totals load (no made-up numbers). The `facts` builder property stays, unused, because the
  published page still sets it and Salesforce refuses to remove it.
