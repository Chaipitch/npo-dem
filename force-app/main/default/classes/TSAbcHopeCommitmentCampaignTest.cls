@IsTest
private class TSAbcHopeCommitmentCampaignTest {
  @IsTest
  static void schedulesAndInstalmentsWithoutACampaignTakeTheCommitments() {
    Campaign camp = new Campaign(
      Name = 'Test Commitment Campaign',
      IsActive = true
    );
    Campaign other = new Campaign(
      Name = 'Test Other Campaign',
      IsActive = true
    );
    insert new List<Campaign>{ camp, other };
    Account donor = new Account(Name = 'Test Campaign Donor');
    insert donor;
    GiftCommitment gc = new GiftCommitment(
      DonorId = donor.Id,
      CampaignId = camp.Id,
      Status = 'Active',
      ScheduleType = 'Recurring',
      RecurrenceType = 'OpenEnded',
      EffectiveStartDate = Date.today()
    );
    insert gc;

    Test.startTest();
    GiftCommitmentSchedule s = new GiftCommitmentSchedule(
      GiftCommitmentId = gc.Id,
      Type = 'CreateTransactions',
      TransactionAmount = 100,
      TransactionPeriod = 'Monthly',
      TransactionInterval = 1,
      StartDate = Date.today(),
      PaymentMethod = 'Unknown'
    );
    insert s;
    GiftTransaction blank = instalment(gc.Id, donor.Id, null);
    GiftTransaction ownCampaign = instalment(gc.Id, donor.Id, other.Id);
    GiftTransaction oneTime = new GiftTransaction(
      Name = 'x',
      DonorId = donor.Id,
      OriginalAmount = 50,
      TransactionDate = Date.today(),
      Status = 'Pending',
      PaymentMethod = 'Unknown'
    );
    insert new List<GiftTransaction>{ blank, ownCampaign, oneTime };
    Test.stopTest();

    Assert.areEqual(
      camp.Id,
      [SELECT CampaignId FROM GiftCommitmentSchedule WHERE Id = :s.Id]
      .CampaignId
    );
    Map<Id, GiftTransaction> saved = new Map<Id, GiftTransaction>(
      [
        SELECT Id, Name, CampaignId
        FROM GiftTransaction
        WHERE Id IN :new List<Id>{ blank.Id, ownCampaign.Id, oneTime.Id }
      ]
    );
    Assert.areEqual(camp.Id, saved.get(blank.Id).CampaignId);
    Assert.isTrue(
      saved.get(blank.Id).Name.startsWith('Test Commitment Campaign - '),
      'named with the campaign: ' + saved.get(blank.Id).Name
    );
    Assert.areEqual(other.Id, saved.get(ownCampaign.Id).CampaignId, 'kept');
    Assert.isNull(
      saved.get(oneTime.Id).CampaignId,
      'no commitment, left alone'
    );
  }

  static GiftTransaction instalment(
    Id commitmentId,
    Id donorId,
    Id campaignId
  ) {
    return new GiftTransaction(
      Name = 'x',
      DonorId = donorId,
      CampaignId = campaignId,
      GiftCommitmentId = commitmentId,
      OriginalAmount = 100,
      TransactionDate = Date.today().addMonths(1),
      TransactionDueDate = Date.today().addMonths(1),
      Status = 'Unpaid',
      PaymentMethod = 'Unknown'
    );
  }
}
