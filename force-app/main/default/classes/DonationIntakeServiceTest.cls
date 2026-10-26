@IsTest
private class DonationIntakeServiceTest {
  static final String CAMPAIGN = 'Test Christmas Giving';

  @TestSetup
  static void setup() {
    Campaign camp = new Campaign(
      Name = CAMPAIGN,
      IsActive = true,
      Status = 'In Progress'
    );
    insert camp;
    List<GiftDesignation> gds = new List<GiftDesignation>{
      new GiftDesignation(Name = 'Test School Supplies', IsActive = true),
      new GiftDesignation(Name = 'Test Learning Kits', IsActive = true),
      new GiftDesignation(Name = 'Test Retired Fund', IsActive = true)
    };
    insert gds;
    // Designations are always created active; retire one afterwards.
    update new GiftDesignation(Id = gds[2].Id, IsActive = false);
    insert new GiftDefaultDesignation(
      ParentRecordId = camp.Id,
      GiftDesignationId = gds[0].Id,
      AllocatedPercentage = 100
    );
    insert new OutreachSourceCode(
      Name = 'Test Email',
      SourceCode = 'TEST-XMAS',
      Status = 'Active',
      CampaignId = camp.Id
    );
  }

  static Id designationId(String name) {
    return [SELECT Id FROM GiftDesignation WHERE Name = :name].Id;
  }

  static DonationIntakeService.Request individual(String email) {
    DonationIntakeService.Request req = new DonationIntakeService.Request();
    req.campaignName = CAMPAIGN;
    req.frequency = DonationIntakeService.FREQ_ONE_TIME;
    req.amount = 1000;
    req.designationId = designationId('Test School Supplies');
    req.donorType = DonationIntakeService.TYPE_INDIVIDUAL;
    req.firstName = 'Ann';
    req.lastName = 'Demo';
    req.email = email;
    return req;
  }

  @IsTest
  static void getOptionsReturnsConfiguredDesignationsInOrderWithCampaignDefault() {
    Test.startTest();
    DonationIntakeService.Options opts = DonationIntakeService.getOptions(
      CAMPAIGN,
      'Test Learning Kits, Test School Supplies, Test Retired Fund'
    );
    Test.stopTest();
    Assert.areEqual(CAMPAIGN, opts.campaignName);
    Assert.areEqual(
      2,
      opts.designations.size(),
      'inactive designations are excluded'
    );
    Assert.areEqual(
      'Test Learning Kits',
      opts.designations[0].label,
      'admin order is kept'
    );
    Assert.areEqual(
      designationId('Test School Supplies'),
      opts.defaultDesignationId
    );
    Assert.isNull(opts.currentDonor, 'internal user is not a donor');
  }

  @IsTest
  static void oneTimeGiftCreatesPersonAccountTransactionAndDesignation() {
    DonationIntakeService.Request req = individual('Ann.Demo@Example.com');
    req.sourceCode = 'TEST-XMAS';

    Test.startTest();
    DonationIntakeService.Result res = DonationIntakeService.submit(req);
    Test.stopTest();

    Account donor = [
      SELECT Id, IsPersonAccount, PersonEmail
      FROM Account
      WHERE PersonEmail = 'ann.demo@example.com'
    ];
    Assert.isTrue(donor.IsPersonAccount);
    GiftTransaction gt = [
      SELECT
        Name,
        OriginalAmount,
        Status,
        PaymentMethod,
        GiftType,
        Campaign.Name,
        OutreachSourceCode.SourceCode
      FROM GiftTransaction
      WHERE DonorId = :donor.Id
    ];
    Assert.areEqual(1000, gt.OriginalAmount);
    Assert.areEqual(
      DonationIntakeService.giftStatus,
      gt.Status,
      'Paid in the org; Pending in tests (D-27)'
    );
    Assert.areEqual('Unknown', gt.PaymentMethod);
    Assert.areEqual('Individual', gt.GiftType);
    Assert.areEqual(CAMPAIGN, gt.Campaign.Name);
    Assert.areEqual('TEST-XMAS', gt.OutreachSourceCode.SourceCode);
    Assert.areEqual(gt.Name, res.reference);
    GiftTransactionDesignation gtd = [
      SELECT GiftDesignation.Name, Percent
      FROM GiftTransactionDesignation
      WHERE GiftTransaction.DonorId = :donor.Id
    ];
    Assert.areEqual('Test School Supplies', gtd.GiftDesignation.Name);
    Assert.areEqual(100, gtd.Percent);
    Assert.areEqual('Test School Supplies', res.designationName);
  }

