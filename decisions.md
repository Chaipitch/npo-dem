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

Hero (Christian Bowen), dashboard banner (Ben Kupke), sidebar sprout (Artem Makarov) are served from
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
- **"Non Profit Event"** stays on the site as is.
