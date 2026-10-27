@IsTest
private class TSAbcHopeDonationIntakeServiceTest {
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

  static TSAbcHopeDonationIntakeService.Request individual(String email) {
    TSAbcHopeDonationIntakeService.Request req = new TSAbcHopeDonationIntakeService.Request();
    req.campaignName = CAMPAIGN;
    req.frequency = TSAbcHopeDonationIntakeService.FREQ_ONE_TIME;
    req.amount = 1000;
    req.designationId = designationId('Test School Supplies');
    req.donorType = TSAbcHopeDonationIntakeService.TYPE_INDIVIDUAL;
    req.firstName = 'Ann';
    req.lastName = 'Demo';
    req.email = email;
    return req;
  }

  @IsTest
  static void getOptionsReturnsConfiguredDesignationsInOrderWithCampaignDefault() {
    Test.startTest();
    TSAbcHopeDonationIntakeService.Options opts = TSAbcHopeDonationIntakeService.getOptions(
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
    TSAbcHopeDonationIntakeService.Request req = individual(
      'Ann.Demo@Example.com'
    );
    req.sourceCode = 'TEST-XMAS';

    Test.startTest();
    TSAbcHopeDonationIntakeService.Result res = TSAbcHopeDonationIntakeService.submit(
      req
    );
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
      TSAbcHopeDonationIntakeService.giftStatus,
      gt.Status,
      'Paid in the org; Pending in tests (D-27)'
    );
    Assert.areEqual('Unknown', gt.PaymentMethod);
    Assert.areEqual('Individual', gt.GiftType);
    Assert.areEqual(CAMPAIGN, gt.Campaign.Name);
    Assert.areEqual('TEST-XMAS', gt.OutreachSourceCode.SourceCode);
    Assert.areEqual(gt.Name, res.reference);
    Assert.isTrue(
      gt.Name.startsWith(CAMPAIGN + ' - Test School Supplies - '),
      'name = campaign - cause - donor - date (D-38): ' + gt.Name
    );
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
        .get(TSAbcHopeDonationIntakeService.PERSON_RT)
        .getRecordTypeId()
    );
    insert existing;
    TSAbcHopeDonationIntakeService.Request req = individual(
      'MAYA.TEST@example.com'
    );
    req.firstName = 'Different';

    Test.startTest();
    TSAbcHopeDonationIntakeService.submit(req);
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
    TSAbcHopeDonationIntakeService.Request req = individual(
      'csr@acme.example.com'
    );
    req.donorType = TSAbcHopeDonationIntakeService.TYPE_ORGANIZATION;
    req.organizationName = 'Acme Test Co';
    req.firstName = null;
    req.lastName = null;

    Test.startTest();
    TSAbcHopeDonationIntakeService.submit(req);
    req.amount = 2500; // different amount so the duplicate guard does not apply
    TSAbcHopeDonationIntakeService.submit(req);
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
    TSAbcHopeDonationIntakeService.Request req = individual(
      'monthly@example.com'
    );
    req.frequency = TSAbcHopeDonationIntakeService.FREQ_MONTHLY;
    req.amount = 500;
    req.designationId = designationId('Test Learning Kits');

    Test.startTest();
    TSAbcHopeDonationIntakeService.Result res = TSAbcHopeDonationIntakeService.submit(
      req
    );
    Test.stopTest();

    GiftCommitment gc = [
      SELECT Id, Name, Status, Campaign.Name
      FROM GiftCommitment
      WHERE Donor.PersonEmail = 'monthly@example.com'
    ];
    Assert.areEqual(CAMPAIGN, gc.Campaign.Name);
    Assert.areEqual(gc.Name, res.reference);
    Assert.isTrue(
      gc.Name.startsWith(CAMPAIGN + ' - '),
      'commitment named like its gifts (D-38): ' + gc.Name
    );
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
    Assert.areEqual(TSAbcHopeDonationIntakeService.giftStatus, first.Status);
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
    TSAbcHopeDonationIntakeService.Request weekly = individual(
      'weekly@example.com'
    );
    weekly.frequency = TSAbcHopeDonationIntakeService.FREQ_WEEKLY;
    weekly.amount = 300;
    TSAbcHopeDonationIntakeService.Request yearly = individual(
      'yearly@example.com'
    );
    yearly.frequency = TSAbcHopeDonationIntakeService.FREQ_YEARLY;
    yearly.amount = 5000;

