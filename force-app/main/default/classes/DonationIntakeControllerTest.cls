@IsTest
private class DonationIntakeControllerTest {
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
  static void getOptionsReturnsDesignations() {
    DonationIntakeService.Options opts = DonationIntakeController.getOptions(
      CAMPAIGN,
      null
    );
    Assert.areEqual(1, opts.designations.size());
    Assert.areEqual(opts.designations[0].value, opts.defaultDesignationId);
  }

  @IsTest
  static void getOptionsUnknownCampaignThrowsFriendlyError() {
    try {
      DonationIntakeController.getOptions('Nope', null);
      Assert.fail('expected error');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('not accepting donations'));
    }
  }

  @IsTest
  static void submitDonationCreatesGift() {
    Test.startTest();
    DonationIntakeService.Result res = DonationIntakeController.submitDonation(
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
      DonationIntakeService.Result res = DonationIntakeController.submitDonation(
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
        DonationIntakeController.submitDonation(body);
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
      DonationIntakeController.submitDonation(JSON.serialize(req));
      Assert.fail('expected error');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('between 100'));
    }
  }

  @IsTest
  static void getCampaignDetailReturnsNullForUnknownCampaign() {
    Assert.isNull(
      DonationIntakeController.getCampaignDetail('No Such Campaign')
    );
  }
}
