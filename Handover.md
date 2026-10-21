# Handover — ABC Hope · Christmas Giving 2026

_Last updated: 2026‑10‑21_

## TL;DR
Phase 0 (setup + discovery + docs) done. No Salesforce metadata or data has been changed
in the org yet — only retrieved. Next: Phase 1 data seed and Phase 2 LWC + Apex
(see `Implementation-plan.md`).

## Status
| Area | State |
|---|---|
| Git | Local repo on `main`, commits made. **Not pushed** — `git@github.com:Chaipitch/npo-dem.git` and `.../npo-demo.git` both return "Repository not found" (SSH auth works as `Chaipitch`). Create the repo on GitHub, then `git push -u origin main`. Remote currently set to `npo-demo.git`. |
| Site metadata | Retrieved baseline of `site/ABC_Hope1`, `ABC_Hope1` config, Network `ABC Hope`, CustomSite `ABC_Hope`, `ABC Hope Profile`. |
| Org changes | None. |
| Flows / VRs / custom objects / fields | **Do not create** (user instruction). |

## Org findings (2026‑10‑21)
- Nonprofit Cloud Fundraising objects present: `GiftTransaction`, `GiftCommitment`,
  `GiftCommitmentSchedule`, `GiftTransactionDesignation`, `GiftDesignation`,
  `GiftDefaultDesignation`, `OutreachSourceCode`. 13,590 existing GiftTransactions (demo data).
- Required on create: GiftTransaction `Name`, `OriginalAmount`, `PaymentMethod`;
  GiftCommitment `Name`, `DonorId`; Schedule `GiftCommitmentId`, `TransactionAmount`, `StartDate`.
- Person Accounts on. Maya Grande exists as Person Account `001g70000175AtRAAU`
  (`maya@email.com`), **no portal user**.
- Currency: USD only (mockups say THB → decisions D-05).
- **Missing data**: Campaign "Christmas Giving 2026", designation "School Supplies",
  source code for the Christmas email.
- Existing designations: General Fund, Unrestricted, Food Insecurity Fund, etc. (9).
- Site "ABC Hope": LWR (Build Your Own), only template pages; `authenticationType =
  AUTHENTICATED`; Network status `UnderConstruction`; self-registration off; only member
  profile is System Administrator.
- Guest user `ABC Hope Site Guest User` / profile `ABC Hope Profile`; Run Flows = false.
- Agents: `Donor_Support_Agent` (BotDefinition, InternalCopilot), `SDO_Service_Agentforce_Service_Agent`
  (ExternalCopilot), `NGO_Fundraising_Agent`, …; Embedded Service deployments incl.
  `Donor_Support_Agent` and `SDO_Messaging_for_Web`.
- Existing flow `NGO_Coordinate_Gift_Commitment_Processing` (active) handles commitment
  processing — relied on for monthly gifts, not modified.

## Open questions for the user
1. GitHub repo name — create `npo-demo` (or `npo-dem`?) and confirm.
2. D-03 — OK to implement the journey as LWC + Apex now, Screen Flow later (or never)?
3. D-05 — currency: label "THB" on USD fields for the demo, or enable multi-currency?
4. Phase 3 — OK to make the site public (guest access) and set it Live?
5. Phase 4 — OK to create a Customer Community user for Maya Grande?
6. D-09 — which agent backs the site chat (`Donor_Support_Agent` vs Agentforce Service Agent)?

## Gotchas
- Two `Site` rows (`ABC_Hope`, `ABC_Hope1`) share one guest user — that's how LWR sites are stored.
- Retrieving the full `ABC Hope Profile` pulls a large file; deploy only the diffs you need.
- After any site deploy you must **publish** the site for changes to appear.
