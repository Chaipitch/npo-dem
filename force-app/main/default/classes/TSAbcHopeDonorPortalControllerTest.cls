@IsTest
private class TSAbcHopeDonorPortalControllerTest {
  static Account createDonor() {
    Account maya = new Account(
      FirstName = 'Maya',
      LastName = 'Portal',
      PersonEmail = 'maya.portal@example.com',
      RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
        .get('NGO_Fundraising_Supporter')
        .getRecordTypeId()
    );
    insert maya;
    return maya;
  }

  static void createGift(
    Account donor,
    Campaign camp,
    GiftDesignation gd,
    Decimal amount,
    Date d,
    String status
  ) {
    GiftTransaction gt = new GiftTransaction(
      Name = 'Gift ' + amount,
      DonorId = donor.Id,
      CampaignId = camp.Id,
      OriginalAmount = amount,
      TransactionDate = d,
      Status = status,
      PaymentMethod = 'Unknown'
    );
    insert gt;
    insert new GiftTransactionDesignation(
      GiftTransactionId = gt.Id,
      GiftDesignationId = gd.Id,
      Percent = 100,
      Amount = amount
    );
  }

  // Gifts use Unpaid/Pending: the org's "*ASL Trigger v2" flow fails on Paid gifts in a test context.
  @IsTest
  static void dashboardAggregatesOnlyTheDonorsOwnGifts() {
    Account maya = createDonor();
    Account other = new Account(Name = 'Someone Else Org');
    insert other;
    Campaign camp = new Campaign(Name = 'Test Xmas', IsActive = true);
    insert camp;
    GiftDesignation water = new GiftDesignation(
      Name = 'Test Clean Water',
      IsActive = true
    );
    Program eduProgram = new Program(
      Name = 'Test Education Access',
      Status = 'Active'
    );
    insert eduProgram;
    GiftDesignation edu = new GiftDesignation(
      Name = 'Test Education',
      IsActive = true,
      NGOTV_Program__c = eduProgram.Id
    );
    insert new List<GiftDesignation>{ water, edu };
    createGift(maya, camp, water, 200, Date.newInstance(2024, 3, 1), 'Unpaid');
    createGift(maya, camp, edu, 250, Date.newInstance(2025, 6, 1), 'Pending');
    createGift(maya, camp, edu, 999, Date.newInstance(2025, 7, 1), 'Canceled');
    createGift(
      other,
      camp,
      water,
      5000,
      Date.newInstance(2025, 1, 1),
      'Unpaid'
    );
    TSAbcHopeDonorPortalController.accountIdOverride = maya.Id;

    Test.startTest();
    TSAbcHopeDonorPortalController.Dashboard d = TSAbcHopeDonorPortalController.getDashboard();
    Test.stopTest();

    Assert.areEqual(
      450,
      d.totalContributions,
      'canceled and other donors excluded'
    );
    Assert.areEqual(2, d.causesSupported);
    Assert.areEqual('2024', d.supporterSince);
    Assert.areEqual(2, d.gifts.size());
    Assert.areEqual('Test Education', d.gifts[0].designations, 'newest first');
    Assert.areEqual(
      'Test Education Access',
      d.gifts[0].programs,
      'program comes from the designation (D-21)'
    );
    Assert.areEqual('', d.gifts[1].programs, 'designation without a program');
    Assert.areEqual(3, d.journey.size());
    Assert.areEqual('Joined as a supporter', d.journey[0].label);
    Assert.areEqual('Supported Test Clean Water', d.journey[1].label);
    Assert.areEqual('2025', d.journey[2].year);
    // One card per year, oldest first, with the year's causes and totals (D-35).
    Assert.areEqual(2, d.journeyYears.size());
    TSAbcHopeDonorPortalController.JourneyYear y2024 = d.journeyYears[0];
    Assert.areEqual('2024', y2024.year);
    Assert.isTrue(y2024.joined);
    Assert.areEqual(200, y2024.total);
    Assert.areEqual(1, y2024.giftCount);
    Assert.areEqual('Test Clean Water', y2024.items[0].cause);
    Assert.isTrue(y2024.items[0].isNew);
    TSAbcHopeDonorPortalController.JourneyYear y2025 = d.journeyYears[1];
    Assert.isFalse(y2025.joined);
    Assert.areEqual(250, y2025.total, 'canceled gift left out');
    Assert.areEqual('Test Education Access', y2025.items[0].program);
    Assert.areEqual('Maya', d.firstName);
  }

