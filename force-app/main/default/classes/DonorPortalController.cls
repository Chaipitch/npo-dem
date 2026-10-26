/**
 * Signed-in donor portal on the ABC Hope site: dashboard KPIs, giving history,
 * impact journey and profile management. Every query is scoped to the running
 * user's own Account, so donors can only ever see and edit their own data.
 */
public without sharing class DonorPortalController {
  static final Set<String> EXCLUDED_STATUSES = new Set<String>{
    'Canceled',
    'Failed',
    'Fully Refunded',
    'Written-Off'
  };
  static final Pattern EMAIL_PATTERN = Pattern.compile(
    '^[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
  );

  public class Gift {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Date giftDate;
    @AuraEnabled
    public Decimal amount;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String campaignName;
    @AuraEnabled
    public String designations;
    @AuraEnabled
    public String programs; // what the designations fund (D-21)
  }

  public class Milestone {
    @AuraEnabled
    public String year;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String kind;
  }

  public class Dashboard {
    @AuraEnabled
    public String donorName;
    @AuraEnabled
    public String firstName;
    @AuraEnabled
    public Decimal totalContributions = 0;
    @AuraEnabled
    public Integer causesSupported = 0;
    @AuraEnabled
    public String supporterSince;
    @AuraEnabled
    public Integer activeMonthlyGifts = 0; // open and not paused
    @AuraEnabled
    public Integer pausedMonthlyGifts = 0; // current or upcoming pause (D-22)
    // Org-wide figures for the Shared impact tiles ("{programs}", "{peopleReached}", "{volunteers}").
    @AuraEnabled
    public Integer activePrograms = 0; // active Programs
    @AuraEnabled
    public Integer peopleReached = 0; // distinct accounts with an In Progress/Completed program enrollment
    @AuraEnabled
    public Integer volunteersEngaged = 0; // distinct accounts with a Complete/In Progress volunteer assignment
    @AuraEnabled
    public Date pausedUntil; // earliest pause end among paused gifts
    @AuraEnabled
    public List<String> activeRecurringTypes = new List<String>(); // e.g. Weekly, Monthly (D-24)
    @AuraEnabled
    public List<String> causes = new List<String>();
    @AuraEnabled
    public List<Gift> gifts = new List<Gift>();
    @AuraEnabled
    public List<Milestone> journey = new List<Milestone>();
  }

  public class Profile {
    @AuraEnabled
    public String firstName;
    @AuraEnabled
    public String lastName;
    @AuraEnabled
    public String email;
    @AuraEnabled
    public String phone;
    @AuraEnabled
    public String street;
    @AuraEnabled
    public String city;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public Boolean emailOptOut;
    @AuraEnabled
    public String donorSince;
  }

  @AuraEnabled(cacheable=true)
  public static Dashboard getDashboard() {
    return buildDashboard(currentAccount());
  }

  /** Giving summary for one donor account. Callers must have already established that the account is the requester's own. */
  public static Dashboard buildDashboard(Account acc) {
    Dashboard d = new Dashboard();
    d.donorName = acc.Name;
    d.firstName = String.isNotBlank(acc.FirstName) ? acc.FirstName : acc.Name;

    Map<Id, GiftTransaction> txns = new Map<Id, GiftTransaction>(
      countedGifts(acc.Id)
    );
    Map<Id, List<String>> designationsByTxn = new Map<Id, List<String>>();
    Map<Id, List<String>> programsByTxn = new Map<Id, List<String>>();
    // Year a cause was first supported, for the impact journey.
    Map<String, Integer> firstYearByCause = new Map<String, Integer>();
    for (GiftTransactionDesignation gtd : [
      SELECT
        GiftTransactionId,
        GiftDesignation.Name,
        GiftDesignation.NGOTV_Program__r.Name
      FROM GiftTransactionDesignation
      WHERE GiftTransactionId IN :txns.keySet() AND GiftDesignationId != NULL
    ]) {
      String cause = gtd.GiftDesignation.Name;
      if (!designationsByTxn.containsKey(gtd.GiftTransactionId)) {
        designationsByTxn.put(gtd.GiftTransactionId, new List<String>());
      }
      designationsByTxn.get(gtd.GiftTransactionId).add(cause);
      DonationIntakeService.addProgram(
        programsByTxn,
        gtd.GiftTransactionId,
        gtd.GiftDesignation.NGOTV_Program__r?.Name
      );
      Integer year = giftYear(txns.get(gtd.GiftTransactionId));
      if (
        !firstYearByCause.containsKey(cause) ||
        year < firstYearByCause.get(cause)
      ) {
        firstYearByCause.put(cause, year);
      }
    }

    Integer firstYear = supporterSinceYear(acc, txns.values());
    for (GiftTransaction gt : txns.values()) {
      d.totalContributions += gt.OriginalAmount == null ? 0 : gt.OriginalAmount;
      if (d.gifts.size() < 50) {
        Gift g = new Gift();
        g.id = gt.Id;
        g.name = gt.Name;
        g.giftDate = gt.TransactionDate != null
          ? gt.TransactionDate
          : gt.CreatedDate.date();
        g.amount = gt.OriginalAmount;
        g.status = gt.Status;
        g.campaignName = gt.Campaign?.Name;
        g.designations = designationsByTxn.containsKey(gt.Id)
          ? String.join(designationsByTxn.get(gt.Id), ', ')
          : '';
        g.programs = programsByTxn.containsKey(gt.Id)
          ? String.join(programsByTxn.get(gt.Id), ', ')
          : '';
        d.gifts.add(g);
      }
    }
    for (GiftDefaultDesignation gdd : [
      SELECT GiftDesignation.Name, ParentRecordId
      FROM GiftDefaultDesignation
      WHERE
        ParentRecordId IN (
          SELECT Id
          FROM GiftCommitment
          WHERE DonorId = :acc.Id AND Status = 'Active'
        )
    ]) {
      if (!firstYearByCause.containsKey(gdd.GiftDesignation.Name)) {
        firstYearByCause.put(gdd.GiftDesignation.Name, Date.today().year());
      }
    }
    // NPC keeps paused commitments Active, so count pauses from their schedules (D-22).
    Set<String> activeTypes = new Set<String>();
    for (MonthlyGiftService.Gift mg : MonthlyGiftService.load(acc.Id)) {
      if (mg.isPaused) {
        d.pausedMonthlyGifts++;
        if (
          mg.pausedUntil != null &&
          (d.pausedUntil == null ||
          mg.pausedUntil < d.pausedUntil)
        ) {
          d.pausedUntil = mg.pausedUntil;
        }
      } else {
        d.activeMonthlyGifts++;
        activeTypes.add(MonthlyGiftService.typeLabel(mg.period));
      }
    }
    for (String t : new List<String>{ 'Weekly', 'Monthly', 'Yearly' }) {
      if (activeTypes.contains(t)) {
        d.activeRecurringTypes.add(t);
      }
    }

    d.causes = new List<String>(firstYearByCause.keySet());
    d.causes.sort();
    d.causesSupported = d.causes.size();
    d.supporterSince = String.valueOf(firstYear);
    d.activePrograms = [SELECT COUNT() FROM Program WHERE Status = 'Active'];
    d.peopleReached = (Integer) [
        SELECT COUNT_DISTINCT(AccountId) n
        FROM ProgramEnrollment
        WHERE Status IN ('In Progress', 'Completed')
      ][0]
      .get('n');
    d.volunteersEngaged = (Integer) [
        SELECT COUNT_DISTINCT(AssignedAccountId) n
        FROM JobPositionAssignment
        WHERE Status IN ('Complete', 'In Progress')
      ][0]
      .get('n');

    Milestone joined = new Milestone();
    joined.year = String.valueOf(firstYear);
    joined.label = 'Joined as a supporter';
    joined.kind = 'joined';
    d.journey.add(joined);
    List<CauseYear> ordered = new List<CauseYear>();
    for (String cause : firstYearByCause.keySet()) {
      ordered.add(new CauseYear(cause, firstYearByCause.get(cause)));
    }
    ordered.sort();
    for (CauseYear cy : ordered) {
      Milestone m = new Milestone();
      m.year = String.valueOf(cy.year);
      m.label = 'Supported ' + cy.cause;
      m.kind = 'cause';
      d.journey.add(m);
    }
    return d;
  }

  @AuraEnabled
  public static Profile getProfile() {
    Account acc = currentAccount();
    Profile p = new Profile();
    p.firstName = acc.FirstName;
    p.lastName = acc.LastName;
    p.email = acc.PersonEmail;
    p.phone = acc.PersonMobilePhone != null ? acc.PersonMobilePhone : acc.Phone;
    p.street = acc.PersonMailingStreet;
    p.city = acc.PersonMailingCity;
    p.country = acc.PersonMailingCountry;
    p.emailOptOut = acc.PersonHasOptedOutOfEmail;
    // Same rule as the dashboard's Supporter Since: earliest of account creation and first gift.
    p.donorSince = String.valueOf(
      supporterSinceYear(acc, countedGifts(acc.Id))
    );
    return p;
  }

  @AuraEnabled
  public static Profile saveProfile(String profileJson) {
    Profile p;
    try {
      p = (Profile) JSON.deserialize(profileJson, Profile.class);
    } catch (Exception e) {
      throw auraError('Invalid profile details.');
    }
    Account acc = currentAccount();
    if (!acc.IsPersonAccount) {
      throw auraError('Only individual donor profiles can be edited here.');
    }
    String email = clean(p.email, 80);
    if (
      String.isBlank(clean(p.firstName, 40)) ||
      String.isBlank(clean(p.lastName, 80))
    ) {
      throw auraError('Please enter your first and last name.');
    }
    if (String.isBlank(email) || !EMAIL_PATTERN.matcher(email).matches()) {
      throw auraError('Please enter a valid email address.');
    }
    Account upd = new Account(
      Id = acc.Id,
      FirstName = clean(p.firstName, 40),
      LastName = clean(p.lastName, 80),
      PersonEmail = email.toLowerCase(),
      PersonMobilePhone = clean(p.phone, 40),
      PersonMailingStreet = clean(p.street, 255),
      PersonMailingCity = clean(p.city, 40),
      PersonMailingCountry = clean(p.country, 80),
      PersonHasOptedOutOfEmail = p.emailOptOut == true
    );
    try {
      update upd;
    } catch (DmlException e) {
      throw auraError('We could not save your profile. ' + e.getDmlMessage(0));
    }
    return getProfile();
  }

  // ---------------------------------------------------------------- monthly gifts

  public class MonthlyGiftsResult {
    @AuraEnabled
    public String message;
    @AuraEnabled
    public List<MonthlyGiftService.Gift> gifts;
  }

  static final Set<String> MONTHLY_OPERATIONS = new Set<String>{
    'pause',
    'resume',
    'change_amount',
    'cancel'
  };

  @AuraEnabled
  public static List<MonthlyGiftService.Gift> getMonthlyGifts() {
    return MonthlyGiftService.load(currentAccount().Id);
  }

  /** Pause, resume, change or cancel one of the signed-in donor's own recurring gifts. */
  @AuraEnabled
  public static MonthlyGiftsResult manageMonthlyGift(
    String giftId,
    String operation,
    Integer pauseMonths,
    Decimal newAmount
  ) {
    Account acc = currentAccount();
    String op = operation == null ? '' : operation.trim().toLowerCase();
    if (!MONTHLY_OPERATIONS.contains(op)) {
      throw auraError('Unknown action.');
    }
    MonthlyGiftService.Gift gift = MonthlyGiftService.find(acc.Id, giftId);
    if (gift == null) {
      throw auraError('This recurring gift could not be found.');
    }
    MonthlyGiftService.Outcome outcome;
    if (op == 'pause') {
      outcome = MonthlyGiftService.pause(gift, pauseMonths);
    } else if (op == 'resume') {
      outcome = MonthlyGiftService.resume(gift);
    } else if (op == 'change_amount') {
      outcome = MonthlyGiftService.changeAmount(gift, newAmount);
    } else {
      outcome = MonthlyGiftService.cancel(gift);
    }
    if (!outcome.success) {
      throw auraError(outcome.message);
    }
    MonthlyGiftsResult res = new MonthlyGiftsResult();
    res.message = outcome.message;
    res.gifts = MonthlyGiftService.load(acc.Id);
    return res;
  }

  // ---------------------------------------------------------------- helpers

  class CauseYear implements Comparable {
    String cause;
    Integer year;
    CauseYear(String cause, Integer year) {
      this.cause = cause;
      this.year = year;
    }
    public Integer compareTo(Object other) {
      CauseYear o = (CauseYear) other;
      if (year != o.year) {
        return year - o.year;
      }
      return cause.compareTo(o.cause);
    }
  }

  /** The donor's gifts that count (not cancelled, failed, refunded or written off), newest first. */
  static List<GiftTransaction> countedGifts(Id accountId) {
    return [
      SELECT
        Id,
        Name,
        TransactionDate,
        CreatedDate,
        OriginalAmount,
        Status,
        Campaign.Name
      FROM GiftTransaction
      WHERE DonorId = :accountId AND Status NOT IN :EXCLUDED_STATUSES
      ORDER BY TransactionDate DESC NULLS LAST, CreatedDate DESC
      LIMIT 200
    ];
  }

  /** Supporter since: the earliest of the account's creation year and its first counted gift. */
  static Integer supporterSinceYear(Account acc, List<GiftTransaction> gifts) {
    Integer year = acc.CreatedDate.year();
    for (GiftTransaction gt : gifts) {
      year = Math.min(year, giftYear(gt));
    }
    return year;
  }

  static Integer giftYear(GiftTransaction gt) {
    return gt.TransactionDate != null
      ? gt.TransactionDate.year()
      : gt.CreatedDate.year();
  }

  @TestVisible
  static Id accountIdOverride; // lets tests run without a community user licence

  static Account currentAccount() {
    Id accountId = accountIdOverride;
    if (accountId == null && UserInfo.getUserType() != 'Guest') {
      for (User u : [
        SELECT Contact.AccountId
        FROM User
        WHERE Id = :UserInfo.getUserId() AND ContactId != NULL
      ]) {
        accountId = u.Contact.AccountId;
      }
    }
    if (accountId == null) {
      throw auraError('Please sign in to view your donor profile.');
    }
    return loadAccount(accountId);
  }

  public static Account loadAccount(Id accountId) {
    return [
      SELECT
        Id,
        Name,
        FirstName,
        LastName,
        IsPersonAccount,
        PersonEmail,
        Phone,
        PersonMobilePhone,
        PersonMailingStreet,
        PersonMailingCity,
        PersonMailingCountry,
        PersonHasOptedOutOfEmail,
        CreatedDate
      FROM Account
      WHERE Id = :accountId
    ];
  }

  static String clean(String value, Integer maxLength) {
    return value == null
      ? null
      : value.normalizeSpace().stripHtmlTags().abbreviate(maxLength);
  }

  static AuraHandledException auraError(String message) {
    AuraHandledException e = new AuraHandledException(message);
    e.setMessage(message);
    return e;
  }
}
