@IsTest
private class TSAbcHopeDonationIntakeControllerTest {
  static final String CAMPAIGN = 'Test Christmas Giving';

  @TestSetup
  static void setup() {
    insert new Campaign(
      Name = CAMPAIGN,
      IsActive = true,
      Status = 'In Progress'
    );
    insert new GiftDesignation(Name = 'Test School Supplies', IsActive = true);
  }

  static String requestJson(String email) {
    Map<String, Object> req = new Map<String, Object>{
      'campaignName' => CAMPAIGN,
      'frequency' => 'One-time',
      'amount' => 300,
      'designationId' => [
        SELECT Id
        FROM GiftDesignation
        WHERE Name = 'Test School Supplies'
      ]
      .Id,
      'donorType' => 'Individual',
      'firstName' => 'Guest',
      'lastName' => 'Donor',
      'email' => email
    };
    return JSON.serialize(req);
  }

  static User siteGuestUser() {
    List<User> guests = [
      SELECT Id
      FROM User
      WHERE
        UserType = 'Guest'
        AND IsActive = TRUE
        AND Profile.Name = 'ABC Hope Profile'
      LIMIT 1
    ];
    return guests.isEmpty() ? null : guests[0];
  }

  @IsTest
  static void getImpactAddsUpActivePrograms() {
    insert new List<Program>{
      new Program(
        Name = 'Test Impact A',
        Status = 'Active',
        People_Reached__c = 100,
        Communities__c = 3,
        Volunteers_Engaged__c = 7
      ),
      new Program(
        Name = 'Test Impact B',
        Status = 'Active',
        People_Reached__c = 50,
        Communities__c = 2
      ),
      new Program(
        Name = 'Test Impact Closed',
        Status = 'Completed',
        People_Reached__c = 999
      )
    };
    TSAbcHopeDonationIntakeService.Impact i = TSAbcHopeDonationIntakeController.getImpact();
    Assert.areEqual(2, i.programs);
    Assert.areEqual(150, i.peopleReached);
    Assert.areEqual(5, i.communities);
    Assert.areEqual(7, i.volunteers, 'a blank field counts as 0');
  }

  @IsTest
  static void getOptionsReturnsDesignations() {
    TSAbcHopeDonationIntakeService.Options opts = TSAbcHopeDonationIntakeController.getOptions(
      CAMPAIGN,
      null
    );
    Assert.areEqual(1, opts.designations.size());
    Assert.areEqual(opts.designations[0].value, opts.defaultDesignationId);
  }

  @IsTest
  static void getOptionsUnknownCampaignThrowsFriendlyError() {
    try {
      TSAbcHopeDonationIntakeController.getOptions('Nope', null);
      Assert.fail('expected error');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('not accepting donations'));
    }
  }

  @IsTest
  static void submitDonationCreatesGift() {
    Test.startTest();
    TSAbcHopeDonationIntakeService.Result res = TSAbcHopeDonationIntakeController.submitDonation(
      requestJson('guest.donor@example.com')
    );
    Test.stopTest();
    Assert.areEqual(300, res.amount);
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM GiftTransaction
        WHERE Donor.PersonEmail = 'guest.donor@example.com'
      ]
    );
  }

  @IsTest
  static void submitDonationAsSiteGuestUser() {
    User guest = siteGuestUser();
    if (guest == null) {
      return; // site not present in this org
    }
    String body = requestJson('real.guest@example.com');
    Test.startTest();
    System.runAs(guest) {
      TSAbcHopeDonationIntakeService.Result res = TSAbcHopeDonationIntakeController.submitDonation(
        body
      );
      Assert.isNotNull(res.reference);
    }
    Test.stopTest();
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM GiftTransaction
        WHERE Donor.PersonEmail = 'real.guest@example.com'
      ]
    );
  }

  @IsTest
  static void malformedJsonIsRejected() {
    for (
      String body : new List<String>{
        'not json',
        '{"unexpected":"field"}',
        '{"designationId":"bad-id"}'
      }
    ) {
      try {
        TSAbcHopeDonationIntakeController.submitDonation(body);
        Assert.fail('expected error for ' + body);
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }
    }
  }

  @IsTest
  static void validationErrorsSurfaceMessage() {
    Map<String, Object> req = (Map<String, Object>) JSON.deserializeUntyped(
      requestJson('x@example.com')
    );
    req.put('amount', 5);
    try {
      TSAbcHopeDonationIntakeController.submitDonation(JSON.serialize(req));
      Assert.fail('expected error');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('between 100'));
    }
  }

  @IsTest
  static void getCampaignDetailReturnsNullForUnknownCampaign() {
    Assert.isNull(
      TSAbcHopeDonationIntakeController.getCampaignDetail('No Such Campaign')
    );
  }
}