  @IsTest
  static void profileDonorSinceMatchesDashboardSupporterSince() {
    Account maya = createDonor();
    Campaign camp = new Campaign(Name = 'Test Since', IsActive = true);
    insert camp;
    GiftDesignation gd = new GiftDesignation(
      Name = 'Test Since Fund',
      IsActive = true
    );
    insert gd;
    createGift(maya, camp, gd, 300, Date.newInstance(2024, 5, 1), 'Unpaid');
    TSAbcHopeDonorPortalController.accountIdOverride = maya.Id;

    Test.startTest();
    TSAbcHopeDonorPortalController.Profile p = TSAbcHopeDonorPortalController.getProfile();
    TSAbcHopeDonorPortalController.Dashboard d = TSAbcHopeDonorPortalController.getDashboard();
    Test.stopTest();

    Assert.areEqual('2024', p.donorSince, 'first gift, not account creation');
    Assert.areEqual(d.supporterSince, p.donorSince);
  }

  @IsTest
  static void profileCanBeReadAndSaved() {
    Account maya = createDonor();
    TSAbcHopeDonorPortalController.accountIdOverride = maya.Id;

    Test.startTest();
    TSAbcHopeDonorPortalController.Profile p = TSAbcHopeDonorPortalController.getProfile();
    p.phone = '+66 81 234 5678';
    p.city = 'Bangkok';
    p.country = 'Thailand';
    p.email = 'Maya.New@Example.com';
    p.emailOptOut = true;
    TSAbcHopeDonorPortalController.Profile saved = TSAbcHopeDonorPortalController.saveProfile(
      JSON.serialize(p)
    );
    Test.stopTest();

    Assert.areEqual('maya.new@example.com', saved.email);
    Assert.areEqual('+66 81 234 5678', saved.phone);
    Assert.areEqual('Bangkok', saved.city);
    Assert.isTrue(saved.emailOptOut);
  }

  @IsTest
  static void saveProfileValidatesInput() {
    Account maya = createDonor();
    TSAbcHopeDonorPortalController.accountIdOverride = maya.Id;
    TSAbcHopeDonorPortalController.Profile p = TSAbcHopeDonorPortalController.getProfile();
    List<String> bodies = new List<String>{ 'garbage' };
    p.email = 'nope';
    bodies.add(JSON.serialize(p));
    p.email = 'ok@example.com';
    p.lastName = ' ';
    bodies.add(JSON.serialize(p));
    for (String body : bodies) {
      try {
        TSAbcHopeDonorPortalController.saveProfile(body);
        Assert.fail('expected error');
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }
    }
  }

