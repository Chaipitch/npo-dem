# Testing Steps — ABC Hope · Christmas Giving 2026

Org alias `npo-demo`. Site: **https://te1791557923677.my.site.com/** (LWR, root path).
Donate page: `/donate` · Portal: `/my-giving`, `/my-profile` (login required).

## 0. Pre-checks

```bash
sf data query -o npo-demo -q "SELECT Id, Name FROM Campaign WHERE Name = 'Christmas Giving 2026'"
sf data query -o npo-demo -q "SELECT Id, Name, IsActive FROM GiftDesignation WHERE Name = 'School Supplies'"
sf data query -o npo-demo -q "SELECT Id, SourceCode FROM OutreachSourceCode WHERE SourceCode = 'XMAS26-EMAIL'"
```

All three return exactly one row. Site is published and **Live**; `/donate` opens in an
incognito window without login.

## 1. Automated tests

```bash
sf apex run test -o npo-demo -n DonationIntakeServiceTest,DonationIntakeControllerTest -c -r human -w 10
npm run test:unit
```

Pass criteria: 100% pass, each class ≥ 85% coverage, Jest green.

Apex cases to cover: new individual → Person Account created; existing email (any case) →
matched, no duplicate; organization new/existing; one-time → GiftTransaction + 100%
designation; monthly → GiftCommitment + Monthly schedule + default designation;
source code resolved/absent; invalid amount (0, negative, > max) rejected; bad email rejected;
inactive/unknown designation rejected; run as guest user succeeds.

## 2. Manual UI tests (incognito, desktop then mobile 375px)

| #   | Scenario                | Steps                                                         | Expected                                                                                                     |
| --- | ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| T1  | Discover                | Open `/`                                                      | Hero "Make Christmas Brighter", Donate Now → `/donate`                                                       |
| T2  | Defaults                | Open `/donate`                                                | Step 1 active, One-time selected, THB 1,000 preselected, School Supplies                                     |
| T3  | Other amount            | Click Other, enter 50 / 2500                                  | 50 → inline error, Next disabled; 2500 → OK                                                                  |
| T4  | Monthly toggle          | Select Monthly                                                | Monthly helper text shown; review shows "Monthly"                                                            |
| T5  | Individual validation   | Next with empty name / `ann@`                                 | Field errors, cannot proceed                                                                                 |
| T6  | Organization            | Switch to Organization                                        | Org name field shown, First/Last hidden                                                                      |
| T7  | Back nav                | Go to Review, click Back twice                                | Earlier values retained                                                                                      |
| T8  | Submit one-time         | Ann Demo / ann@example.com / 1,000 / School Supplies → Submit | Thank-you: "Your details have been received", THB 1,000 School Supplies, "No payment collected in this demo" |
| T9  | Double submit           | Double-click Submit                                           | Only one gift created (button disabled while pending)                                                        |
| T10 | Source code             | Open `/donate?src=XMAS26-EMAIL`, complete                     | Gift has Outreach Source Code set                                                                            |
| T11 | Returning donor (guest) | Submit again with `ANN@example.com`                           | Same Account reused                                                                                          |
| T12 | Monthly submit          | Monthly / 500                                                 | GiftCommitment + schedule created                                                                            |

## 3. Back-office verification (after T8/T10/T12)

```bash
sf data query -o npo-demo -q "SELECT Name, Donor.Name, OriginalAmount, Status, PaymentMethod, GiftType, Campaign.Name, OutreachSourceCode.SourceCode, CreatedDate FROM GiftTransaction WHERE Campaign.Name = 'Christmas Giving 2026' ORDER BY CreatedDate DESC LIMIT 5"
sf data query -o npo-demo -q "SELECT GiftTransaction.Name, GiftDesignation.Name, Percent FROM GiftTransactionDesignation WHERE GiftTransaction.Campaign.Name = 'Christmas Giving 2026'"
sf data query -o npo-demo -q "SELECT Name, Donor.Name, Status, (SELECT TransactionAmount, TransactionPeriod FROM GiftCommitmentSchedules) FROM GiftCommitment WHERE Campaign.Name = 'Christmas Giving 2026'"
sf data query -o npo-demo -q "SELECT Name, PersonEmail, RecordType.DeveloperName FROM Account WHERE PersonEmail = 'ann@example.com'"
```

Expected: Status `Unpaid`, PaymentMethod `Unknown`, Campaign attributed, designation 100%,
exactly one Ann Demo account.

## 4. Guest security checks

- Incognito: `/donate` works; any other internal page redirects to login.
- Guest profile: only `DonationIntakeController` Apex access; "Run Flows" off; no object
  edit/delete permissions (Setup → Profiles → ABC Hope Profile).
- Tamper: call `submitDonation` with a designation Id not in the allowed list → rejected.
- Response payload contains no record Ids other than the confirmation reference.

## 5. Signed-in donor (Phase 4)

How to sign in as Maya without a password: Setup → Contacts → **Maya Grande** → (dropdown)
**Log in to Experience as User** → ABC Hope. Then open `/my-giving`, `/my-profile`, `/donate`.
Expect dashboard KPIs: THB 2,250 total (seeded history), 3 causes, Since 2023 — plus any new gifts.

Log in as Maya Grande → "Welcome back, Maya Grande", details prefilled → gift → Manage
Profile edit phone → Save → verify Account updated; Giving History lists the new gift.

## 6. Agent chat (Phase 6)

Chat bubble loads on the site (no console CORS errors); ask "How can I donate?" → agent replies.

## Demo script (task #9, 3–5 min)

1. Marketing email (screenshot) → click link with `?src=XMAS26-EMAIL`.
2. Guest journey T2 → T8 on screen.
3. Switch to Salesforce: Gift Transaction record — Campaign, Designation, Source Code, Status.
4. (Phase 4) Maya signs in, gives, updates profile.
5. Campaign record → rollups / attribution report.