  @IsTest
  static void returningDonorIsMatchedByEmailCaseInsensitively() {
    Account existing = new Account(
      FirstName = 'Maya',
      LastName = 'Grande',
      PersonEmail = 'maya.test@example.com',
      RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
        .get(DonationIntakeService.PERSON_RT)
        .getRecordTypeId()
    );
    insert existing;
    DonationIntakeService.Request req = individual('MAYA.TEST@example.com');
    req.firstName = 'Different';

    Test.startTest();
    DonationIntakeService.submit(req);
    Test.stopTest();

    Assert.areEqual(
      1,
      [SELECT COUNT() FROM Account WHERE PersonEmail = 'maya.test@example.com']
    );
    Assert.areEqual(
      1,
      [SELECT COUNT() FROM GiftTransaction WHERE DonorId = :existing.Id]
    );
  }

  @IsTest
  static void organizationGiftCreatesBusinessAccountOnceAndIsOrganizational() {
    DonationIntakeService.Request req = individual('csr@acme.example.com');
    req.donorType = DonationIntakeService.TYPE_ORGANIZATION;
    req.organizationName = 'Acme Test Co';
    req.firstName = null;
    req.lastName = null;

    Test.startTest();
    DonationIntakeService.submit(req);
    req.amount = 2500; // different amount so the duplicate guard does not apply
    DonationIntakeService.submit(req);
    Test.stopTest();

    Account org = [
      SELECT Id, IsPersonAccount
      FROM Account
      WHERE Name = 'Acme Test Co'
    ];
    Assert.isFalse(org.IsPersonAccount);
    List<GiftTransaction> gts = [
      SELECT GiftType, Description
      FROM GiftTransaction
      WHERE DonorId = :org.Id
    ];
    Assert.areEqual(2, gts.size(), 'second gift reuses the same organization');
    Assert.areEqual('Organizational', gts[0].GiftType);
    Assert.isTrue(gts[0].Description.contains('csr@acme.example.com'));
  }

  @IsTest
  static void monthlyGiftCreatesCommitmentScheduleAndDefaultDesignation() {
    DonationIntakeService.Request req = individual('monthly@example.com');
    req.frequency = DonationIntakeService.FREQ_MONTHLY;
    req.amount = 500;
    req.designationId = designationId('Test Learning Kits');

    Test.startTest();
    DonationIntakeService.Result res = DonationIntakeService.submit(req);
    Test.stopTest();

    GiftCommitment gc = [
      SELECT Id, Name, Status, Campaign.Name
      FROM GiftCommitment
      WHERE Donor.PersonEmail = 'monthly@example.com'
    ];
    Assert.areEqual(CAMPAIGN, gc.Campaign.Name);
    Assert.areEqual(gc.Name, res.reference);
    GiftCommitmentSchedule gcs = [
      SELECT TransactionAmount, TransactionPeriod, TransactionInterval
      FROM GiftCommitmentSchedule
      WHERE GiftCommitmentId = :gc.Id
      LIMIT 1
    ];
    Assert.areEqual(500, gcs.TransactionAmount);
    Assert.areEqual('Monthly', gcs.TransactionPeriod);
    Assert.areEqual(1, gcs.TransactionInterval);
    GiftDefaultDesignation gdd = [
      SELECT GiftDesignation.Name, AllocatedPercentage
      FROM GiftDefaultDesignation
      WHERE ParentRecordId = :gc.Id
    ];
    Assert.areEqual('Test Learning Kits', gdd.GiftDesignation.Name);
    Assert.areEqual(100, gdd.AllocatedPercentage);
    GiftTransaction first = [
      SELECT Id, Status, OriginalAmount, TransactionDate
      FROM GiftTransaction
      WHERE GiftCommitmentId = :gc.Id
    ];
    Assert.areEqual(DonationIntakeService.giftStatus, first.Status);
    Assert.areEqual(500, first.OriginalAmount);
    Assert.areEqual(Date.today(), first.TransactionDate);
    List<GiftTransactionDesignation> gtds = [
      SELECT GiftDesignation.Name
      FROM GiftTransactionDesignation
      WHERE GiftTransactionId = :first.Id
    ];
    Assert.areEqual(1, gtds.size());
    Assert.areEqual('Test Learning Kits', gtds[0].GiftDesignation.Name);
  }

