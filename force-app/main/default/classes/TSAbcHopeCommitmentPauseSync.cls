/**
 * Keeps a recurring gift's Status and Next Transaction Date in step with its pause schedules (D-40).
 *
 * NPC's pause action only adds a PauseTransactions schedule: the commitment stays Active and nothing marks it
 * Paused when the pause starts or Active again when it runs out (NPC accepts Status = Paused only while a pause
 * schedule covers today). So, for each open commitment:
 *  - a pause covers today  → Status = Paused, Next Transaction Date = the first gift after the pause;
 *  - Paused, no pause today → Status = Active, Next Transaction Date = the next gift from today.
 * Anything else is left to NPC (an upcoming pause already moves the next date past itself).
 *
 * Runs from the trigger on GiftCommitmentSchedule (a pause added, changed or removed) and daily as a scheduled
 * job (pauses start and end with the calendar). "Today" is the org's time zone (TSAbcHopeGiftNaming.timeZone).
 */
public without sharing class TSAbcHopeCommitmentPauseSync implements Schedulable {
  public static final String JOB_NAME = 'TS ABC Hope recurring gift pause sync';
  static final String CRON_DAILY = '0 15 0 * * ?'; // 00:15 every day

  /** Schedules the daily run once per org; returns the job Id (the existing one if already scheduled). */
  public static Id scheduleDaily() {
    for (CronTrigger existing : [
      SELECT Id
      FROM CronTrigger
      WHERE CronJobDetail.Name = :JOB_NAME
      LIMIT 1
    ]) {
      return existing.Id;
    }
    return System.schedule(
      JOB_NAME,
      CRON_DAILY,
      new TSAbcHopeCommitmentPauseSync()
    );
  }

  public void execute(SchedulableContext context) {
    syncDue(orgToday());
  }

  /** Commitments whose pause covers today, or that are still Paused. */
  public static void syncDue(Date today) {
    Set<Id> ids = new Set<Id>();
    for (GiftCommitmentSchedule s : [
      SELECT GiftCommitmentId
      FROM GiftCommitmentSchedule
      WHERE
        Type = 'PauseTransactions'
        AND StartDate <= :today
        AND (EndDate = NULL
        OR EndDate >= :today)
        AND GiftCommitment.Status = 'Active'
      LIMIT 2000
    ]) {
      ids.add(s.GiftCommitmentId);
    }
    for (GiftCommitment gc : [
      SELECT Id
      FROM GiftCommitment
      WHERE Status = 'Paused'
      LIMIT 2000
    ]) {
      ids.add(gc.Id);
    }
    sync(ids, today);
  }

  public static void sync(Set<Id> commitmentIds) {
    sync(commitmentIds, orgToday());
  }

  public static void sync(Set<Id> commitmentIds, Date today) {
    commitmentIds.remove(null);
    if (commitmentIds.isEmpty()) {
      return;
    }
    List<GiftCommitment> changed = new List<GiftCommitment>();
    for (GiftCommitment gc : [
      SELECT
        Id,
        Status,
        NextTransactionDate,
        (
          SELECT
            Type,
            StartDate,
            EndDate,
            TransactionPeriod,
            TransactionInterval,
            TransactionDay
          FROM GiftCommitmentSchedules
          ORDER BY StartDate
        )
      FROM GiftCommitment
      WHERE Id IN :commitmentIds AND Status IN ('Active', 'Paused')
    ]) {
      GiftCommitmentSchedule pause = null;
      Boolean givingToday = false;
      for (GiftCommitmentSchedule s : gc.GiftCommitmentSchedules) {
        if (
          s.Type == 'CreateTransactions' &&
          s.StartDate <= today &&
          (s.EndDate == null ||
          s.EndDate >= today)
        ) {
          givingToday = true;
        }
        if (
          s.Type == 'PauseTransactions' &&
          s.StartDate <= today &&
          (s.EndDate == null ||
          s.EndDate >= today)
        ) {
          pause = s;
        }
      }
      String status;
      Date next;
      if (pause != null) {
        status = 'Paused';
        next = pause.EndDate == null
          ? null
          : nextGiftDate(gc.GiftCommitmentSchedules, pause.EndDate.addDays(1));
      } else if (gc.Status == 'Paused' && givingToday) {
        // NPC allows Active only while a CreateTransactions schedule covers today; until then it stays Paused.
        status = 'Active';
        next = nextGiftDate(gc.GiftCommitmentSchedules, today);
      } else {
        continue;
      }
      if (gc.Status != status || gc.NextTransactionDate != next) {
        changed.add(
          new GiftCommitment(
            Id = gc.Id,
            Status = status,
            NextTransactionDate = next
          )
        );
      }
    }
    update changed;
  }

  /** The first gift date on or after `fromDate`, on the CreateTransactions schedule that covers it. */
  @TestVisible
  static Date nextGiftDate(
    List<GiftCommitmentSchedule> schedules,
    Date fromDate
  ) {
    for (GiftCommitmentSchedule s : schedules) {
      if (
        s.Type != 'CreateTransactions' ||
        (s.EndDate != null &&
        s.EndDate < fromDate)
      ) {
        continue;
      }
      Date start = s.StartDate > fromDate ? s.StartDate : fromDate;
      Date next = occurrenceOnOrAfter(s, start);
      if (next != null && (s.EndDate == null || next <= s.EndDate)) {
        return next;
      }
    }
    return null;
  }

  /** Monthly gifts fall on TransactionDay (NPC's rule); weekly and yearly ones step from the schedule start. */
  @TestVisible
  static Date occurrenceOnOrAfter(GiftCommitmentSchedule s, Date start) {
    Integer every = s.TransactionInterval == null ||
      s.TransactionInterval < 1
      ? 1
      : s.TransactionInterval;
    switch on s.TransactionPeriod {
      when 'Monthly' {
        Integer day = String.isBlank(s.TransactionDay)
          ? s.StartDate.day()
          : Integer.valueOf(s.TransactionDay);
        Date candidate = dayInMonth(start.year(), start.month(), day);
        return candidate >= start
          ? candidate
          : dayInMonth(
              start.addMonths(1).year(),
              start.addMonths(1).month(),
              day
            );
      }
      when 'Weekly' {
        Integer weeks = (Integer) Math.ceil(
          s.StartDate.daysBetween(start) / (7.0 * every)
        );
        return s.StartDate.addDays(Math.max(weeks, 0) * 7 * every);
      }
      when 'Yearly' {
        Date candidate = s.StartDate;
        while (candidate < start) {
          candidate = candidate.addYears(every);
        }
        return candidate;
      }
      when else {
        return start;
      }
    }
  }

  static Date dayInMonth(Integer year, Integer month, Integer day) {
    return Date.newInstance(
      year,
      month,
      Math.min(day, Date.daysInMonth(year, month))
    );
  }

  static Date orgToday() {
    return Date.valueOf(
      Datetime.now().format('yyyy-MM-dd', TSAbcHopeGiftNaming.timeZone)
    );
  }
}