    Test.startTest();
    TSAbcHopeDonationIntakeService.Result weeklyRes = TSAbcHopeDonationIntakeService.submit(
      weekly
    );
    TSAbcHopeDonationIntakeService.submit(yearly);
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
    TSAbcHopeDonationIntakeService.Result first = TSAbcHopeDonationIntakeService.submit(
      individual('double@example.com')
    );
    TSAbcHopeDonationIntakeService.Result second = TSAbcHopeDonationIntakeService.submit(
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
        .get(TSAbcHopeDonationIntakeService.PERSON_RT)
        .getRecordTypeId()
    );
    insert maya;
    TSAbcHopeDonationIntakeService.accountIdOverride = maya.Id;
    TSAbcHopeDonationIntakeService.Request req = individual(null); // no email needed when signed in
    req.donorType = null;

    Test.startTest();
    TSAbcHopeDonationIntakeService.Donor donor = TSAbcHopeDonationIntakeService.getCurrentDonor();
    TSAbcHopeDonationIntakeService.Result res = TSAbcHopeDonationIntakeService.submit(
      req
    );
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
    TSAbcHopeDonationIntakeService.Request req = individual(
      'nosrc@example.com'
    );
    req.sourceCode = 'NOT-A-CODE';
    Test.startTest();
    TSAbcHopeDonationIntakeService.submit(req);
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
    Map<String, TSAbcHopeDonationIntakeService.Request> bad = new Map<String, TSAbcHopeDonationIntakeService.Request>();
    TSAbcHopeDonationIntakeService.Request r;

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
    r.donorType = TSAbcHopeDonationIntakeService.TYPE_ORGANIZATION;
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
        TSAbcHopeDonationIntakeService.submit(bad.get(label));
        Assert.fail('Expected rejection: ' + label);
      } catch (TSAbcHopeDonationIntakeService.DonationException e) {
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
    TSAbcHopeDonationIntakeService.Request req = individual('xss@example.com');
    req.firstName = '<b>Ann</b>';
    Test.startTest();
    TSAbcHopeDonationIntakeService.submit(req);
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
    TSAbcHopeDonationIntakeService.submit(individual('raised@example.com'));

    Test.startTest();
    List<TSAbcHopeDonationIntakeService.CampaignCard> cards = TSAbcHopeDonationIntakeService.getCampaigns();
    Test.stopTest();

    TSAbcHopeDonationIntakeService.CampaignCard card;
    for (TSAbcHopeDonationIntakeService.CampaignCard c : cards) {
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
      Name = TSAbcHopeDonationIntakeService.GENERAL_DESIGNATION,
      IsActive = true
    );
    Test.startTest();
    TSAbcHopeDonationIntakeService.Options opts = TSAbcHopeDonationIntakeService.getOptions(
      CAMPAIGN,
      null
    );
    Test.stopTest();
    Assert.areEqual(2, opts.designations.size());
    Assert.areEqual('Test School Supplies', opts.designations[0].label);
    Assert.areEqual(
      TSAbcHopeDonationIntakeService.GENERAL_DESIGNATION,
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
    TSAbcHopeDonationIntakeService.CampaignCard card;
    for (
      TSAbcHopeDonationIntakeService.CampaignCard c : TSAbcHopeDonationIntakeService.getCampaigns()
    ) {
      if (c.name == CAMPAIGN) {
        card = c;
      }
    }
    TSAbcHopeDonationIntakeService.Options opts = TSAbcHopeDonationIntakeService.getOptions(
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
    TSAbcHopeDonationIntakeService.CampaignDetail d = TSAbcHopeDonationIntakeService.getCampaignDetail(
      CAMPAIGN
    );
    TSAbcHopeDonationIntakeService.CampaignDetail unknown = TSAbcHopeDonationIntakeService.getCampaignDetail(
      'No Such Campaign'
    );
    TSAbcHopeDonationIntakeService.CampaignDetail blank = TSAbcHopeDonationIntakeService.getCampaignDetail(
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
    List<TSAbcHopeDonationIntakeService.ProgramCard> programs = TSAbcHopeDonationIntakeController.getPrograms();
    Test.stopTest();

    TSAbcHopeDonationIntakeService.ProgramCard first;
    TSAbcHopeDonationIntakeService.ProgramCard idleCard;
    for (TSAbcHopeDonationIntakeService.ProgramCard c : programs) {
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
  static void programFiguresAddUpGiftsEnrollmentsAndDeliveries() {
    Program edu = new Program(
      Name = 'Test Education Access',
      Status = 'Active',
      People_Reached__c = 1200
    );
    insert edu;
    Id causeId = designationId('Test School Supplies');
    update new GiftDesignation(Id = causeId, NGOTV_Program__c = edu.Id);
    Account donor = new Account(Name = 'Test Donor Org');
    Account child = new Account(Name = 'Test Family');
    insert new List<Account>{ donor, child };
    GiftTransaction gift = new GiftTransaction(
      Name = 'Test gift',
      DonorId = donor.Id,
      OriginalAmount = 300,
      TransactionDate = Date.today(),
      Status = 'Pending',
      PaymentMethod = 'Unknown'
    );
    insert gift;
    insert new GiftTransactionDesignation(
      GiftTransactionId = gift.Id,
      GiftDesignationId = causeId,
      Amount = 300,
      Percent = 100
    );
    UnitOfMeasure unit = new UnitOfMeasure(
      Name = 'Test Items',
      UnitCode = 'titem',
      Type = 'Custom'
    );
    insert unit;
    BenefitType type = new BenefitType(
      Name = 'Test Goods',
      ProcessType = 'ProgramManagement',
      Type = 'Goods',
      UnitofMeasureId = unit.Id
    );
    insert type;
    Benefit kit = new Benefit(
      Name = 'Test Learning kit',
      ProgramId = edu.Id,
      BenefitTypeId = type.Id,
      UnitId = unit.Id,
      IsActive = true,
      BenefitStatus = 'Active',
      StartDateTime = Datetime.now().addDays(-30)
    );
    insert kit;
    ProgramEnrollment pe = new ProgramEnrollment(
      Name = 'Test enrollment',
      ProgramId = edu.Id,
      AccountId = child.Id,
      Status = 'In Progress'
    );
    insert pe;
    BenefitAssignment ba = new BenefitAssignment(
      BenefitId = kit.Id,
      ParentRecordId = pe.Id,
      ProgramEnrollmentId = pe.Id,
      EnrolleeId = child.Id,
      Status = 'Active'
    );
    insert ba;
    insert new BenefitDisbursement(
      BenefitAssignmentId = ba.Id,
      ProgramEnrollmentId = pe.Id,
      RecipientId = child.Id,
      ActualCompletionDate = Datetime.now().addDays(-1),
      DisbursedQuantity = 3,
      DisbursementStatus = 'Disbursed'
    );
    TSAbcHopeDonationIntakeService.raisedStatus = 'Pending';

    Test.startTest();
    TSAbcHopeDonationIntakeService.ProgramCard c = TSAbcHopeDonationIntakeController.getProgramDetail(
      ' test education access '
    );
    Test.stopTest();

    Assert.areEqual('Test Education Access', c.name);
    Assert.areEqual(300, c.raised);
    Assert.areEqual(1, c.donorCount);
    Assert.areEqual(1200, c.peopleReached, 'People_Reached__c, not enrolments');
    Assert.areEqual(1, c.deliveries.size());
    Assert.areEqual('Test Learning kit', c.deliveries[0].benefit);
    Assert.areEqual(3, c.deliveries[0].quantity);
    Assert.areEqual('Test Items', c.deliveries[0].unit);
    Assert.isNull(
      TSAbcHopeDonationIntakeService.getProgramDetail('No Such Program')
    );
    Assert.isNull(TSAbcHopeDonationIntakeService.getProgramDetail(null));
  }

  /** The campaign's causes become 34 / 33 / 33 (as Christmas Toy Drive 2026). */
  static void threeCauses() {
    GiftDesignation toys = new GiftDesignation(
      Name = 'Test Toys',
      IsActive = true
    );
    insert toys;
    Id campId = [SELECT Id FROM Campaign WHERE Name = :CAMPAIGN].Id;
    GiftDefaultDesignation existing = [
      SELECT Id
      FROM GiftDefaultDesignation
      WHERE ParentRecordId = :campId
    ];
    existing.AllocatedPercentage = 34;
    update existing;
    insert new List<GiftDefaultDesignation>{
      new GiftDefaultDesignation(
        ParentRecordId = campId,
        GiftDesignationId = designationId('Test Learning Kits'),
        AllocatedPercentage = 33
      ),
      new GiftDefaultDesignation(
        ParentRecordId = campId,
        GiftDesignationId = toys.Id,
        AllocatedPercentage = 33
      )
    };
  }

  @IsTest
  static void nonSpecifiedGiftIsSplitAcrossTheCampaignsCauses() {
    threeCauses();
    TSAbcHopeDonationIntakeService.Options opts = TSAbcHopeDonationIntakeService.getOptions(
      CAMPAIGN,
      null
    );
    Assert.areEqual(3, opts.split.size());
    Assert.areEqual(34, opts.split[0].percent);

    TSAbcHopeDonationIntakeService.Request req = individual(
      'split@example.com'
    );
    req.designationId = null;
    req.nonSpecified = true;
    req.amount = 1000.01;
    Test.startTest();
    TSAbcHopeDonationIntakeService.Result res = TSAbcHopeDonationIntakeService.submit(
      req
    );
    Test.stopTest();

    Assert.areEqual('Non specified', res.designationName);
    Assert.areEqual(
      'Test School Supplies 34%, Test Learning Kits 33%, Test Toys 33%',
      res.splitSummary
    );
    Assert.isTrue(res.reference.contains(' - Non specified - '), res.reference);
    List<GiftTransactionDesignation> parts = [
      SELECT GiftDesignation.Name, Amount, Percent
      FROM GiftTransactionDesignation
      WHERE GiftTransaction.Donor.PersonEmail = 'split@example.com'
      ORDER BY Percent DESC, GiftDesignation.Name DESC
    ];
    Assert.areEqual(3, parts.size());
    Assert.areEqual('Test School Supplies', parts[0].GiftDesignation.Name);
    Assert.areEqual(
      340.01,
      parts[0].Amount,
      'the largest share takes the remainder'
    );
    Assert.areEqual(330, parts[1].Amount);
    Assert.areEqual(330, parts[2].Amount);
    Decimal percent = 0;
    for (GiftTransactionDesignation p : parts) {
      percent += p.Percent;
    }
    Assert.areEqual(100, percent);
  }

  @IsTest
  static void nonSpecifiedMonthlyGiftSplitsEveryInstalment() {
    threeCauses();
    TSAbcHopeDonationIntakeService.Request req = individual(
      'split.monthly@example.com'
    );
    req.frequency = TSAbcHopeDonationIntakeService.FREQ_MONTHLY;
    req.designationId = null;
    req.nonSpecified = true;
    Test.startTest();
    TSAbcHopeDonationIntakeService.submit(req);
    Test.stopTest();
    GiftCommitment gc = [
      SELECT Id, Name
      FROM GiftCommitment
      WHERE Donor.PersonEmail = 'split.monthly@example.com'
    ];
    Assert.areEqual(
      3,
      [SELECT COUNT() FROM GiftDefaultDesignation WHERE ParentRecordId = :gc.Id]
    );
    Assert.isTrue(gc.Name.contains(' - Non specified - '), gc.Name);
  }

  @IsTest
  static void nonSpecifiedNeedsACampaignWithCauses() {
    Id campId = [SELECT Id FROM Campaign WHERE Name = :CAMPAIGN].Id;
    delete [
      SELECT Id
      FROM GiftDefaultDesignation
      WHERE ParentRecordId = :campId
    ];
    Assert.isTrue(
      TSAbcHopeDonationIntakeService.getOptions(CAMPAIGN, null).split.isEmpty()
    );
    TSAbcHopeDonationIntakeService.Request req = individual(
      'nosplit@example.com'
    );
    req.designationId = null;
    req.nonSpecified = true;
    try {
      TSAbcHopeDonationIntakeService.submit(req);
      Assert.fail('expected a refusal');
    } catch (TSAbcHopeDonationIntakeService.DonationException e) {
      Assert.isTrue(e.getMessage().contains('choose what you would like'));
    }
  }

  @IsTest
  static void giftNameShortensEachPartAndKeepsTheTime() {
    // Longest possible inputs: Campaign.Name 80, GiftDesignation.Name 80, Account.Name 255.
    String name = TSAbcHopeDonationIntakeService.buildName(
      'C'.repeat(80),
      'G'.repeat(80),
      'D'.repeat(255)
    );
    List<String> parts = name.split(' - ');
    Assert.areEqual(4, parts.size(), name);
    Assert.areEqual(60, parts[0].length());
    Assert.isTrue(parts[0].endsWith('...'));
    Assert.areEqual(40, parts[1].length());
    Assert.areEqual(60, parts[2].length());
    Assert.isTrue(
      Pattern.matches('\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}', parts[3]),
      'date and time kept: ' + name
    );
    Assert.isTrue(name.length() <= 185);
    // Short names are untouched.
    Assert.isTrue(
      TSAbcHopeDonationIntakeService.buildName(
          'Christmas Toy Drive 2026',
          'Toys & Gifts',
          'Maya Grande'
        )
        .startsWith('Christmas Toy Drive 2026 - Toys & Gifts - Maya Grande - ')
    );
  }

  @IsTest
  static void siteGiftStatusIsPendingInTestsAndPaidIsValid() {
    // Tests save Pending (the org's "*ASL Trigger v2" flow fails on Paid in tests); the org saves Paid.
    Assert.areEqual('Pending', TSAbcHopeDonationIntakeService.giftStatus);
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
