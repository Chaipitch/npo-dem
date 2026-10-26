@IsTest
private class AbcHopeAgentSupportTest {
  static final String PORTAL_PROFILE = 'Customer Community Login User';

  /** A donor Person Account with an active portal user, like Maya. */
  static Id donorWithPortalUser(Boolean active) {
    Account donor = new Account(
      FirstName = 'Portal',
      LastName = 'Donor',
      PersonEmail = 'portal.donor@example.com',
      RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
        .get('NGO_Fundraising_Supporter')
        .getRecordTypeId()
    );
    insert donor;
    Id contactId = [SELECT PersonContactId FROM Account WHERE Id = :donor.Id]
    .PersonContactId;
    User admin = new User(Id = UserInfo.getUserId());
    System.runAs(admin) {
      insert new User(
        ProfileId = [SELECT Id FROM Profile WHERE Name = :PORTAL_PROFILE]
        .Id,
        ContactId = contactId,
        Username = 'portal.donor.' + Datetime.now().getTime() + '@example.com',
        Email = 'portal.donor@example.com',
        LastName = 'Donor',
        Alias = 'pdonor',
        TimeZoneSidKey = 'Asia/Bangkok',
        LocaleSidKey = 'en_US',
        EmailEncodingKey = 'UTF-8',
        LanguageLocaleKey = 'en_US',
        IsActive = active
      );
    }
    return donor.Id;
  }

  @IsTest
  static void dashboardAccountIsTrustedOnlyWithAnActivePortalUser() {
    Id withUser = donorWithPortalUser(true);
    Account noUser = new Account(Name = 'No Portal User Org');
    insert noUser;

    Assert.areEqual(
      withUser,
      AbcHopeAgentSupport.verifiedAccountId(null, String.valueOf(withUser))
    );
    Assert.isNull(
      AbcHopeAgentSupport.verifiedAccountId(null, String.valueOf(noUser.Id)),
      'an account without a portal user is not a verified donor'
    );
  }

  @IsTest
  static void badOrForeignIdsAreRejected() {
    Assert.isNull(AbcHopeAgentSupport.verifiedAccountId(null, null));
    Assert.isNull(AbcHopeAgentSupport.verifiedAccountId('', ''));
    Assert.isNull(AbcHopeAgentSupport.verifiedAccountId(null, 'not-an-id'));
    Assert.isNull(
      AbcHopeAgentSupport.verifiedAccountId(null, UserInfo.getUserId()),
      'a User Id is not an Account Id'
    );
    Assert.isNull(AbcHopeAgentSupport.verifiedAccountId('not-an-id'));
    Assert.isNull(
      AbcHopeAgentSupport.verifiedAccountId(UserInfo.getUserId()),
      'a User Id is not a MessagingSession Id'
    );
  }

  @IsTest
  static void messagingSessionWithoutAVerifiedUserGivesNoIdentity() {
    Id donorId = donorWithPortalUser(true);
    Id channelId = [
      SELECT Id
      FROM MessagingChannel
      WHERE DeveloperName = 'ABC_Hope_Chat'
      LIMIT 1
    ]
    .Id;
    MessagingEndUser meu = new MessagingEndUser(
      Name = 'Guest',
      MessagingChannelId = channelId,
      MessageType = 'EmbeddedMessaging',
      MessagingPlatformKey = 'test-key-' + Datetime.now().getTime()
    );
    insert meu;
    MessagingSession ms = new MessagingSession(
      MessagingChannelId = channelId,
      MessagingEndUserId = meu.Id,
      Status = 'Ended'
    );
    insert ms;

    // AuthenticatedEndUserId is set only by Salesforce for verified site users, never by input.
    Assert.isNull(AbcHopeAgentSupport.verifiedAccountId(String.valueOf(ms.Id)));
    // A messaging session wins over a dashboard account: the typed/forged account is ignored.
    Assert.isNull(
      AbcHopeAgentSupport.verifiedAccountId(
        String.valueOf(ms.Id),
        String.valueOf(donorId)
      )
    );
  }

  @IsTest
  static void helpersFormatAndClean() {
    Assert.areEqual('USD 1,250', AbcHopeAgentSupport.money(1249.6));
    Assert.areEqual('USD 0', AbcHopeAgentSupport.money(null));
    Assert.areEqual('Hello', AbcHopeAgentSupport.clean('  <b>Hello</b> ', 20));
    Assert.isNull(AbcHopeAgentSupport.clean(null, 20));
    String url = AbcHopeAgentSupport.siteUrl('/donate');
    Assert.isTrue(url.endsWith('/donate'), url);
  }
}