  @IsTest
  static void weeklyAndYearlyGiftsUseTheirSchedulePeriod() {
    DonationIntakeService.Request weekly = individual('weekly@example.com');
    weekly.frequency = DonationIntakeService.FREQ_WEEKLY;
    weekly.amount = 300;
    DonationIntakeService.Request yearly = individual('yearly@example.com');
    yearly.frequency = DonationIntakeService.FREQ_YEARLY;
    yearly.amount = 5000;

    Test.startTest();
    DonationIntakeService.Result weeklyRes = DonationIntakeService.submit(
      weekly
    );
    DonationIntakeService.submit(yearly);
    Test.stopTest();

    Assert.areEqual('Weekly', weeklyRes.frequency);
    Map<String, String> periodByEmail = new Map<String, String>();
    for (GiftCommitmentSchedule gcs : [
      SELECT GiftCommitment.Donor.PersonEmail, TransactionPeriod
      FROM GiftCommitmentSchedule
      WHERE
        GiftCommitment.Donor.PersonEmail IN (
          'weekly@example.com',
          'yearly@example.com'
        )
        AND Type = 'CreateTransactions'
    ]) {
      periodByEmail.put(
        gcs.GiftCommitment.Donor.PersonEmail,
        gcs.TransactionPeriod
      );
    }
    Assert.areEqual('Weekly', periodByEmail.get('weekly@example.com'));
    Assert.areEqual('Yearly', periodByEmail.get('yearly@example.com'));
  }

