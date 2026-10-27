@IsTest
private class TSAbcHopeGiftNamingTest {
  static final String CAMPAIGN = 'Test Naming Campaign';

  @TestSetup
  static void setup() {
    insert new Campaign(Name = CAMPAIGN, IsActive = true);
    insert new Account(Name = 'Test Naming Donor');
    insert new List<GiftDesignation>{
      new GiftDesignation(Name = 'Test Toys', IsActive = true),
      new GiftDesignation(Name = 'Test Books', IsActive = true)
    };
  }

  static Id campaignId() {
    return [SELECT Id FROM Campaign WHERE Name = :CAMPAIGN].Id;
  }
  static Id donorId() {
    return [SELECT Id FROM Account WHERE Name = 'Test Naming Donor'].Id;
  }
  static Id causeId(String name) {
    return [SELECT Id FROM GiftDesignation WHERE Name = :name].Id;
  }
  static String nameOf(Id giftId) {
    return [SELECT Name FROM GiftTransaction WHERE Id = :giftId].Name;
  }

  @IsTest
  static void buildShortensPartsKeepsTheTimeAndUsesTheOrgTimeZone() {
    String zone = [SELECT TimeZoneSidKey FROM Organization].TimeZoneSidKey;
    Assert.areEqual(zone, TSAbcHopeGiftNaming.timeZone);
    Datetime created = Datetime.newInstanceGmt(2026, 10, 26, 7, 41, 0);
    String createdDay = created.format('yyyy-MM-dd', zone);
    String stamp = createdDay + ' ' + created.format('HH:mm', zone);
    Assert.areEqual(
      'Toy Drive - Toys - Maya - ' + stamp,
      TSAbcHopeGiftNaming.build(
        'Toy Drive',
        'Toys',
        'Maya',
        Date.valueOf(createdDay),
        created
      )
    );
    // Dated a day off (saved by someone in another time zone): the org-time-zone date is used.
    Assert.areEqual(
      'Toy Drive - Toys - Maya - ' + stamp,
      TSAbcHopeGiftNaming.build(
        'Toy Drive',
        'Toys',
        'Maya',
        Date.valueOf(createdDay).addDays(1),
        created
      )
    );
    // Back-dated history keeps its own date.
    Assert.areEqual(
      'Toy Drive - Toys - Maya - 2023-12-10 ' + created.format('HH:mm', zone),
      TSAbcHopeGiftNaming.build(
        'Toy Drive',
        'Toys',
        'Maya',
        Date.newInstance(2023, 12, 10),
        created
      )
    );
    String longName = TSAbcHopeGiftNaming.build(
      'C'.repeat(80),
      'G'.repeat(80),
      'D'.repeat(255),
      null,
      created
    );
    List<String> parts = longName.split(' - ');
    Assert.areEqual(60, parts[0].length());
    Assert.areEqual(40, parts[1].length());
    Assert.areEqual(60, parts[2].length());
    Assert.areEqual(stamp, parts[3], 'date and time from the time stamp');
    Assert.areEqual(
      'No campaign - No cause - Unknown donor - ' + stamp,
      TSAbcHopeGiftNaming.build(null, ' ', null, null, created)
    );
  }

  @IsTest
  static void giftIsNamedOnInsertAndFollowsItsCause() {
    GiftTransaction gt = new GiftTransaction(
      Name = 'Typed by hand',
      DonorId = donorId(),
      CampaignId = campaignId(),
      OriginalAmount = 300,
      TransactionDate = Date.newInstance(2026, 12, 1),
      Status = 'Pending',
      PaymentMethod = 'Unknown'
    );
    Test.startTest();
    insert gt;
    Assert.isTrue(
      nameOf(gt.Id)
        .startsWith(CAMPAIGN + ' - No cause - Test Naming Donor - 2026-12-01 '),
      nameOf(gt.Id)
    );
    GiftTransactionDesignation gtd = new GiftTransactionDesignation(
      GiftTransactionId = gt.Id,
      GiftDesignationId = causeId('Test Toys'),
      Amount = 300,
      Percent = 100
    );
    insert gtd;
    Assert.isTrue(nameOf(gt.Id).contains(' - Test Toys - '), nameOf(gt.Id));
    gtd.GiftDesignationId = causeId('Test Books');
    update gtd;
    Assert.isTrue(nameOf(gt.Id).contains(' - Test Books - '), nameOf(gt.Id));
    delete gtd;
    Test.stopTest();
    Assert.isTrue(nameOf(gt.Id).contains(' - No cause - '), nameOf(gt.Id));
  }

  @IsTest
  static void commitmentFollowsItsDefaultCauseAndInstalmentsInheritIt() {
    GiftCommitment gc = new GiftCommitment(
      Name = 'Jimmy',
      DonorId = donorId(),
      CampaignId = campaignId(),
      Status = 'Active',
      ScheduleType = 'Recurring',
      RecurrenceType = 'OpenEnded',
      EffectiveStartDate = Date.newInstance(2026, 11, 1)
    );
    Test.startTest();
    insert gc;
    Assert.isTrue(
      [SELECT Name FROM GiftCommitment WHERE Id = :gc.Id]
        .Name.startsWith(
          CAMPAIGN + ' - No cause - Test Naming Donor - 2026-11-01 '
        )
    );
    insert new GiftDefaultDesignation(
      ParentRecordId = gc.Id,
      GiftDesignationId = causeId('Test Books'),
      AllocatedPercentage = 100
    );
    GiftTransaction instalment = new GiftTransaction(
      Name = 'NPC default name',
      DonorId = donorId(),
      CampaignId = campaignId(),
      GiftCommitmentId = gc.Id,
      OriginalAmount = 300,
      TransactionDate = Date.newInstance(2026, 12, 1),
      TransactionDueDate = Date.newInstance(2026, 12, 1),
      Status = 'Unpaid',
      PaymentMethod = 'Unknown'
    );
    insert instalment;
    Test.stopTest();
    Assert.isTrue(
      [SELECT Name FROM GiftCommitment WHERE Id = :gc.Id]
        .Name.contains(' - Test Books - ')
    );
    Assert.isTrue(
      nameOf(instalment.Id)
        .contains(' - Test Books - Test Naming Donor - 2026-12-01 '),
      'instalment takes its commitment\'s cause: ' + nameOf(instalment.Id)
    );
  }

  @IsTest
  static void campaignDefaultDesignationsDoNotTouchGifts() {
    Test.startTest();
    insert new GiftDefaultDesignation(
      ParentRecordId = campaignId(),
      GiftDesignationId = causeId('Test Toys'),
      AllocatedPercentage = 100
    );
    Test.stopTest();
    Assert.areEqual(
      CAMPAIGN,
      [SELECT Name FROM Campaign WHERE Id = :campaignId()].Name
    );
  }
}
