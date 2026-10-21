@IsTest
private class AbcHopeAgentActionsTest {
  static final String CAMPAIGN = 'Christmas Giving 2026';

  @TestSetup
  static void setup() {
    insert new Campaign(
      Name = CAMPAIGN,
      IsActive = true,
      Status = 'In Progress',
      Description = 'School supplies for children.'
    );
    insert new GiftDesignation(
      Name = 'School Supplies',
      IsActive = true,
      Description = 'Notebooks and pencils.'
    );
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
  }

  static Id createDonorWithMonthlyGift(String email, Decimal amount) {
    DonationIntakeService.Request req = new DonationIntakeService.Request();
    req.campaignName = CAMPAIGN;
    req.frequency = DonationIntakeService.FREQ_MONTHLY;
    req.amount = amount;
    req.designationId = [
      SELECT Id
      FROM GiftDesignation
      WHERE Name = 'School Supplies'
    ]
    .Id;
    req.donorType = DonationIntakeService.TYPE_INDIVIDUAL;
    req.firstName = 'Maya';
    req.lastName = 'Agent';
    req.email = email;
    DonationIntakeService.submit(req);
    return [SELECT Id FROM Account WHERE PersonEmail = :email].Id;
  }

  static AbcHopeAgentMonthlyGifts.Result monthly(
    String op,
    Integer months,
    Decimal amount
  ) {
    AbcHopeAgentMonthlyGifts.Request req = new AbcHopeAgentMonthlyGifts.Request();
    req.messagingSessionId = 'session';
    req.operation = op;
    req.pauseMonths = months;
    req.newAmount = amount;
    return AbcHopeAgentMonthlyGifts.manage(
      new List<AbcHopeAgentMonthlyGifts.Request>{ req }
    )[0];
  }

  @IsTest
  static void campaignInfoDescribesCampaignAndDonateLink() {
    Test.startTest();
    AbcHopeAgentCampaignInfo.Result r = AbcHopeAgentCampaignInfo.getInfo(
      new List<AbcHopeAgentCampaignInfo.Request>{
        new AbcHopeAgentCampaignInfo.Request()
      }
    )[0];
    Test.stopTest();
    Assert.isTrue(r.summary.contains(CAMPAIGN));
    Assert.isTrue(r.summary.contains('School Supplies'));
    Assert.isTrue(r.summary.contains('no payment is collected'));
    Assert.isTrue(r.donateUrl.endsWith('/donate'));
  }

  @IsTest
  static void campaignInfoUnknownCampaign() {
    AbcHopeAgentCampaignInfo.Request req = new AbcHopeAgentCampaignInfo.Request();
    req.campaignName = 'Summer Fun Run';
    AbcHopeAgentCampaignInfo.Result r = AbcHopeAgentCampaignInfo.getInfo(
      new List<AbcHopeAgentCampaignInfo.Request>{ req }
    )[0];
    Assert.isTrue(r.summary.contains('no campaign'));
  }

  @IsTest
  static void unverifiedSessionsGetNoPersonalData() {
    // A real-looking but non-existent session id, a malformed id and a non-session id all resolve to nobody.
    for (
      String sessionId : new List<String>{
        '0Mwg7000000AAAAAAA',
        'not-an-id',
        UserInfo.getUserId(),
        null
      }
    ) {
      Assert.isNull(
        AbcHopeAgentSupport.verifiedAccountId(sessionId),
        'session ' + sessionId
      );
    }
    AbcHopeAgentGivingSummary.Request gReq = new AbcHopeAgentGivingSummary.Request();
    gReq.messagingSessionId = 'not-an-id';
    AbcHopeAgentGivingSummary.Result g = AbcHopeAgentGivingSummary.getSummary(
      new List<AbcHopeAgentGivingSummary.Request>{ gReq }
    )[0];
    Assert.isFalse(g.isVerified);
    Assert.isTrue(g.summary.contains('not signed in'));

    AbcHopeAgentMonthlyGifts.Result m = monthly('list', null, null);
    Assert.isFalse(m.success);
    Assert.isNull(m.monthlyGifts);

    AbcHopeAgentUpdateProfile.Request pReq = new AbcHopeAgentUpdateProfile.Request();
    pReq.messagingSessionId = 'not-an-id';
    pReq.email = 'attacker@example.com';
    AbcHopeAgentUpdateProfile.Result p = AbcHopeAgentUpdateProfile.updateDetails(
      new List<AbcHopeAgentUpdateProfile.Request>{ pReq }
    )[0];
    Assert.isFalse(p.success);
    Assert.areEqual(
      0,
      [SELECT COUNT() FROM Account WHERE PersonEmail = 'attacker@example.com']
    );
  }