  @IsTest
  static void businessAccountProfileCannotBeEdited() {
    Account org = new Account(Name = 'Org Donor');
    insert org;
    TSAbcHopeDonorPortalController.accountIdOverride = org.Id;
    try {
      TSAbcHopeDonorPortalController.saveProfile(
        '{"firstName":"a","lastName":"b","email":"a@b.co"}'
      );
      Assert.fail('expected error');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('individual'));
    }
  }

  @IsTest
  static void internalUserWithoutDonorAccountIsRejected() {
    try {
      TSAbcHopeDonorPortalController.getDashboard();
      Assert.fail('expected error');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('sign in'));
    }
  }

  // ---------------------------------------------------------------- monthly gifts (D-22)

  /** A monthly gift made through the site; returns the donor's account Id. */
  static Id donorWithMonthlyGift(String email) {
    // NPC schedule actions require an org-wide default designation.
    if (
      [
        SELECT COUNT()
        FROM GiftDesignation
        WHERE IsDefault = TRUE AND IsActive = TRUE
      ] == 0
    ) {
      insert new GiftDesignation(
        Name = 'Test General Fund',
        IsActive = true,
        IsDefault = true
      );
    }
    List<Campaign> camps = [
      SELECT Id
      FROM Campaign
      WHERE Name = 'Test Monthly Appeal'
    ];
    if (camps.isEmpty()) {
      insert new Campaign(Name = 'Test Monthly Appeal', IsActive = true);
    }
    List<GiftDesignation> gds = [
      SELECT Id
      FROM GiftDesignation
      WHERE Name = 'Test Meals'
    ];
    if (gds.isEmpty()) {
      gds.add(new GiftDesignation(Name = 'Test Meals', IsActive = true));
      insert gds;
    }
    TSAbcHopeDonationIntakeService.Request req = new TSAbcHopeDonationIntakeService.Request();
    req.campaignName = 'Test Monthly Appeal';
    req.frequency = TSAbcHopeDonationIntakeService.FREQ_MONTHLY;
    req.amount = 500;
    req.designationId = gds[0].Id;
    req.donorType = TSAbcHopeDonationIntakeService.TYPE_INDIVIDUAL;
    req.firstName = 'Mona';
    req.lastName = 'Monthly';
    req.email = email;
    TSAbcHopeDonationIntakeService.submit(req);
    return [SELECT Id FROM Account WHERE PersonEmail = :email].Id;
  }

  static String manageError(
    String giftId,
    String op,
    Integer months,
    Decimal amount
  ) {
    try {
      TSAbcHopeDonorPortalController.manageMonthlyGift(
        giftId,
        op,
        months,
        amount
      );
    } catch (AuraHandledException e) {
      return e.getMessage();
    }
    return null;
  }

  @IsTest
  static void donorPausesAndResumesOwnMonthlyGift() {
    TSAbcHopeDonorPortalController.accountIdOverride = donorWithMonthlyGift(
      'mona.pause@example.com'
    );
    List<TSAbcHopeMonthlyGiftService.Gift> gifts = TSAbcHopeDonorPortalController.getMonthlyGifts();
    Assert.areEqual(1, gifts.size());
    Assert.areEqual(500, gifts[0].amount);
    Assert.areEqual('Test Meals', gifts[0].designation);
    Assert.areEqual('Test Monthly Appeal', gifts[0].campaignName);
    Assert.areEqual('Monthly', gifts[0].period);
    Assert.isFalse(gifts[0].isPaused);
    Assert.areEqual(
      new List<String>{ 'Monthly' },
      TSAbcHopeDonorPortalController.getDashboard().activeRecurringTypes
    );

    Test.startTest();
    TSAbcHopeDonorPortalController.MonthlyGiftsResult paused = TSAbcHopeDonorPortalController.manageMonthlyGift(
      gifts[0].id,
      'pause',
      2,
      null
    );
    Test.stopTest();

    Assert.isTrue(paused.message.startsWith('Paused from'), paused.message);
    Assert.isTrue(paused.gifts[0].isPaused);
    Assert.areEqual(
      Date.today().addMonths(2).addDays(-1),
      paused.gifts[0].pausedUntil
    );
    TSAbcHopeDonorPortalController.Dashboard d = TSAbcHopeDonorPortalController.getDashboard();
    Assert.areEqual(
      0,
      d.activeMonthlyGifts,
      'a paused gift is not counted as active'
    );
    Assert.areEqual(1, d.pausedMonthlyGifts);
    Assert.isTrue(d.activeRecurringTypes.isEmpty(), 'only active gifts');
    Assert.areEqual(paused.gifts[0].pausedUntil, d.pausedUntil);

    TSAbcHopeDonorPortalController.MonthlyGiftsResult resumed = TSAbcHopeDonorPortalController.manageMonthlyGift(
      gifts[0].id,
      'resume',
      null,
      null
    );
    Assert.isFalse(resumed.gifts[0].isPaused, resumed.message);

    // Paused again after a resume: still from today, not from the later open-ended schedule (D-44).
    TSAbcHopeDonorPortalController.MonthlyGiftsResult again = TSAbcHopeDonorPortalController.manageMonthlyGift(
      gifts[0].id,
      'pause',
      1,
      null
    );
    Assert.isTrue(again.gifts[0].isPaused, again.message);
    Assert.areEqual(Date.today(), again.gifts[0].pausedFrom);
  }

  @IsTest
  static void donorChangesAmountOfOwnMonthlyGift() {
    TSAbcHopeDonorPortalController.accountIdOverride = donorWithMonthlyGift(
      'mona.change@example.com'
    );
    String giftId = TSAbcHopeDonorPortalController.getMonthlyGifts()[0].id;

    Test.startTest();
    TSAbcHopeDonorPortalController.MonthlyGiftsResult r = TSAbcHopeDonorPortalController.manageMonthlyGift(
      giftId,
      'change_amount',
      null,
      800
    );
    Test.stopTest();

    Assert.isTrue(r.message.contains('USD 800'), r.message);
    Assert.areEqual(800, r.gifts[0].amount);
  }

  @IsTest
  static void donorCancelsOwnMonthlyGift() {
    Id accountId = donorWithMonthlyGift('mona.cancel@example.com');
    TSAbcHopeDonorPortalController.accountIdOverride = accountId;
    String giftId = TSAbcHopeDonorPortalController.getMonthlyGifts()[0].id;

    Test.startTest();
    TSAbcHopeDonorPortalController.MonthlyGiftsResult r = TSAbcHopeDonorPortalController.manageMonthlyGift(
      giftId,
      'cancel',
      null,
      null
    );
    Test.stopTest();

    Assert.isTrue(r.gifts.isEmpty(), 'closed gifts are no longer listed');
    Assert.areEqual(
      'Closed',
      [SELECT Status FROM GiftCommitment WHERE DonorId = :accountId].Status
    );
    Assert.areEqual(
      0,
      TSAbcHopeDonorPortalController.getDashboard().activeMonthlyGifts
    );
  }

  @IsTest
  static void donorCannotManageSomeoneElsesGiftOrSendBadInput() {
    Id owner = donorWithMonthlyGift('mona.owner@example.com');
    TSAbcHopeDonorPortalController.accountIdOverride = owner;
    String giftId = TSAbcHopeDonorPortalController.getMonthlyGifts()[0].id;

    Assert.isTrue(
      manageError(giftId, 'delete', null, null).contains('Unknown action')
    );
    Assert.isTrue(
      manageError(giftId, 'pause', 13, null).contains('how many months')
    );
    Assert.isTrue(
      manageError(giftId, 'change_amount', null, 50).contains('between USD 100')
    );
    Assert.isTrue(
      manageError(giftId, 'resume', null, null).contains('not paused')
    );

    TSAbcHopeDonorPortalController.accountIdOverride = createDonor().Id;
    Assert.isTrue(
      manageError(giftId, 'cancel', null, null).contains('could not be found'),
      'another donor cannot touch this gift'
    );
    Assert.areEqual(
      'Active',
      [SELECT Status FROM GiftCommitment WHERE DonorId = :owner].Status
    );
  }

  @IsTest
  static void dashboardCountsActivePrograms() {
    Integer before = [SELECT COUNT() FROM Program WHERE Status = 'Active'];
    insert new List<Program>{
      new Program(Name = 'Test Active Program', Status = 'Active'),
      new Program(Name = 'Test Closed Program', Status = 'Completed')
    };
    TSAbcHopeDonorPortalController.accountIdOverride = createDonor().Id;
    Test.startTest();
    TSAbcHopeDonorPortalController.Dashboard d = TSAbcHopeDonorPortalController.getDashboard();
    Test.stopTest();
    Assert.areEqual(before + 1, d.activePrograms, 'only Active programs count');
  }

  @IsTest
  static void dashboardAddsUpReachFromActivePrograms() {
    AggregateResult before = [
      SELECT
        SUM(People_Reached__c) people,
        SUM(Communities__c) communities,
        SUM(Volunteers_Engaged__c) volunteers
      FROM Program
      WHERE Status = 'Active'
    ];
    insert new List<Program>{
      new Program(
        Name = 'Test Reach Program',
        Status = 'Active',
        People_Reached__c = 120,
        Communities__c = 7,
        Volunteers_Engaged__c = 15
      ),
      new Program(Name = 'Test Empty Program', Status = 'Active'),
      new Program(
        Name = 'Test Closed Reach Program',
        Status = 'Completed',
        People_Reached__c = 999,
        Communities__c = 99,
        Volunteers_Engaged__c = 99
      )
    };
    TSAbcHopeDonorPortalController.accountIdOverride = createDonor().Id;
    Test.startTest();
    TSAbcHopeDonorPortalController.Dashboard d = TSAbcHopeDonorPortalController.getDashboard();
    Test.stopTest();
    Assert.areEqual(
      sum(before.get('people')) + 120,
      d.peopleReached,
      'active programs only; blank counts as 0'
    );
    Assert.areEqual(sum(before.get('communities')) + 7, d.communities);
    Assert.areEqual(sum(before.get('volunteers')) + 15, d.volunteersEngaged);
  }

  static Integer sum(Object value) {
    return value == null ? 0 : ((Decimal) value).intValue();
  }
}
