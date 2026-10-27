@IsTest
private class TSAbcHopeCommitmentPauseSyncTest {
  static Date today() {
    return Date.valueOf(
      Datetime.now().format('yyyy-MM-dd', TSAbcHopeGiftNaming.timeZone)
    );
  }

  static GiftCommitmentSchedule schedule(
    Id commitmentId,
    String type,
    String period,
    Date startDate,
    Date endDate
  ) {
    return new GiftCommitmentSchedule(
      GiftCommitmentId = commitmentId,
      Type = type,
      TransactionAmount = 100,
      TransactionPeriod = period,
      TransactionInterval = 1,
      TransactionDay = '1',
      StartDate = startDate,
      EndDate = endDate,
      PaymentMethod = 'Unknown'
    );
  }

  static GiftCommitment commitment(Date startDate) {
    Account donor = new Account(Name = 'Pause Sync Donor');
    insert donor;
    GiftCommitment gc = new GiftCommitment(
      DonorId = donor.Id,
      Status = 'Active',
      ScheduleType = 'Recurring',
      RecurrenceType = 'OpenEnded',
      EffectiveStartDate = startDate
    );
    insert gc;
    return gc;
  }

  static GiftCommitment reload(Id commitmentId) {
    return [
      SELECT Status, NextTransactionDate
      FROM GiftCommitment
      WHERE Id = :commitmentId
    ];
  }

  @IsTest
  static void aPauseStartingTodayMarksTheGiftPausedWithTheFirstGiftAfterIt() {
    Date t = today();
    GiftCommitment gc = commitment(t.addDays(-40));
    insert schedule(
      gc.Id,
      'CreateTransactions',
      'Monthly',
      t.addDays(-40),
      t.addDays(-1)
    );
    Test.startTest();
    // The trigger syncs as the schedules are saved.
    insert new List<GiftCommitmentSchedule>{
      schedule(gc.Id, 'PauseTransactions', 'Monthly', t, t.addDays(30)),
      schedule(gc.Id, 'CreateTransactions', 'Monthly', t.addDays(31), null)
    };
    Test.stopTest();
    GiftCommitment after = reload(gc.Id);
    Assert.areEqual('Paused', after.Status);
    Date resume = t.addDays(31);
    Date expected = resume.day() == 1
      ? resume
      : Date.newInstance(
          resume.addMonths(1).year(),
          resume.addMonths(1).month(),
          1
        );
    Assert.areEqual(
      expected,
      after.NextTransactionDate,
      'day 1 after the pause'
    );
  }

  @IsTest
  static void aPauseThatEndedTurnsTheGiftActiveAgain() {
    Date t = today();
    GiftCommitment gc = commitment(t.addDays(-60));
    GiftCommitmentSchedule pause = schedule(
      gc.Id,
      'PauseTransactions',
      'Weekly',
      t.addDays(-30),
      t.addDays(5)
    );
    GiftCommitmentSchedule restart = schedule(
      gc.Id,
      'CreateTransactions',
      'Weekly',
      t.addDays(6),
      null
    );
    insert new List<GiftCommitmentSchedule>{
      schedule(
        gc.Id,
        'CreateTransactions',
        'Weekly',
        t.addDays(-60),
        t.addDays(-31)
      ),
      pause,
      restart
    };
    Assert.areEqual('Paused', reload(gc.Id).Status, 'pause covers today');

    Test.startTest();
    // The pause is cut short in Salesforce: gifts restart today, the pause ends yesterday.
    pause.EndDate = t.addDays(-1);
    update pause;
    Assert.areEqual(
      'Paused',
      reload(gc.Id).Status,
      'no schedule covers today yet: NPC would refuse Active'
    );
    restart.StartDate = t;
    update restart;
    Test.stopTest();
    GiftCommitment after = reload(gc.Id);
    Assert.areEqual('Active', after.Status);
    Assert.areEqual(
      t,
      after.NextTransactionDate,
      'weekly from the restart date'
    );

    // The daily run finds nothing left to change.
    TSAbcHopeCommitmentPauseSync.syncDue(t);
    Assert.areEqual('Active', reload(gc.Id).Status);
  }

  @IsTest
  static void anUpcomingPauseLeavesTheGiftToNpc() {
    Date t = today();
    GiftCommitment gc = commitment(t.addDays(-10));
    Test.startTest();
    insert new List<GiftCommitmentSchedule>{
      schedule(
        gc.Id,
        'CreateTransactions',
        'Monthly',
        t.addDays(-10),
        t.addDays(9)
      ),
      schedule(
        gc.Id,
        'PauseTransactions',
        'Monthly',
        t.addDays(10),
        t.addDays(40)
      ),
      schedule(gc.Id, 'CreateTransactions', 'Monthly', t.addDays(41), null)
    };
    Test.stopTest();
    Assert.areEqual('Active', reload(gc.Id).Status);
  }

  @IsTest
  static void theDailyJobCanBeScheduledAndRuns() {
    Test.startTest();
    Id jobId = TSAbcHopeCommitmentPauseSync.scheduleDaily();
    new TSAbcHopeCommitmentPauseSync().execute(null);
    Test.stopTest();
    Assert.areEqual(
      '0 15 0 * * ?',
      [SELECT CronExpression FROM CronTrigger WHERE Id = :jobId].CronExpression
    );
  }

  @IsTest
  static void giftDatesFollowEachPeriod() {
    Date start = Date.newInstance(2027, 2, 27); // a Saturday
    GiftCommitmentSchedule monthly = schedule(
      null,
      'CreateTransactions',
      'Monthly',
      start,
      null
    );
    Assert.areEqual(
      Date.newInstance(2027, 3, 1),
      TSAbcHopeCommitmentPauseSync.occurrenceOnOrAfter(monthly, start)
    );
    monthly.TransactionDay = null; // no day set: the schedule start's day
    Assert.areEqual(
      Date.newInstance(2027, 3, 27),
      TSAbcHopeCommitmentPauseSync.occurrenceOnOrAfter(
        monthly,
        Date.newInstance(2027, 3, 2)
      )
    );
    GiftCommitmentSchedule weekly = schedule(
      null,
      'CreateTransactions',
      'Weekly',
      start,
      null
    );
    Assert.areEqual(
      Date.newInstance(2027, 3, 6),
      TSAbcHopeCommitmentPauseSync.occurrenceOnOrAfter(
        weekly,
        Date.newInstance(2027, 3, 1)
      )
    );
    GiftCommitmentSchedule yearly = schedule(
      null,
      'CreateTransactions',
      'Yearly',
      start,
      null
    );
    Assert.areEqual(
      Date.newInstance(2028, 2, 27),
      TSAbcHopeCommitmentPauseSync.occurrenceOnOrAfter(
        yearly,
        Date.newInstance(2027, 3, 1)
      )
    );
    GiftCommitmentSchedule daily = schedule(
      null,
      'CreateTransactions',
      'Daily',
      start,
      null
    );
    Assert.areEqual(
      start,
      TSAbcHopeCommitmentPauseSync.occurrenceOnOrAfter(daily, start)
    );
    Assert.isNull(
      TSAbcHopeCommitmentPauseSync.nextGiftDate(
        new List<GiftCommitmentSchedule>{
          schedule(
            null,
            'CreateTransactions',
            'Monthly',
            start,
            start.addDays(1)
          )
        },
        start.addDays(5)
      ),
      'no schedule left'
    );
  }
}