  @IsTest
  static void givingSummaryForVerifiedDonor() {
    Id accountId = createDonorWithMonthlyGift('summary@example.com', 500);
    AbcHopeAgentSupport.accountIdOverride = accountId;
    AbcHopeAgentGivingSummary.Request req = new AbcHopeAgentGivingSummary.Request();
    req.messagingSessionId = 'session';
    Test.startTest();
    AbcHopeAgentGivingSummary.Result r = AbcHopeAgentGivingSummary.getSummary(
      new List<AbcHopeAgentGivingSummary.Request>{ req }
    )[0];
    Test.stopTest();
    Assert.isTrue(r.isVerified);
    Assert.areEqual('Maya', r.donorFirstName);
    Assert.isTrue(r.summary.contains('Active monthly gifts: 1'));
    Assert.isTrue(r.summary.contains('School Supplies'));
  }

  @IsTest
  static void listMonthlyGifts() {
    AbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
      'list@example.com',
      500
    );
    Test.startTest();
    AbcHopeAgentMonthlyGifts.Result r = monthly('list', null, null);
    Test.stopTest();
    Assert.isTrue(r.success);
    Assert.isTrue(
      r.monthlyGifts.contains('THB 500 per month to School Supplies'),
      r.monthlyGifts
    );
  }

  @IsTest
  static void monthlyGiftInputValidation() {
    AbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
      'validate@example.com',
      500
    );
    Test.startTest();
    Assert.isTrue(
      monthly('pause', null, null).message.contains('how many months')
    );
    Assert.isTrue(
      monthly('pause', 24, null).message.contains('how many months')
    );
    Assert.isTrue(
      monthly('change_amount', null, 5).message.contains('between THB 100')
    );
    Assert.isTrue(monthly('resume', null, null).message.contains('not paused'));
    Assert.isTrue(
      monthly('delete_everything', null, null)
        .message.contains('Unknown operation')
    );
    Test.stopTest();
  }

  @IsTest
  static void pauseThenResume() {
    AbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
      'pause@example.com',
      500
    );
    Test.startTest();
    AbcHopeAgentMonthlyGifts.Result paused = monthly('pause', 2, null);
    Test.stopTest();
    Assert.isTrue(paused.success, paused.message);
    Assert.isTrue(paused.monthlyGifts.contains('paused'), paused.monthlyGifts);
    AbcHopeAgentMonthlyGifts.Result resumed = monthly('resume', null, null);
    Assert.isTrue(resumed.success, resumed.message);
    Assert.isFalse(
      resumed.monthlyGifts.contains('paused'),
      resumed.monthlyGifts
    );
  }

  @IsTest
  static void changeAmount() {
    AbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
      'change@example.com',
      500
    );
    Test.startTest();
    AbcHopeAgentMonthlyGifts.Result r = monthly('change_amount', null, 750);
    Test.stopTest();
    Assert.isTrue(r.success, r.message);
    Assert.isTrue(r.monthlyGifts.contains('THB 750 per month'), r.monthlyGifts);
  }

  @IsTest
  static void cancelMonthlyGift() {
    Id accountId = createDonorWithMonthlyGift('cancel@example.com', 500);
    AbcHopeAgentSupport.accountIdOverride = accountId;
    Test.startTest();
    AbcHopeAgentMonthlyGifts.Result r = monthly('cancel', null, null);
    Test.stopTest();
    Assert.isTrue(r.success, r.message);
    Assert.areEqual(
      'Closed',
      [SELECT Status FROM GiftCommitment WHERE DonorId = :accountId].Status
    );
  }

  @IsTest
  static void updateProfileChangesOnlyProvidedFields() {
    Id accountId = createDonorWithMonthlyGift('profile@example.com', 500);
    AbcHopeAgentSupport.accountIdOverride = accountId;
    AbcHopeAgentUpdateProfile.Request req = new AbcHopeAgentUpdateProfile.Request();
    req.messagingSessionId = 'session';
    req.phone = '+66 81 234 5678';
    req.city = 'Bangkok';
    Test.startTest();
    AbcHopeAgentUpdateProfile.Result r = AbcHopeAgentUpdateProfile.updateDetails(
      new List<AbcHopeAgentUpdateProfile.Request>{ req }
    )[0];
    req.phone = null;
    req.city = null;
    req.email = 'bad@';
    AbcHopeAgentUpdateProfile.Result bad = AbcHopeAgentUpdateProfile.updateDetails(
      new List<AbcHopeAgentUpdateProfile.Request>{ req }
    )[0];
    req.email = null;
    AbcHopeAgentUpdateProfile.Result nothing = AbcHopeAgentUpdateProfile.updateDetails(
      new List<AbcHopeAgentUpdateProfile.Request>{ req }
    )[0];
    Test.stopTest();
    Assert.isTrue(r.success, r.message);
    Account acc = [
      SELECT PersonMobilePhone, PersonMailingCity, PersonEmail
      FROM Account
      WHERE Id = :accountId
    ];
    Assert.areEqual('+66 81 234 5678', acc.PersonMobilePhone);
    Assert.areEqual('Bangkok', acc.PersonMailingCity);
    Assert.areEqual('profile@example.com', acc.PersonEmail, 'email untouched');
    Assert.isFalse(bad.success);
    Assert.isFalse(nothing.success);
  }
}