  @IsTest
  static void doubleSubmitReturnsSameGift() {
    Test.startTest();
    DonationIntakeService.Result first = DonationIntakeService.submit(
      individual('double@example.com')
    );
    DonationIntakeService.Result second = DonationIntakeService.submit(
      individual('double@example.com')
    );
    Test.stopTest();
    Assert.areEqual(first.reference, second.reference);
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM GiftTransaction
        WHERE Donor.PersonEmail = 'double@example.com'
      ]
    );
  }

  @IsTest
  static void signedInDonorUsesOwnAccountAndIgnoresTypedDetails() {
    Account maya = new Account(
      FirstName = 'Maya',
      LastName = 'Signed',
      PersonEmail = 'maya.signed@example.com',
      RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
        .get(DonationIntakeService.PERSON_RT)
        .getRecordTypeId()
    );
    insert maya;
    DonationIntakeService.accountIdOverride = maya.Id;
    DonationIntakeService.Request req = individual(null); // no email needed when signed in
    req.donorType = null;

    Test.startTest();
    DonationIntakeService.Donor donor = DonationIntakeService.getCurrentDonor();
    DonationIntakeService.Result res = DonationIntakeService.submit(req);
    Test.stopTest();

    Assert.areEqual('maya.signed@example.com', donor.email);
    Assert.areEqual('Maya Signed', res.donorName);
    Assert.areEqual(
      1,
      [SELECT COUNT() FROM GiftTransaction WHERE DonorId = :maya.Id]
    );
    Assert.areEqual(0, [SELECT COUNT() FROM Account WHERE Name = 'Ann Demo']);
  }

  @IsTest
  static void unknownSourceCodeIsIgnored() {
    DonationIntakeService.Request req = individual('nosrc@example.com');
    req.sourceCode = 'NOT-A-CODE';
    Test.startTest();
    DonationIntakeService.submit(req);
    Test.stopTest();
    Assert.isNull(
      [
        SELECT OutreachSourceCodeId
        FROM GiftTransaction
        WHERE Donor.PersonEmail = 'nosrc@example.com'
      ]
      .OutreachSourceCodeId
    );
  }

  @IsTest
  static void invalidRequestsAreRejected() {
    Map<String, DonationIntakeService.Request> bad = new Map<String, DonationIntakeService.Request>();
    DonationIntakeService.Request r;

    r = individual('a@example.com');
    r.amount = 0;
    bad.put('zero amount', r);
    r = individual('a@example.com');
    r.amount = -100;
    bad.put('negative amount', r);
    r = individual('a@example.com');
    r.amount = 2000000;
    bad.put('amount over max', r);
    r = individual('ann@');
    bad.put('bad email', r);
    r = individual('a@example.com');
    r.frequency = 'Daily';
    bad.put('bad frequency', r);
    r = individual('a@example.com');
    r.donorType = 'Robot';
    bad.put('bad donor type', r);
    r = individual('a@example.com');
    r.lastName = '  ';
    bad.put('missing last name', r);
    r = individual('a@example.com');
    r.donorType = DonationIntakeService.TYPE_ORGANIZATION;
    bad.put('missing org name', r);
    r = individual('a@example.com');
    r.designationId = null;
    bad.put('missing designation', r);
    r = individual('a@example.com');
    r.designationId = designationId('Test Retired Fund');
    bad.put('inactive designation', r);
    r = individual('a@example.com');
    r.campaignName = 'No Such Campaign';
    bad.put('unknown campaign', r);
    bad.put('null request', null);

    Test.startTest();
    for (String label : bad.keySet()) {
      try {
        DonationIntakeService.submit(bad.get(label));
        Assert.fail('Expected rejection: ' + label);
      } catch (DonationIntakeService.DonationException e) {
        Assert.isTrue(String.isNotBlank(e.getMessage()), label);
      }
    }
    Test.stopTest();
    Assert.areEqual(
      0,
      [SELECT COUNT() FROM GiftTransaction WHERE Campaign.Name = :CAMPAIGN]
    );
  }

  @IsTest
  static void htmlIsStrippedFromNames() {
    DonationIntakeService.Request req = individual('xss@example.com');
    req.firstName = '<b>Ann</b>';
    Test.startTest();
    DonationIntakeService.submit(req);
    Test.stopTest();
    Assert.areEqual(
      'Ann',
      [SELECT FirstName FROM Account WHERE PersonEmail = 'xss@example.com']
      .FirstName
    );
  }

  @IsTest
  static void getCampaignsListsOnlyFundraisingCampaignsWithTotals() {
    Campaign withDefaults = [SELECT Id FROM Campaign WHERE Name = :CAMPAIGN];
    update new Campaign(
      Id = withDefaults.Id,
      ExpectedRevenue = 100000,
      EndDate = Date.today().addDays(10)
    );
    insert new Campaign(Name = 'Test No Designation Campaign', IsActive = true);
    insert new Campaign(
      Name = 'Test Ended Campaign',
      IsActive = true,
      EndDate = Date.today().addDays(-1)
    );
    DonationIntakeService.submit(individual('raised@example.com'));

    Test.startTest();
    List<DonationIntakeService.CampaignCard> cards = DonationIntakeService.getCampaigns();
    Test.stopTest();

    DonationIntakeService.CampaignCard card;
    for (DonationIntakeService.CampaignCard c : cards) {
      Assert.areNotEqual(
        'Test No Designation Campaign',
        c.name,
        'campaigns without a default designation are hidden'
      );
      if (c.name == CAMPAIGN) {
        card = c;
      }
    }
    Assert.isNotNull(card, 'campaign with a default designation is listed');
    Assert.areEqual(100000, card.goal);
    Assert.areEqual(1000, card.raised);
    Assert.areEqual(1, card.giftCount);
    Assert.areEqual(10, card.daysLeft);
    Assert.areEqual('Test School Supplies', card.designations[0]);
  }

  @IsTest
  static void getOptionsWithoutNamesUsesCampaignDefaultsPlusGeneral() {
    insert new GiftDesignation(
      Name = DonationIntakeService.GENERAL_DESIGNATION,
      IsActive = true
    );
    Test.startTest();
    DonationIntakeService.Options opts = DonationIntakeService.getOptions(
      CAMPAIGN,
      null
    );
    Test.stopTest();
    Assert.areEqual(2, opts.designations.size());
    Assert.areEqual('Test School Supplies', opts.designations[0].label);
    Assert.areEqual(
      DonationIntakeService.GENERAL_DESIGNATION,
      opts.designations[1].label
    );
  }

  @IsTest
  static void campaignsAndOptionsCarryEachDesignationsProgram() {
    Program edu = new Program(
      Name = 'Test Education Access',
      Status = 'Active'
    );
    insert edu;
    update new GiftDesignation(
      Id = designationId('Test School Supplies'),
      NGOTV_Program__c = edu.Id
    );
    Id campId = [SELECT Id FROM Campaign WHERE Name = :CAMPAIGN].Id;
    GiftDefaultDesignation existing = [
      SELECT Id
      FROM GiftDefaultDesignation
      WHERE ParentRecordId = :campId
    ];
    existing.AllocatedPercentage = 50;
    update existing;
    insert new GiftDefaultDesignation(
      ParentRecordId = campId,
      GiftDesignationId = designationId('Test Learning Kits'),
      AllocatedPercentage = 50
    );

    Test.startTest();
    DonationIntakeService.CampaignCard card;
    for (
      DonationIntakeService.CampaignCard c : DonationIntakeService.getCampaigns()
    ) {
      if (c.name == CAMPAIGN) {
        card = c;
      }
    }
    DonationIntakeService.Options opts = DonationIntakeService.getOptions(
      CAMPAIGN,
      'Test School Supplies, Test Learning Kits'
    );
    Test.stopTest();

    Assert.areEqual(
      new List<String>{ 'Test Education Access' },
      card.programs,
      'one entry per program; designations without one are skipped'
    );
    Assert.areEqual('Test Education Access', opts.designations[0].program);
    Assert.isNull(opts.designations[1].program);
  }

  @IsTest
  static void campaignDetailListsCausesAndProgramsForOpenCampaignsOnly() {
    Program edu = new Program(
      Name = 'Test Education Access',
      Status = 'Active',
      Summary = 'Keeps children learning.'
    );
    insert edu;
    update new GiftDesignation(
      Id = designationId('Test School Supplies'),
      Description = 'Notebooks and pencils.',
      NGOTV_Program__c = edu.Id
    );

    Test.startTest();
    DonationIntakeService.CampaignDetail d = DonationIntakeService.getCampaignDetail(
      CAMPAIGN
    );
    DonationIntakeService.CampaignDetail unknown = DonationIntakeService.getCampaignDetail(
      'No Such Campaign'
    );
    DonationIntakeService.CampaignDetail blank = DonationIntakeService.getCampaignDetail(
      ' '
    );
    Test.stopTest();

    Assert.areEqual(CAMPAIGN, d.card.name);
    Assert.areEqual(1, d.causes.size());
    Assert.areEqual('Test School Supplies', d.causes[0].name);
    Assert.areEqual('Notebooks and pencils.', d.causes[0].description);
    Assert.areEqual('Test Education Access', d.causes[0].program);
    Assert.areEqual(1, d.programs.size());
    Assert.areEqual('Keeps children learning.', d.programs[0].summary);
    Assert.isNull(unknown);
    Assert.isNull(blank);
  }

  @IsTest
  static void programsListFundingCampaignsFirst() {
    Program edu = new Program(
      Name = 'Test Education Access',
      Status = 'Active',
      Summary = 'Keeps children learning.'
    );
    Program idle = new Program(Name = 'Test Idle Program', Status = 'Active');
    insert new List<Program>{ edu, idle };
    update new GiftDesignation(
      Id = designationId('Test School Supplies'),
      NGOTV_Program__c = edu.Id
    );

    Test.startTest();
    List<DonationIntakeService.ProgramCard> programs = DonationIntakeController.getPrograms();
    Test.stopTest();

    DonationIntakeService.ProgramCard first;
    DonationIntakeService.ProgramCard idleCard;
    for (DonationIntakeService.ProgramCard c : programs) {
      if (c.name == 'Test Education Access')
        first = c;
      if (c.name == 'Test Idle Program')
        idleCard = c;
    }
    Assert.areEqual(
      'Test Education Access',
      programs[0].name,
      'funded programs first'
    );
    Assert.areEqual('Keeps children learning.', first.summary);
    Assert.areEqual(new List<String>{ CAMPAIGN }, first.campaigns);
    Assert.areEqual(new List<String>{ 'Test School Supplies' }, first.causes);
    Assert.isTrue(idleCard.campaigns.isEmpty());
  }

  @IsTest
  static void siteGiftStatusIsPendingInTestsAndPaidIsValid() {
    // Tests save Pending (the org's "*ASL Trigger v2" flow fails on Paid in tests); the org saves Paid.
    Assert.areEqual('Pending', DonationIntakeService.giftStatus);
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM PicklistValueInfo
        WHERE
          EntityParticle.EntityDefinition.QualifiedApiName = 'GiftTransaction'
          AND EntityParticle.QualifiedApiName = 'Status'
          AND Value = 'Paid'
      ],
      'Paid must stay a valid GiftTransaction status'
    );
  }
}
