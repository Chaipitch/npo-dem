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

  /** Fundraising campaigns carry a default designation (D-18); returns the campaign Id. */
  static Id fundraisingCampaign(
    String name,
    Date endDate,
    String designationName
  ) {
    List<Campaign> camps = [SELECT Id FROM Campaign WHERE Name = :name];
    Campaign camp = camps.isEmpty()
      ? new Campaign(Name = name, IsActive = true)
      : camps[0];
    camp.EndDate = endDate;
    camp.ExpectedRevenue = 50000;
    upsert camp;
    List<GiftDesignation> gds = [
      SELECT Id
      FROM GiftDesignation
      WHERE Name = :designationName
    ];
    GiftDesignation gd = gds.isEmpty()
      ? new GiftDesignation(Name = designationName, IsActive = true)
      : gds[0];
    upsert gd;
    insert new GiftDefaultDesignation(
      ParentRecordId = camp.Id,
      GiftDesignationId = gd.Id,
      AllocatedPercentage = 100
    );
    return camp.Id;
  }

  static AbcHopeAgentCampaignInfo.Result campaignInfo(String name) {
    AbcHopeAgentCampaignInfo.Request req = new AbcHopeAgentCampaignInfo.Request();
    req.campaignName = name;
    return AbcHopeAgentCampaignInfo.getInfo(
      new List<AbcHopeAgentCampaignInfo.Request>{ req }
    )[0];
  }

  @IsTest
  static void campaignInfoListsEveryOpenCampaign() {
    fundraisingCampaign(CAMPAIGN, Date.today().addDays(30), 'School Supplies');
    fundraisingCampaign(
      'Test Spring Appeal',
      Date.today().addDays(10),
      'Test Meals'
    );
    fundraisingCampaign(
      'Test Ended Appeal',
      Date.today().addDays(-1),
      'Test Meals'
    );
    insert new Campaign(Name = 'Test Internal Campaign', IsActive = true);

    Test.startTest();
    AbcHopeAgentCampaignInfo.Result r = campaignInfo(null);
    Test.stopTest();

    Assert.isTrue(r.summary.contains('2 campaigns open'), r.summary);
    Assert.isTrue(r.summary.contains(CAMPAIGN), r.summary);
    Assert.isTrue(r.summary.contains('Test Spring Appeal'), r.summary);
    Assert.isTrue(r.summary.contains('of a THB 50,000 goal'), r.summary);
    Assert.isTrue(
      r.summary.contains('/donate?campaign=Test%20Spring%20Appeal'),
      r.summary
    );
    Assert.isFalse(
      r.summary.contains('Test Ended Appeal'),
      'ended campaigns are not open'
    );
    Assert.isFalse(
      r.summary.contains('Test Internal Campaign'),
      'non-fundraising campaigns stay hidden'
    );
    Assert.isTrue(r.summary.contains('no payment is collected'));
    Assert.isTrue(r.donateUrl.endsWith('/donate'));
  }

  @IsTest
  static void campaignInfoDescribesCampaignByPartialName() {
    fundraisingCampaign(CAMPAIGN, Date.today().addDays(30), 'School Supplies');

    Test.startTest();
    AbcHopeAgentCampaignInfo.Result r = campaignInfo('christmas');
    Test.stopTest();

    Assert.isTrue(
      r.summary.contains('Campaign: ' + CAMPAIGN + '\n'),
      r.summary
    );
    Assert.isTrue(
      r.summary.contains('School Supplies — Notebooks and pencils.'),
      r.summary
    );
    Assert.isTrue(r.summary.contains('Progress: Raised THB 0'), r.summary);
    Assert.isTrue(r.summary.contains('no payment is collected'));
    Assert.isTrue(
      r.donateUrl.endsWith('/donate?campaign=Christmas%20Giving%202026'),
      r.donateUrl
    );
  }

  @IsTest
  static void campaignInfoNamesTheProgramsACampaignFunds() {
    Program edu = new Program(
      Name = 'Test Education Access',
      Status = 'Active'
    );
    insert edu;
    update new GiftDesignation(
      Id = [SELECT Id FROM GiftDesignation WHERE Name = 'School Supplies']
      .Id,
      NGOTV_Program__c = edu.Id
    );
    fundraisingCampaign(CAMPAIGN, Date.today().addDays(30), 'School Supplies');

    Test.startTest();
    AbcHopeAgentCampaignInfo.Result listed = campaignInfo('');
    AbcHopeAgentCampaignInfo.Result described = campaignInfo(CAMPAIGN);
    Test.stopTest();

    Assert.isTrue(
      listed.summary.contains('Funds: Test Education Access. Raised'),
      listed.summary
    );
    Assert.isTrue(
      described.summary.contains('Programs funded: Test Education Access\n'),
      described.summary
    );
    Assert.isTrue(
      described.summary.contains(
        'School Supplies (Test Education Access program) — Notebooks and pencils.'
      ),
      described.summary
    );
  }

  @IsTest
  static void campaignInfoUsesEachCampaignsOwnCauses() {
    insert new GiftDesignation(
      Name = DonationIntakeService.GENERAL_DESIGNATION,
      IsActive = true
    );
    fundraisingCampaign(
      'Test Spring Appeal',
      Date.today().addDays(10),
      'Test Meals'
    );

    AbcHopeAgentCampaignInfo.Result r = campaignInfo('Test Spring Appeal');

    Assert.isTrue(
      r.summary.contains(
        'Causes donors can choose: Test Meals; Where Most Needed'
      ),
      r.summary
    );
    Assert.isFalse(r.summary.contains('School Supplies'), r.summary);
  }

  @IsTest
  static void campaignInfoFlagsClosedCampaign() {
    fundraisingCampaign(
      'Test Ended Appeal',
      Date.today().addDays(-1),
      'Test Meals'
    );

    AbcHopeAgentCampaignInfo.Result r = campaignInfo('Test Ended Appeal');

    Assert.isTrue(
      r.summary.contains('(not currently accepting gifts)'),
      r.summary
    );
    Assert.isFalse(r.summary.contains('Progress:'), r.summary);
    Assert.isTrue(
      r.donateUrl.endsWith('/donate'),
      'no donate link for a closed campaign'
    );
  }

  @IsTest
  static void campaignInfoUnknownCampaign() {
    fundraisingCampaign(CAMPAIGN, Date.today().addDays(30), 'School Supplies');
    insert new Campaign(Name = 'Test Internal Campaign', IsActive = true);

    AbcHopeAgentCampaignInfo.Result unknown = campaignInfo('Summer Fun Run');
    AbcHopeAgentCampaignInfo.Result internal = campaignInfo(
      'Test Internal Campaign'
    );

    Assert.isTrue(unknown.summary.contains('no campaign'), unknown.summary);
    Assert.isTrue(
      unknown.summary.contains('Campaigns open for donations: ' + CAMPAIGN),
      unknown.summary
    );
    Assert.isTrue(
      internal.summary.contains('no campaign'),
      'non-fundraising campaigns are not described'
    );
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
    Assert.isTrue(r.summary.contains('Active recurring gifts: 1 (Monthly)'));
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
      r.monthlyGifts.contains(
        'Recurring (Monthly): THB 500 per month to School Supplies'
      ),
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

  @IsTest
  static void dashboardAccountIdIsOnlyTrustedForActivePortalDonors() {
    Account noPortalUser = new Account(Name = 'No Portal User Org');
    insert noPortalUser;
    Assert.isNull(AbcHopeAgentSupport.verifiedAccountId(null, null));
    Assert.isNull(AbcHopeAgentSupport.verifiedAccountId('', 'not-an-id'));
    Assert.isNull(
      AbcHopeAgentSupport.verifiedAccountId(null, UserInfo.getUserId()),
      'only Account Ids are accepted'
    );
    Assert.isNull(
      AbcHopeAgentSupport.verifiedAccountId(null, noPortalUser.Id),
      'an account without an active portal user is not a verified donor'
    );
    Assert.isNull(
      AbcHopeAgentSupport.verifiedAccountId('not-a-session', noPortalUser.Id),
      'a messaging session, when present, decides on its own'
    );
  }

  @IsTest
  static void givingSummaryWithoutAnyIdentityAsksToSignIn() {
    AbcHopeAgentGivingSummary.Request req = new AbcHopeAgentGivingSummary.Request();
    req.verifiedAccountId = '001000000000000AAA';
    AbcHopeAgentGivingSummary.Result r = AbcHopeAgentGivingSummary.getSummary(
      new List<AbcHopeAgentGivingSummary.Request>{ req }
    )[0];
    Assert.isFalse(r.isVerified);
  }
}
