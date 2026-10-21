# ABC Hope — Christmas Giving 2026 (Nonprofit Cloud demo)

A Salesforce Nonprofit Cloud demo on an Experience Cloud **LWR** site: a public donation journey,
a signed-in donor portal with campaign cards, and an Agentforce donor assistant. Payment is simulated —
no money is ever collected.

**Live site:** https://te1791557923677.my.site.com/

| Page          | What it is                                                                              |
| ------------- | --------------------------------------------------------------------------------------- |
| `/`           | Christmas campaign home (Discover)                                                      |
| `/donate`     | 4-step donation journey; `?campaign=<name>` picks the campaign, `?src=` tags the source |
| `/dashboard`  | Signed-in donor home: campaign cards, KPIs, impact, journey, agent panel                |
| `/my-giving`  | Giving history                                                                          |
| `/my-profile` | Profile and communication preferences                                                   |

## Quick start

```bash
sf org login web -a npo-demo          # once
sf project deploy start -o npo-demo   # deploy everything in force-app
sf apex run -o npo-demo -f scripts/apex/seedChristmasGiving.apex
sf apex run -o npo-demo -f scripts/apex/seedCampaigns.apex
sf apex run -o npo-demo -f scripts/apex/seedMayaHistory.apex
sf community publish -n "ABC Hope" -o npo-demo
npm install && npm run test:unit
```

## Documentation

- [CLAUDE.md](CLAUDE.md) — project context, org details, layout, commands, conventions
- [Handover.md](Handover.md) — current status, how to sign in, the remaining manual step
- [Implementation-plan.md](Implementation-plan.md) — phases, task-sheet mapping, technical field mapping
- [decisions.md](decisions.md) — design decisions (D-01 … D-18)
- [testing-steps.md](testing-steps.md) — automated, manual, security and agent tests; demo script

## Stack

Salesforce Nonprofit Cloud (Fundraising: Gift Transactions, Gift Commitments, Designations, Outreach
Source Codes) · Experience Cloud LWR · Lightning Web Components · Apex · Agentforce (Agent Script) ·
Messaging for In-App and Web.
