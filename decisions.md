# Decisions — ABC Hope Christmas Giving 2026

ADR-lite log. Status: **Accepted**, **Proposed** (needs user sign-off), **Superseded**.

---

### D-01 · Build on the existing LWR site "ABC Hope" — Accepted

The user created it already. Bundle `site/ABC_Hope1`, Network `ABC Hope`, URL prefix
`vforcesite`. We extend it; we don't create a new site. (A second, Aura-era CustomSite
record `ABC_Hope` shares the guest user — normal for LWR sites.)

### D-02 · No Flows / Validation Rules / Custom Objects / Custom Fields for now — Accepted

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

### D-09 · Agent chat — Accepted: use `Donor_Support_Agent` deployment; wiring pending

User chose the existing Embedded Service deployment `Donor_Support_Agent` (Messaging for Web).
Findings blocking a straight embed:

- Messaging channel `authMode = Auth` and deployment `areGuestUsersAllowed = false` → every
  visitor must present a verified-user JWT (`userVerificationAPI.setIdentityToken`).
- LWR site has `isRelaxedCSPLevel = false`; the bootstrap snippet in head markup needs Relaxed CSP
  (+ CORS allowlist + trusted URLs for the site domain).
- ESW endpoint site: `ESWDonorSupportAgent1791563118800`.
  Options: (A) switch the channel to unauthenticated + allow guests, (B) keep Auth and build JWT user
  verification (certificate + Apex token endpoint), (C) create a separate unauthenticated deployment
  just for ABC Hope. Awaiting user choice. The dashboard's "Ask About Your Journey" panel already calls
  `embeddedservice_bootstrap.utilAPI.launchChat()` when the chat is present.

### D-10 · Branding — Accepted

Image #1 shows "GoodHands Foundation"; the site is **ABC Hope**. Use ABC Hope name/logo,
the purple/navy palette from images #2–#3, red "Donate" CTA.

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
