@IsTest
private class TSAbcHopeAgentActionsTest {
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
    TSAbcHopeDonationIntakeDto.Request req = new TSAbcHopeDonationIntakeDto.Request();
    req.campaignName = CAMPAIGN;
    req.frequency = TSAbcHopeDonationIntakeService.FREQ_MONTHLY;
    req.amount = amount;
    req.designationId = [
      SELECT Id
      FROM GiftDesignation
      WHERE Name = 'School Supplies'
    ]
    .Id;
    req.donorType = TSAbcHopeDonationIntakeService.TYPE_INDIVIDUAL;
    req.firstName = 'Maya';
    req.lastName = 'Agent';
    req.email = email;
    TSAbcHopeDonationIntakeService.submit(req);
    return [SELECT Id FROM Account WHERE PersonEmail = :email].Id;
  }

  static TSAbcHopeAgentMonthlyGifts.Result monthly(
    String op,
    Integer months,
    Decimal amount
  ) {
    TSAbcHopeAgentMonthlyGifts.Request req = new TSAbcHopeAgentMonthlyGifts.Request();
    req.messagingSessionId = 'session';
    req.operation = op;
    req.pauseMonths = months;
    req.newAmount = amount;
    return TSAbcHopeAgentMonthlyGifts.manage(
      new List<TSAbcHopeAgentMonthlyGifts.Request>{ req }
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

  static TSAbcHopeAgentCampaignInfo.Result campaignInfo(String name) {
    TSAbcHopeAgentCampaignInfo.Request req = new TSAbcHopeAgentCampaignInfo.Request();
    req.campaignName = name;
    return TSAbcHopeAgentCampaignInfo.getInfo(
      new List<TSAbcHopeAgentCampaignInfo.Request>{ req }
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
    TSAbcHopeAgentCampaignInfo.Result r = campaignInfo(null);
    Test.stopTest();

    Assert.isTrue(r.summary.contains('2 campaigns open'), r.summary);
    Assert.isTrue(r.summary.contains(CAMPAIGN), r.summary);
    Assert.isTrue(r.summary.contains('Test Spring Appeal'), r.summary);
    Assert.isTrue(r.summary.contains('of a USD 50,000 goal'), r.summary);
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
    TSAbcHopeAgentCampaignInfo.Result r = campaignInfo('christmas');
    Test.stopTest();

    Assert.isTrue(
      r.summary.contains('Campaign: ' + CAMPAIGN + '\n'),
      r.summary
    );
    Assert.isTrue(
      r.summary.contains('School Supplies — Notebooks and pencils.'),
      r.summary
    );
    Assert.isTrue(r.summary.contains('Progress: Raised USD 0'), r.summary);
    Assert.isTrue(r.summary.contains('no payment is collected'));
    Assert.isTrue(
      r.donateUrl.endsWith('/donate?campaign=Christmas%20Giving%202026'),
      r.donateUrl
    );
  }

  @IsTest
  static void campaignInfoAsksWhichCampaignForALooseName() {
    fundraisingCampaign(CAMPAIGN, Date.today().addDays(30), 'School Supplies');
    fundraisingCampaign(
      'Christmas Toy Drive 2026',
      Date.today().addDays(30),
      'Toys'
    );
    fundraisingCampaign(
      'Test Spring Appeal',
      Date.today().addDays(30),
      'Trees'
    );

    Test.startTest();
    TSAbcHopeAgentCampaignInfo.Result loose = campaignInfo('Christmas Gift');
    TSAbcHopeAgentCampaignInfo.Result toys = campaignInfo('toy drive');
    Test.stopTest();

    Assert.isTrue(
      loose.summary.startsWith('Several open campaigns match "Christmas Gift"'),
      loose.summary
    );
    Assert.isTrue(
      loose.summary.contains('/donate?campaign=Christmas%20Giving%202026'),
      loose.summary
    );
    Assert.isTrue(
      loose.summary.contains('/donate?campaign=Christmas%20Toy%20Drive%202026'),
      loose.summary
    );
    Assert.isFalse(loose.summary.contains('Spring'), loose.summary);
    Assert.isTrue(
      toys.donateUrl.endsWith(
        '/donate?campaign=Christmas%20Toy%20Drive%202026'
      ),
      toys.donateUrl
    );
    Assert.isTrue(
      toys.summary.contains('Campaign: Christmas Toy Drive 2026'),
      toys.summary
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
    TSAbcHopeAgentCampaignInfo.Result listed = campaignInfo('');
    TSAbcHopeAgentCampaignInfo.Result described = campaignInfo(CAMPAIGN);
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
      Name = TSAbcHopeDonationIntakeService.GENERAL_DESIGNATION,
      IsActive = true
    );
    fundraisingCampaign(
      'Test Spring Appeal',
      Date.today().addDays(10),
      'Test Meals'
    );
    GiftDesignation blankets = new GiftDesignation(
      Name = 'Test Blankets',
      IsActive = true
    );
    insert blankets;
    insert new GiftDefaultDesignation(
      ParentRecordId = [
        SELECT Id
        FROM Campaign
        WHERE Name = 'Test Spring Appeal'
      ]
      .Id,
      GiftDesignationId = blankets.Id,
      AllocatedPercentage = 0
    );
    fundraisingCampaign(
      'Test Single Cause',
      Date.today().addDays(10),
      'Test Wells'
    );

    TSAbcHopeAgentCampaignInfo.Result r = campaignInfo('Test Spring Appeal');
    TSAbcHopeAgentCampaignInfo.Result single = campaignInfo(
      'Test Single Cause'
    );

    Assert.isTrue(r.summary.contains('Test Meals'), r.summary);
    Assert.isTrue(r.summary.contains('Test Blankets'), r.summary);
    Assert.isTrue(r.summary.contains('; Where Most Needed\n'), r.summary);
    Assert.isFalse(r.summary.contains('School Supplies'), r.summary);
    Assert.isTrue(
      single.summary.contains('Causes donors can choose: Test Wells\n'),
      'one cause: no Where Most Needed (D-52) ' + single.summary
    );
  }

  @IsTest
  static void campaignInfoFlagsClosedCampaign() {
    fundraisingCampaign(
      'Test Ended Appeal',
      Date.today().addDays(-1),
      'Test Meals'
    );

    TSAbcHopeAgentCampaignInfo.Result r = campaignInfo('Test Ended Appeal');

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

    TSAbcHopeAgentCampaignInfo.Result unknown = campaignInfo('Summer Fun Run');
    TSAbcHopeAgentCampaignInfo.Result internal = campaignInfo(
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
        TSAbcHopeAgentSupport.verifiedAccountId(sessionId),
        'session ' + sessionId
      );
    }
    TSAbcHopeAgentGivingSummary.Request gReq = new TSAbcHopeAgentGivingSummary.Request();
    gReq.messagingSessionId = 'not-an-id';
    TSAbcHopeAgentGivingSummary.Result g = TSAbcHopeAgentGivingSummary.getSummary(
      new List<TSAbcHopeAgentGivingSummary.Request>{ gReq }
    )[0];
    Assert.isFalse(g.isVerified);
    Assert.isTrue(g.summary.contains('not signed in'));

    TSAbcHopeAgentMonthlyGifts.Result m = monthly('list', null, null);
    Assert.isFalse(m.success);
    Assert.isNull(m.monthlyGifts);

    TSAbcHopeAgentUpdateProfile.Request pReq = new TSAbcHopeAgentUpdateProfile.Request();
    pReq.messagingSessionId = 'not-an-id';
    pReq.email = 'attacker@example.com';
    TSAbcHopeAgentUpdateProfile.Result p = TSAbcHopeAgentUpdateProfile.updateDetails(
      new List<TSAbcHopeAgentUpdateProfile.Request>{ pReq }
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
    TSAbcHopeAgentSupport.accountIdOverride = accountId;
    TSAbcHopeAgentGivingSummary.Request req = new TSAbcHopeAgentGivingSummary.Request();
    req.messagingSessionId = 'session';
    Test.startTest();
    TSAbcHopeAgentGivingSummary.Result r = TSAbcHopeAgentGivingSummary.getSummary(
      new List<TSAbcHopeAgentGivingSummary.Request>{ req }
    )[0];
    Test.stopTest();
    Assert.isTrue(r.isVerified);
    Assert.areEqual('Maya', r.donorFirstName);
    Assert.isTrue(r.summary.contains('Active recurring gifts: 1 (Monthly)'));
    Assert.isTrue(r.summary.contains('School Supplies'));
    Assert.isTrue(
      r.summary.contains(
        'Programs funded (what the causes pay for, not the causes themselves): none recorded. Some of the donor\'s causes are not linked to a program.'
      ),
      r.summary
    );
  }

  @IsTest
  static void givingSummaryNamesProgramsNotCauses() {
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
    Id accountId = createDonorWithMonthlyGift('programs@example.com', 500);
    Test.startTest();
    String line = TSAbcHopeAgentGivingSummary.programsLine(
      accountId,
      TSAbcHopeDonorPortalService.buildDashboard(
        TSAbcHopeDonorPortalService.loadAccount(accountId)
      )
    );
    Test.stopTest();
    Assert.areEqual(
      'Programs funded (what the causes pay for, not the causes themselves): Test Education Access',
      line
    );
  }

  @IsTest
  static void listMonthlyGifts() {
    TSAbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
      'list@example.com',
      500
    );
    Test.startTest();
    TSAbcHopeAgentMonthlyGifts.Result r = monthly('list', null, null);
    Test.stopTest();
    Assert.isTrue(r.success);
    Assert.isTrue(
      r.monthlyGifts.contains(
        'Recurring (Monthly): USD 500 per month to School Supplies'
      ),
      r.monthlyGifts
    );
  }

  @IsTest
  static void monthlyGiftInputValidation() {
    TSAbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
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
      monthly('change_amount', null, 5).message.contains('between USD 100')
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
    TSAbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
      'pause@example.com',
      500
    );
    Test.startTest();
    TSAbcHopeAgentMonthlyGifts.Result paused = monthly('pause', 2, null);
    Test.stopTest();
    Assert.isTrue(paused.success, paused.message);
    Assert.isTrue(paused.monthlyGifts.contains('paused'), paused.monthlyGifts);
    TSAbcHopeAgentMonthlyGifts.Result resumed = monthly('resume', null, null);
    Assert.isTrue(resumed.success, resumed.message);
    Assert.isFalse(
      resumed.monthlyGifts.contains('paused'),
      resumed.monthlyGifts
    );
  }

  @IsTest
  static void changeAmount() {
    TSAbcHopeAgentSupport.accountIdOverride = createDonorWithMonthlyGift(
      'change@example.com',
      500
    );
    Test.startTest();
    TSAbcHopeAgentMonthlyGifts.Result r = monthly('change_amount', null, 750);
    Test.stopTest();
    Assert.isTrue(r.success, r.message);
    Assert.isTrue(r.monthlyGifts.contains('USD 750 per month'), r.monthlyGifts);
  }

  @IsTest
  static void cancelMonthlyGift() {
    Id accountId = createDonorWithMonthlyGift('cancel@example.com', 500);
    TSAbcHopeAgentSupport.accountIdOverride = accountId;
    Test.startTest();
    TSAbcHopeAgentMonthlyGifts.Result r = monthly('cancel', null, null);
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
    TSAbcHopeAgentSupport.accountIdOverride = accountId;
    TSAbcHopeAgentUpdateProfile.Request req = new TSAbcHopeAgentUpdateProfile.Request();
    req.messagingSessionId = 'session';
    req.phone = '+66 81 234 5678';
    req.city = 'Bangkok';
    Test.startTest();
    TSAbcHopeAgentUpdateProfile.Result r = TSAbcHopeAgentUpdateProfile.updateDetails(
      new List<TSAbcHopeAgentUpdateProfile.Request>{ req }
    )[0];
    req.phone = null;
    req.city = null;
    req.email = 'bad@';
    TSAbcHopeAgentUpdateProfile.Result bad = TSAbcHopeAgentUpdateProfile.updateDetails(
      new List<TSAbcHopeAgentUpdateProfile.Request>{ req }
    )[0];
    req.email = null;
    TSAbcHopeAgentUpdateProfile.Result nothing = TSAbcHopeAgentUpdateProfile.updateDetails(
      new List<TSAbcHopeAgentUpdateProfile.Request>{ req }
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
    Assert.isNull(TSAbcHopeAgentSupport.verifiedAccountId(null, null));
    Assert.isNull(TSAbcHopeAgentSupport.verifiedAccountId('', 'not-an-id'));
    Assert.isNull(
      TSAbcHopeAgentSupport.verifiedAccountId(null, UserInfo.getUserId()),
      'only Account Ids are accepted'
    );
    Assert.isNull(
      TSAbcHopeAgentSupport.verifiedAccountId(null, noPortalUser.Id),
      'an account without an active portal user is not a verified donor'
    );
    Assert.isNull(
      TSAbcHopeAgentSupport.verifiedAccountId('not-a-session', noPortalUser.Id),
      'a messaging session, when present, decides on its own'
    );
  }

  @IsTest
  static void givingSummaryWithoutAnyIdentityAsksToSignIn() {
    TSAbcHopeAgentGivingSummary.Request req = new TSAbcHopeAgentGivingSummary.Request();
    req.verifiedAccountId = '001000000000000AAA';
    TSAbcHopeAgentGivingSummary.Result r = TSAbcHopeAgentGivingSummary.getSummary(
      new List<TSAbcHopeAgentGivingSummary.Request>{ req }
    )[0];
    Assert.isFalse(r.isVerified);
  }
}
