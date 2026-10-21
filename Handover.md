# Handover — ABC Hope · Christmas Giving 2026

_Last updated: 2026‑10‑21_

## TL;DR

Public donation journey and signed-in donor portal are built, deployed and published on the ABC Hope LWR site.
Guest donations create real NPC records (payment simulated). One manual step left for the chat widget.

**Site:** https://te1791557923677.my.site.com/ — `/` campaign home · `/donate` · `/dashboard` · `/my-giving` · `/my-profile`

## Status

| Area                                  | State                                                                                                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo data                             | ✅ Campaign _Christmas Giving 2026_, designations (School Supplies, Learning Kits, Where Most Needed), campaign default designation, source code `XMAS26-EMAIL`, Maya's 2023–2025 gift history (`scripts/apex/seed*.apex`, idempotent)         |
| Apex                                  | ✅ `DonationIntakeController/Service`, `DonorPortalController` — 22 tests pass, 91–98% coverage                                                                                                                                                |
| LWC                                   | ✅ `donationJourney` (10 Jest tests pass), `abcHopeHero`, `donorDashboard` (view=home/giving), `donorProfile`, `abcHopeIcon`, theme layouts `abcHopePublicLayout`, `abcHopePortalLayout`                                                       |
| Site                                  | ✅ Live, public access on; Home + Donate public, portal pages require login; guest profile → `DonationIntakeController` only                                                                                                                   |
| Signed-in donor                       | ✅ Maya Grande portal user `005g700000EemAjAAJ` (Customer Community Login, permset `ABC_Hope_Donor_Portal`), no password set                                                                                                                   |
| Chat / Agent                          | ✅ ABC Hope Donor Assistant (Agent Script, active) + routing flow `ABC_Hope_Chat_Routing` + channel/deployment `ABC_Hope_Chat` (Auth, guests allowed). 🟨 Embedded Messaging component still to place in Builder (enable Experience-site auth) |
| Git                                   | ✅ Pushed to `git@github.com:Chaipitch/npo-dem.git` (`main`)                                                                                                                                                                                   |
| Flows / VRs / custom objects / fields | None created (user instruction)                                                                                                                                                                                                                |

## How to sign in as Maya

Site login: https://te1791557923677.my.site.com/ → **Sign in**, username `maya.grande@abchope.demo.00dg700000kmyyx`.
Password: set Maya's user email to an inbox you control, then **Reset Password** and choose one from the email.
No password is stored in this repo.

## How to see the signed-in portal (no password)

Setup → Contacts → **Maya Grande** → **Log in to Experience as User** → ABC Hope → opens `/dashboard`.

## Manual step: chat widget

1. Experience Builder → ABC Hope → open any page using the _ABC Hope Public_ layout.
2. Components → **Embedded Messaging** → drag into the theme **Footer** region; select deployment **ABC Hope Chat**.
3. Repeat on a page using the _ABC Hope Portal_ layout. Publish.
4. Then: `sf project retrieve start -o npo-demo -m "DigitalExperienceBundle:site/ABC_Hope1"` and commit.

## Gotchas

- LWR freezes component code at publish: after deploying any LWC used on the site, run `sf community publish -n "ABC Hope" -o npo-demo`.
- `scripts/sitePages.py` regenerates routes/views/theme layouts — re-run it rather than hand-editing JSON.
- Synthetic shadow: theme `a:link` styles leak into components (D-11). SVG `url(#id)` refs break (D-14).
- On Paid gifts NPC auto-creates a 100% designation (D-13).
- Org is USD-only; UI labels amounts "THB" (D-05).
- The LWR site is at the domain root; `/vforcesite` is only the Visualforce side.

## Open items

1. Place the Embedded Messaging component (above).
2. Real photos for hero / stories / review card (send images → upload to CMS → set the URL properties).
3. Header nav "Our Work" and "About" point to `/` until those pages exist.
