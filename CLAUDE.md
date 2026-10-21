# CLAUDE.md — npo-demo (ABC Hope · Christmas Giving 2026)

Context for Claude Code (and humans) working in this repo. Read this first, then
`Handover.md` for current status and `Implementation-plan.md` for what's next.

## What this project is

A Salesforce **Nonprofit Cloud (NPC)** demo: a public donation journey on the
**ABC Hope** Experience Cloud **LWR** site, plus a signed-in donor portal and an
Agentforce chat box. Payment is **simulated** — no money is ever collected.

Source designs (UI concept images provided by the user, 2026‑10‑21):

1. **Donor portal home** (GoodHands mock → rebrand to ABC Hope): KPI cards, shared impact,
   stories, impact journey timeline, "Ask About Your Journey" agent panel.
2. **Christmas Giving 2026 — Re-engagement to Giving**: Maya Grande (returning donor)
   Reconnect (Marketing Cloud email) → Sign in → Make a gift → Manage profile → Staff review
   (Gift Transaction with Campaign / Designation / Outreach Source Code).
3. **Christmas Giving 2026 — Donation Journey**: guest flow Discover → Choose donation
   (one-time/monthly, THB 300/500/1,000/Other, designation) → Your details
   (Individual/Organization) → Review & submit → Thank you; back office record.
4. **Task sheet** (10 Experience Cloud tasks) — see `Implementation-plan.md`.

## Org

| Item                 | Value                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI alias            | `npo-demo` (default org in `.sf/config.json`)                                                                                                                                                                                      |
| Org Id               | `00Dg700000KmYYXEA3`                                                                                                                                                                                                               |
| Instance             | `https://te1791557923677.my.salesforce.com`                                                                                                                                                                                        |
| API version          | 68.0                                                                                                                                                                                                                               |
| Person Accounts      | Enabled (`PersonAccount`, `NGO_Fundraising_Supporter` RTs)                                                                                                                                                                         |
| Currency             | **USD only** (single-currency org) — see decisions.md D-05                                                                                                                                                                         |
| Site                 | Network `ABC Hope` (`0DBg7000002PpKjGAK`), LWR bundle `site/ABC_Hope1`. **LWR URL: `https://te1791557923677.my.site.com/`** (pages `/`, `/donate`, `/my-giving`, `/my-profile`). `/vforcesite` is only the Visualforce/login side. |
| Guest user / profile | `ABC Hope Site Guest User` (`005g700000Ed1KLAAZ`) / `ABC Hope Profile`                                                                                                                                                             |

## Hard guardrails (from the user)

- **Do NOT create Flows, Validation Rules, Custom Objects or Custom Fields** unless the
  user explicitly lifts this restriction. Plan them, document them, but don't build/deploy.
- Never collect or store real payment data. Every UI surface says "Payment simulation only".
- Don't commit secrets. `.sf/` and `.sfdx/` are git-ignored.
- Ask before deploying anything that changes site access (going Live, public access).

## Repo layout

```
force-app/main/default/
  digitalExperiences/site/ABC_Hope1/   LWR site content (routes, views, theme) — retrieved baseline
  digitalExperienceConfigs/            LWR site config
  networks/ABC Hope.network-meta.xml   Network settings (status, self-reg, members)
  sites/ABC_Hope.site-meta.xml         CustomSite (guest user, URL prefix)
  profiles/ABC Hope Profile...         Guest profile
  lwc/donationJourney                  Guest/signed-in donation journey (4 steps) + Jest tests
  lwc/abcHopeHero                      Home "Discover" hero, keeps ?src= on the Donate link
  lwc/donorDashboard, lwc/donorProfile Signed-in portal (mockup #1, mockup #2 step 4)
  classes/DonationIntake*              Donation Apex (controller, service, tests)
  classes/DonorPortalController*       Portal Apex (dashboard, profile)
  permissionsets/ABC_Hope_Donor_Portal Apex access for signed-in donors
scripts/sitePages.py                   Regenerates LWR route/view JSON for the custom pages
scripts/apex/seed*.apex                Idempotent demo data (campaign, designations, source code, Maya history)
```

## Commands

```bash
sf project retrieve start -o npo-demo -m "DigitalExperienceBundle:site/ABC_Hope1"
sf project deploy start -o npo-demo -d force-app/main/default/lwc/donationJourney --dry-run
sf apex run test -o npo-demo -n DonationIntakeServiceTest -r human -w 10
npm run test:unit            # LWC Jest
npm run lint && npm run prettier
```

After deploying site content **or any LWC used on the site**, **publish** the site (Builder → Publish, or
`sf community publish -n "ABC Hope" -o npo-demo`).

## Conventions

- LWC: SLDS-free custom CSS with `:host` tokens, mobile-first, native inputs (full styling control).
  The site uses **synthetic shadow** — global theme `a` styles leak in; see decisions.md D-11.
- Apex: `DonationIntake*` prefix. Guest-facing classes are `without sharing` **only** where
  record matching requires it; validate & sanitize every input server-side; no SOQL in loops;
  every class ≥ 85% coverage with assertion-based tests.
- Docs: decisions go to `decisions.md` (ADR-lite, numbered D-xx); status goes to `Handover.md`.
- Commits end with the `Co-Authored-By` line; remote is `git@github.com:Chaipitch/npo-demo.git`.
