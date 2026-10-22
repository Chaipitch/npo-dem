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
- EmbeddedServiceConfig `ABC_Hope_Chat` — `areGuestUsersAllowed = true`, `site = ABC_Hope1` (must be the
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
