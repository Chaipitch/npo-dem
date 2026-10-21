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

### D-03 · Donation journey = LWC UI + Apex service (flow deferred) — Proposed
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

### D-05 · Currency: org is USD-only, mockups show THB — Proposed
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
Every gift gets `CampaignId` = *Christmas Giving 2026* and, when arriving from email,
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
- Site `authenticationType` must change `AUTHENTICATED` → public access enabled, and Network
  status `UnderConstruction` → `Live`. **Ask user before deploying.**

### D-09 · Agent chat — Proposed
Use existing Embedded Service deployment `Donor_Support_Agent` (Messaging for Web) on the
site rather than building a custom chat LWC. Needs verification of the backing agent
(`Donor_Support_Agent` BotDefinition is listed as *InternalCopilot* — may need an external
Service agent). The image #1 "Ask About Your Journey" panel is the signed-in variant.

### D-10 · Branding — Accepted
Image #1 shows "GoodHands Foundation"; the site is **ABC Hope**. Use ABC Hope name/logo,
the purple/navy palette from images #2–#3, red "Donate" CTA.
