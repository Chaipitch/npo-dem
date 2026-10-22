@IsTest
private class DonorPortalControllerTest {
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
    DonorPortalController.accountIdOverride = maya.Id;

    Test.startTest();
    DonorPortalController.Dashboard d = DonorPortalController.getDashboard();
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
    DonorPortalController.accountIdOverride = maya.Id;

    Test.startTest();
    DonorPortalController.Profile p = DonorPortalController.getProfile();
    DonorPortalController.Dashboard d = DonorPortalController.getDashboard();
    Test.stopTest();

    Assert.areEqual('2024', p.donorSince, 'first gift, not account creation');
    Assert.areEqual(d.supporterSince, p.donorSince);
  }

  @IsTest
  static void profileCanBeReadAndSaved() {
    Account maya = createDonor();
    DonorPortalController.accountIdOverride = maya.Id;

    Test.startTest();
    DonorPortalController.Profile p = DonorPortalController.getProfile();
    p.phone = '+66 81 234 5678';
    p.city = 'Bangkok';
    p.country = 'Thailand';
    p.email = 'Maya.New@Example.com';
    p.emailOptOut = true;
    DonorPortalController.Profile saved = DonorPortalController.saveProfile(
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
    DonorPortalController.accountIdOverride = maya.Id;
    DonorPortalController.Profile p = DonorPortalController.getProfile();
    List<String> bodies = new List<String>{ 'garbage' };
    p.email = 'nope';
    bodies.add(JSON.serialize(p));
    p.email = 'ok@example.com';
    p.lastName = ' ';
    bodies.add(JSON.serialize(p));
    for (String body : bodies) {
      try {
        DonorPortalController.saveProfile(body);
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
    DonorPortalController.accountIdOverride = org.Id;
    try {
      DonorPortalController.saveProfile(
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
      DonorPortalController.getDashboard();
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
    DonationIntakeService.Request req = new DonationIntakeService.Request();
    req.campaignName = 'Test Monthly Appeal';
    req.frequency = DonationIntakeService.FREQ_MONTHLY;
    req.amount = 500;
    req.designationId = gds[0].Id;
    req.donorType = DonationIntakeService.TYPE_INDIVIDUAL;
    req.firstName = 'Mona';
    req.lastName = 'Monthly';
    req.email = email;
    DonationIntakeService.submit(req);
    return [SELECT Id FROM Account WHERE PersonEmail = :email].Id;
  }

  static String manageError(
    String giftId,
    String op,
    Integer months,
    Decimal amount
  ) {
    try {
      DonorPortalController.manageMonthlyGift(giftId, op, months, amount);
    } catch (AuraHandledException e) {
      return e.getMessage();
    }
    return null;
  }

  @IsTest
  static void donorPausesAndResumesOwnMonthlyGift() {
    DonorPortalController.accountIdOverride = donorWithMonthlyGift(
      'mona.pause@example.com'
    );
    List<MonthlyGiftService.Gift> gifts = DonorPortalController.getMonthlyGifts();
    Assert.areEqual(1, gifts.size());
    Assert.areEqual(500, gifts[0].amount);
    Assert.areEqual('Test Meals', gifts[0].designation);
    Assert.areEqual('Test Monthly Appeal', gifts[0].campaignName);
    Assert.isFalse(gifts[0].isPaused);

    Test.startTest();
    DonorPortalController.MonthlyGiftsResult paused = DonorPortalController.manageMonthlyGift(
      gifts[0].id,
      'pause',
      2,
      null
    );
    Test.stopTest();

    Assert.isTrue(paused.message.startsWith('Paused from'), paused.message);
    Assert.isTrue(paused.gifts[0].isPaused);
    Assert.areEqual(
      Date.today().addDays(1).addMonths(2).addDays(-1),
      paused.gifts[0].pausedUntil
    );
    DonorPortalController.Dashboard d = DonorPortalController.getDashboard();
    Assert.areEqual(
      0,
      d.activeMonthlyGifts,
      'a paused gift is not counted as active'
    );
    Assert.areEqual(1, d.pausedMonthlyGifts);
    Assert.areEqual(paused.gifts[0].pausedUntil, d.pausedUntil);

    DonorPortalController.MonthlyGiftsResult resumed = DonorPortalController.manageMonthlyGift(
      gifts[0].id,
      'resume',
      null,
      null
    );
    Assert.isFalse(resumed.gifts[0].isPaused, resumed.message);
  }

  @IsTest
  static void donorChangesAmountOfOwnMonthlyGift() {
    DonorPortalController.accountIdOverride = donorWithMonthlyGift(
      'mona.change@example.com'
    );
    String giftId = DonorPortalController.getMonthlyGifts()[0].id;

    Test.startTest();
    DonorPortalController.MonthlyGiftsResult r = DonorPortalController.manageMonthlyGift(
      giftId,
      'change_amount',
      null,
      800
    );
    Test.stopTest();

    Assert.isTrue(r.message.contains('THB 800'), r.message);
    Assert.areEqual(800, r.gifts[0].amount);
  }

  @IsTest
  static void donorCancelsOwnMonthlyGift() {
    Id accountId = donorWithMonthlyGift('mona.cancel@example.com');
    DonorPortalController.accountIdOverride = accountId;
    String giftId = DonorPortalController.getMonthlyGifts()[0].id;

    Test.startTest();
    DonorPortalController.MonthlyGiftsResult r = DonorPortalController.manageMonthlyGift(
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
    Assert.areEqual(0, DonorPortalController.getDashboard().activeMonthlyGifts);
  }

  @IsTest
  static void donorCannotManageSomeoneElsesGiftOrSendBadInput() {
    Id owner = donorWithMonthlyGift('mona.owner@example.com');
    DonorPortalController.accountIdOverride = owner;
    String giftId = DonorPortalController.getMonthlyGifts()[0].id;

    Assert.isTrue(
      manageError(giftId, 'delete', null, null).contains('Unknown action')
    );
    Assert.isTrue(
      manageError(giftId, 'pause', 13, null).contains('how many months')
    );
    Assert.isTrue(
      manageError(giftId, 'change_amount', null, 50).contains('between THB 100')
    );
    Assert.isTrue(
      manageError(giftId, 'resume', null, null).contains('not paused')
    );

    DonorPortalController.accountIdOverride = createDonor().Id;
    Assert.isTrue(
      manageError(giftId, 'cancel', null, null).contains('could not be found'),
      'another donor cannot touch this gift'
    );
    Assert.areEqual(
      'Active',
      [SELECT Status FROM GiftCommitment WHERE DonorId = :owner].Status
    );
  }
}
