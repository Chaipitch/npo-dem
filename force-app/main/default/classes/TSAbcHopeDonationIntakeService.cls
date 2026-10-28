/**
 * Donation intake for the ABC Hope LWR site (guest and signed-in donors).
 * Validates the request, matches or creates the donor, creates the gift
 * (GiftTransaction for one-time, GiftCommitment + schedule for weekly, monthly or yearly)
 * and allocates it to a GiftDesignation. Payment is simulated: nothing is charged.
 *
 * Runs without sharing because the guest user must be able to match existing
 * donors it cannot see; every input is validated here before any DML.
 * Called by TSAbcHopeDonationIntakeController; data shapes are in TSAbcHopeDonationIntakeDto (D-51).
 * Campaign and program reads for the site are in TSAbcHopeCampaignService.
 */
public without sharing class TSAbcHopeDonationIntakeService {
  public static final String FREQ_ONE_TIME = 'One-time';
  public static final String FREQ_WEEKLY = 'Weekly';
  public static final String FREQ_MONTHLY = 'Monthly';
  public static final String FREQ_YEARLY = 'Yearly';
  /** Recurring frequencies; each is also the GiftCommitmentSchedule.TransactionPeriod value (D-24). */
  public static final Set<String> RECURRING_FREQUENCIES = new Set<String>{
    FREQ_WEEKLY,
    FREQ_MONTHLY,
    FREQ_YEARLY
  };
  public static final String TYPE_INDIVIDUAL = 'Individual';
  public static final String TYPE_ORGANIZATION = 'Organization';
  public static final Decimal MIN_AMOUNT = 100;
  /**
   * Status of a gift saved by the site (D-27): Paid, because the simulated payment is recorded as received.
   * Tests use Pending: the org's managed "*ASL Trigger v2" flow fails on Paid gifts in a test context
   * (it needs org data tests can't see); it runs fine for real gifts.
   */
  @TestVisible
  static String giftStatus = Test.isRunningTest() ? 'Pending' : 'Paid';
  public static final Decimal MAX_AMOUNT = 1000000;
  @TestVisible
  static final String PERSON_RT = 'NGO_Fundraising_Supporter';
  @TestVisible
  static final String BUSINESS_RT = 'Business_Account';
  static final Pattern EMAIL_PATTERN = Pattern.compile(
    '^[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
  );
  static final Integer DUPLICATE_WINDOW_SECONDS = 60;

  public class DonationException extends Exception {
  }

  // ---------------------------------------------------------------- options

  public static TSAbcHopeDonationIntakeDto.Options getOptions(
    String campaignName,
    String designationNames
  ) {
    Campaign camp = findCampaign(campaignName);
    TSAbcHopeDonationIntakeDto.Options opts = new TSAbcHopeDonationIntakeDto.Options();
    opts.campaignName = camp.Name;
    opts.campaignDescription = camp.Description;
    opts.campaignImageUrl = camp.Image_URL__c;

    // Designations: the admin-configured list if given; otherwise the campaign's own
    // default designations, plus "Where Most Needed" when it has two or more; otherwise every active designation.
    List<String> wanted = splitNames(designationNames);
    if (wanted.isEmpty()) {
      for (GiftDefaultDesignation gdd : [
        SELECT GiftDesignation.Name
        FROM GiftDefaultDesignation
        WHERE ParentRecordId = :camp.Id AND GiftDesignation.IsActive = TRUE
        ORDER BY AllocatedPercentage DESC, CreatedDate ASC
      ]) {
        wanted.add(gdd.GiftDesignation.Name);
      }
      // "Where Most Needed" only when there is a choice to make: with one cause it adds nothing (D-52).
      if (wanted.size() > 1) {
        wanted.add(GENERAL_DESIGNATION);
      }
    }
    List<GiftDesignation> gds = wanted.isEmpty()
      ? [
          SELECT Id, Name, NGOTV_Program__r.Name
          FROM GiftDesignation
          WHERE IsActive = TRUE
          ORDER BY Name
          LIMIT 50
        ]
      : [
          SELECT Id, Name, NGOTV_Program__r.Name
          FROM GiftDesignation
          WHERE IsActive = TRUE AND Name IN :wanted
        ];
    Map<String, GiftDesignation> byName = new Map<String, GiftDesignation>();
    for (GiftDesignation gd : gds) {
      byName.put(gd.Name, gd);
    }
    // Keep the configured order.
    for (
      String n : wanted.isEmpty() ? new List<String>(byName.keySet()) : wanted
    ) {
      if (byName.containsKey(n)) {
        GiftDesignation gd = byName.get(n);
        opts.designations.add(
          new TSAbcHopeDonationIntakeDto.Option(
            n,
            gd.Id,
            gd.NGOTV_Program__r?.Name
          )
        );
      }
    }
    for (GiftDefaultDesignation gdd : [
      SELECT GiftDesignationId
      FROM GiftDefaultDesignation
      WHERE ParentRecordId = :camp.Id
      ORDER BY AllocatedPercentage DESC, CreatedDate ASC
      LIMIT 1
    ]) {
      opts.defaultDesignationId = gdd.GiftDesignationId;
    }
    if (opts.defaultDesignationId == null && !opts.designations.isEmpty()) {
      opts.defaultDesignationId = opts.designations[0].value;
    }
    List<TSAbcHopeDonationIntakeDto.Share> split = campaignSplit(camp.Id);
    if (split.size() > 1) {
      opts.split = split;
    }
    opts.currentDonor = getCurrentDonor();
    return opts;
  }

  public static final String NON_SPECIFIED = TSAbcHopeGiftNaming.SPLIT_CAUSE;

  /**
   * The campaign's causes (its active default designations) with their shares, for a "Non specified" gift (D-48).
   * Shares follow the campaign's AllocatedPercentage, scaled so they add up to exactly 100; the largest share takes
   * any rounding remainder.
   */
  public static List<TSAbcHopeDonationIntakeDto.Share> campaignSplit(
    Id campaignId
  ) {
    List<TSAbcHopeDonationIntakeDto.Share> shares = new List<TSAbcHopeDonationIntakeDto.Share>();
    Decimal total = 0;
    for (GiftDefaultDesignation gdd : [
      SELECT GiftDesignationId, GiftDesignation.Name, AllocatedPercentage
      FROM GiftDefaultDesignation
      WHERE ParentRecordId = :campaignId AND GiftDesignation.IsActive = TRUE
      ORDER BY AllocatedPercentage DESC, CreatedDate ASC
    ]) {
      TSAbcHopeDonationIntakeDto.Share sh = new TSAbcHopeDonationIntakeDto.Share();
      sh.designationId = gdd.GiftDesignationId;
      sh.name = gdd.GiftDesignation.Name;
      sh.percent = gdd.AllocatedPercentage == null
        ? 0
        : gdd.AllocatedPercentage;
      total += sh.percent;
      shares.add(sh);
    }
    if (shares.isEmpty()) {
      return shares;
    }
    Decimal assigned = 0;
    for (TSAbcHopeDonationIntakeDto.Share sh : shares) {
      sh.percent = total > 0
        ? (sh.percent * 100 / total).setScale(2)
        : (100.0 / shares.size()).setScale(2);
      assigned += sh.percent;
    }
    shares[0].percent += 100 - assigned;
    return shares;
  }

  /** "Toys 34%, Books 33%, Games 33%". */
  public static String splitSummary(
    List<TSAbcHopeDonationIntakeDto.Share> shares
  ) {
    List<String> parts = new List<String>();
    for (TSAbcHopeDonationIntakeDto.Share sh : shares) {
      parts.add(
        sh.name + ' ' + sh.percent.stripTrailingZeros().toPlainString() + '%'
      );
    }
    return String.join(parts, ', ');
  }

  /** Amounts per share in cents-exact parts of `amount`; the first (largest) share takes the remainder. */
  static List<Decimal> splitAmounts(
    List<TSAbcHopeDonationIntakeDto.Share> shares,
    Decimal amount
  ) {
    List<Decimal> amounts = new List<Decimal>();
    Decimal assigned = 0;
    for (TSAbcHopeDonationIntakeDto.Share sh : shares) {
      Decimal a = (amount *
        sh.percent /
        100)
        .setScale(2, System.RoundingMode.DOWN);
      amounts.add(a);
      assigned += a;
    }
    amounts[0] += amount - assigned;
    return amounts;
  }

  /** Donor for the signed-in community user, or null for guests/internal users. */
  public static TSAbcHopeDonationIntakeDto.Donor getCurrentDonor() {
    Id accountId = currentUserAccountId();
    if (accountId == null) {
      return null;
    }
    Account acc = [
      SELECT Name, FirstName, LastName, PersonEmail, IsPersonAccount
      FROM Account
      WHERE Id = :accountId
    ];
    TSAbcHopeDonationIntakeDto.Donor d = new TSAbcHopeDonationIntakeDto.Donor();
    d.name = acc.Name;
    d.firstName = acc.FirstName;
    d.lastName = acc.LastName;
    d.email = acc.IsPersonAccount ? acc.PersonEmail : UserInfo.getUserEmail();
    return d;
  }

  // ---------------------------------------------------------------- submit

  public static TSAbcHopeDonationIntakeDto.Result submit(
    TSAbcHopeDonationIntakeDto.Request req
  ) {
    Id signedInAccountId = currentUserAccountId();
    validate(req, signedInAccountId != null);

    Campaign camp = findCampaign(req.campaignName);
    List<TSAbcHopeDonationIntakeDto.Share> shares = sharesFor(req, camp.Id);
    Id sourceCodeId = findSourceCodeId(req.sourceCode);

    Account donor = signedInAccountId != null
      ? [
          SELECT Id, Name, IsPersonAccount, PersonEmail
          FROM Account
          WHERE Id = :signedInAccountId
        ]
      : matchOrCreateDonor(req);

    String cause = shares.size() == 1 ? shares[0].name : NON_SPECIFIED;
    String giftName = buildName(camp.Name, cause, donor.Name);
    TSAbcHopeDonationIntakeDto.Result res = new TSAbcHopeDonationIntakeDto.Result();
    res.frequency = req.frequency;
    res.amount = req.amount;
    res.designationName = cause;
    res.splitSummary = shares.size() == 1 ? null : splitSummary(shares);
    res.donorName = donor.Name;
    res.donorEmail = donor.IsPersonAccount ? donor.PersonEmail : req.email;

    if (RECURRING_FREQUENCIES.contains(req.frequency)) {
      res.reference = createCommitment(
        req,
        donor,
        camp,
        shares,
        sourceCodeId,
        giftName
      );
    } else {
      res.reference = createTransaction(
        req,
        donor,
        camp,
        shares,
        sourceCodeId,
        giftName
      );
    }
    return res;
  }

  @TestVisible
  static void validate(
    TSAbcHopeDonationIntakeDto.Request req,
    Boolean signedIn
  ) {
    if (req == null) {
      throw new DonationException('Missing donation details.');
    }
    if (
      req.frequency != FREQ_ONE_TIME &&
      !RECURRING_FREQUENCIES.contains(req.frequency)
    ) {
      throw new DonationException(
        'Please choose one-time, or a weekly, monthly or yearly recurring gift.'
      );
    }
    if (
      req.amount == null ||
      req.amount < MIN_AMOUNT ||
      req.amount > MAX_AMOUNT
    ) {
      throw new DonationException(
        'Please enter an amount between 100 and 1,000,000.'
      );
    }
    req.amount = req.amount.setScale(2);
    if (req.designationId == null && req.nonSpecified != true) {
      throw new DonationException(
        'Please choose what you would like to support.'
      );
    }
    if (signedIn) {
      return; // donor comes from the running user
    }
    if (
      req.donorType != TYPE_INDIVIDUAL &&
      req.donorType != TYPE_ORGANIZATION
    ) {
      throw new DonationException('Please choose Individual or Organization.');
    }
    req.email = clean(req.email, 80);
    if (
      String.isBlank(req.email) || !EMAIL_PATTERN.matcher(req.email).matches()
    ) {
      throw new DonationException('Please enter a valid email address.');
    }
    req.email = req.email.toLowerCase();
    req.firstName = clean(req.firstName, 40);
    req.lastName = clean(req.lastName, 80);
    req.organizationName = clean(req.organizationName, 255);
    if (
      req.donorType == TYPE_INDIVIDUAL &&
      (String.isBlank(req.firstName) || String.isBlank(req.lastName))
    ) {
      throw new DonationException('Please enter your first and last name.');
    }
    if (
      req.donorType == TYPE_ORGANIZATION && String.isBlank(req.organizationName)
    ) {
      throw new DonationException('Please enter the organization name.');
    }
  }

  public static final String GENERAL_DESIGNATION = 'Where Most Needed';

  static Campaign findCampaign(String campaignName) {
    List<Campaign> camps = [
      SELECT Id, Name, Description, Image_URL__c
      FROM Campaign
      WHERE Name = :clean(campaignName, 80) AND IsActive = TRUE
      LIMIT 1
    ];
    if (camps.isEmpty()) {
      throw new DonationException(
        'This campaign is not accepting donations right now.'
      );
    }
    return camps[0];
  }

  /** The chosen cause at 100%, or for "Non specified" the campaign's causes and their shares (D-48). */
  static List<TSAbcHopeDonationIntakeDto.Share> sharesFor(
    TSAbcHopeDonationIntakeDto.Request req,
    Id campaignId
  ) {
    if (req.nonSpecified == true) {
      List<TSAbcHopeDonationIntakeDto.Share> shares = campaignSplit(campaignId);
      if (shares.isEmpty()) {
        throw new DonationException(
          'Please choose what you would like to support.'
        );
      }
      return shares;
    }
    GiftDesignation gd = findDesignation(req.designationId);
    TSAbcHopeDonationIntakeDto.Share sh = new TSAbcHopeDonationIntakeDto.Share();
    sh.designationId = gd.Id;
    sh.name = gd.Name;
    sh.percent = 100;
    return new List<TSAbcHopeDonationIntakeDto.Share>{ sh };
  }

  static GiftDesignation findDesignation(Id designationId) {
    List<GiftDesignation> gds = [
      SELECT Id, Name
      FROM GiftDesignation
      WHERE Id = :designationId AND IsActive = TRUE
      LIMIT 1
    ];
    if (gds.isEmpty()) {
      throw new DonationException(
        'Please choose what you would like to support.'
      );
    }
    return gds[0];
  }

  static Id findSourceCodeId(String sourceCode) {
    String code = clean(sourceCode, 80);
    if (String.isBlank(code)) {
      return null;
    }
    for (OutreachSourceCode osc : [
      SELECT Id
      FROM OutreachSourceCode
      WHERE SourceCode = :code AND Status = 'Active'
      LIMIT 1
    ]) {
      return osc.Id;
    }
    return null; // unknown codes are ignored, not an error for the donor
  }

  // ---------------------------------------------------------------- donor matching

  @TestVisible
  static Account matchOrCreateDonor(TSAbcHopeDonationIntakeDto.Request req) {
    if (req.donorType == TYPE_ORGANIZATION) {
      List<Account> orgs = [
        SELECT Id, Name, IsPersonAccount, PersonEmail
        FROM Account
        WHERE IsPersonAccount = FALSE AND Name = :req.organizationName
        ORDER BY LastModifiedDate DESC
        LIMIT 1
      ];
      if (!orgs.isEmpty()) {
        return orgs[0];
      }
      Account org = new Account(
        Name = req.organizationName,
        RecordTypeId = recordTypeId(BUSINESS_RT)
      );
      insertAllowingDuplicates(org);
      return [
        SELECT Id, Name, IsPersonAccount, PersonEmail
        FROM Account
        WHERE Id = :org.Id
      ];
    }

    List<Account> people = [
      SELECT Id, Name, IsPersonAccount, PersonEmail
      FROM Account
      WHERE IsPersonAccount = TRUE AND PersonEmail = :req.email
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];
    if (!people.isEmpty()) {
      return people[0];
    }
    Account person = new Account(
      FirstName = req.firstName,
      LastName = req.lastName,
      PersonEmail = req.email,
      RecordTypeId = recordTypeId(PERSON_RT)
    );
    insertAllowingDuplicates(person);
    return [
      SELECT Id, Name, IsPersonAccount, PersonEmail
      FROM Account
      WHERE Id = :person.Id
    ];
  }

  static Id recordTypeId(String developerName) {
    Schema.RecordTypeInfo rti = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
      .get(developerName);
    return rti == null ? null : rti.getRecordTypeId();
  }

  static void insertAllowingDuplicates(SObject record) {
    Database.DMLOptions dml = new Database.DMLOptions();
    dml.DuplicateRuleHeader.allowSave = true;
    Database.SaveResult sr = Database.insert(record, dml);
    if (!sr.isSuccess()) {
      throw new DonationException(
        'We could not save your details. Please try again.'
      );
    }
  }

  // ---------------------------------------------------------------- gifts

  static String createTransaction(
    TSAbcHopeDonationIntakeDto.Request req,
    Account donor,
    Campaign camp,
    List<TSAbcHopeDonationIntakeDto.Share> shares,
    Id sourceCodeId,
    String giftName
  ) {
    // Guard against double-submits: same donor, amount and campaign within a minute.
    Datetime since = Datetime.now().addSeconds(-DUPLICATE_WINDOW_SECONDS);
    for (GiftTransaction recent : [
      SELECT Name
      FROM GiftTransaction
      WHERE
        DonorId = :donor.Id
        AND CampaignId = :camp.Id
        AND OriginalAmount = :req.amount
        AND CreatedDate >= :since
      LIMIT 1
    ]) {
      return recent.Name;
    }

    Id giftId = insertPaidGift(
      req,
      donor,
      camp,
      shares,
      sourceCodeId,
      giftName,
      null
    );
    // The naming triggers have the last word (D-39): return the name as saved.
    return [SELECT Name FROM GiftTransaction WHERE Id = :giftId].Name;
  }

  /**
   * Saves today's gift as Paid (D-27): payment is simulated, so nothing is charged or stored, but the gift is
   * recorded as received. PaymentMethod stays Unknown (no card or bank details exist). For a recurring gift
   * this is its first payment, linked to the commitment; NPC creates the later instalments as Unpaid.
   */
  static Id insertPaidGift(
    TSAbcHopeDonationIntakeDto.Request req,
    Account donor,
    Campaign camp,
    List<TSAbcHopeDonationIntakeDto.Share> shares,
    Id sourceCodeId,
    String giftName,
    Id commitmentId
  ) {
    GiftTransaction gt = new GiftTransaction(
      Name = giftName,
      DonorId = donor.Id,
      CampaignId = camp.Id,
      GiftCommitmentId = commitmentId,
      OutreachSourceCodeId = sourceCodeId,
      OriginalAmount = req.amount,
      TransactionDate = Date.today(),
      TransactionDueDate = Date.today(), // required when linked to a commitment
      Status = giftStatus,
      PaymentMethod = 'Unknown',
      GiftType = donor.IsPersonAccount ? 'Individual' : 'Organizational',
      Description = description(req, donor)
    );
    insert gt;
    // NPC adds a default 100% designation to Paid gifts on insert (D-13); re-point it to the first share rather
    // than add a second one, then add the other shares of a "Non specified" gift (D-48).
    List<Decimal> amounts = splitAmounts(shares, req.amount);
    List<GiftTransactionDesignation> existing = [
      SELECT Id
      FROM GiftTransactionDesignation
      WHERE GiftTransactionId = :gt.Id
      LIMIT 1
    ];
    List<GiftTransactionDesignation> toInsert = new List<GiftTransactionDesignation>();
    for (Integer i = 0; i < shares.size(); i++) {
      GiftTransactionDesignation gtd = new GiftTransactionDesignation(
        GiftDesignationId = shares[i].designationId,
        Amount = amounts[i],
        Percent = shares[i].percent
      );
      if (i == 0 && !existing.isEmpty()) {
        gtd.Id = existing[0].Id;
        update gtd;
      } else {
        gtd.GiftTransactionId = gt.Id;
        toInsert.add(gtd);
      }
    }
    insert toInsert;
    return gt.Id;
  }

  static String createCommitment(
    TSAbcHopeDonationIntakeDto.Request req,
    Account donor,
    Campaign camp,
    List<TSAbcHopeDonationIntakeDto.Share> shares,
    Id sourceCodeId,
    String giftName
  ) {
    Datetime since = Datetime.now().addSeconds(-DUPLICATE_WINDOW_SECONDS);
    for (GiftCommitment recent : [
      SELECT Name
      FROM GiftCommitment
      WHERE
        DonorId = :donor.Id
        AND CampaignId = :camp.Id
        AND CreatedDate >= :since
      LIMIT 1
    ]) {
      return recent.Name;
    }

    Date startDate = Date.today();
    GiftCommitment gc = new GiftCommitment(
      Name = giftName,
      DonorId = donor.Id,
      CampaignId = camp.Id,
      Status = 'Active',
      ScheduleType = 'Recurring',
      RecurrenceType = 'OpenEnded',
      EffectiveStartDate = startDate,
      Description = description(req, donor)
    );
    insert gc;
    insert new GiftCommitmentSchedule(
      GiftCommitmentId = gc.Id,
      Type = 'CreateTransactions',
      TransactionAmount = req.amount,
      TransactionPeriod = req.frequency,
      TransactionInterval = 1,
      StartDate = startDate,
      PaymentMethod = 'Unknown',
      CampaignId = camp.Id,
      OutreachSourceCodeId = sourceCodeId
    );
    List<GiftDefaultDesignation> defaults = new List<GiftDefaultDesignation>();
    for (TSAbcHopeDonationIntakeDto.Share sh : shares) {
      defaults.add(
        new GiftDefaultDesignation(
          ParentRecordId = gc.Id,
          GiftDesignationId = sh.designationId,
          AllocatedPercentage = sh.percent
        )
      );
    }
    insert defaults;
    insertPaidGift(req, donor, camp, shares, sourceCodeId, giftName, gc.Id);
    return [SELECT Name FROM GiftCommitment WHERE Id = :gc.Id].Name;
  }

  // ---------------------------------------------------------------- helpers

  @TestVisible
  static Id accountIdOverride; // lets tests simulate a signed-in donor without a community licence

  static Id currentUserAccountId() {
    if (accountIdOverride != null) {
      return accountIdOverride;
    }
    if (UserInfo.getUserType() == 'Guest') {
      return null;
    }
    List<User> users = [
      SELECT Contact.AccountId
      FROM User
      WHERE Id = :UserInfo.getUserId() AND ContactId != NULL
    ];
    return users.isEmpty() ? null : users[0].Contact.AccountId;
  }

  /** "Campaign - Cause - Donor - yyyy-MM-dd HH:mm" (D-38): the shared rule in TSAbcHopeGiftNaming (D-39). */
  @TestVisible
  static String buildName(
    String campaignName,
    String designationName,
    String donorName
  ) {
    return TSAbcHopeGiftNaming.build(
      campaignName,
      designationName,
      donorName,
      Date.today(),
      Datetime.now()
    );
  }

  static String description(
    TSAbcHopeDonationIntakeDto.Request req,
    Account donor
  ) {
    String d = 'Submitted via ABC Hope site. Payment simulated - no payment collected.';
    if (req.donorType == TYPE_ORGANIZATION && String.isNotBlank(req.email)) {
      d += ' Organization contact email: ' + req.email;
    }
    return d;
  }

  static String clean(String value, Integer maxLength) {
    if (value == null) {
      return null;
    }
    return value.normalizeSpace().stripHtmlTags().abbreviate(maxLength);
  }

  static List<String> splitNames(String csv) {
    List<String> names = new List<String>();
    if (String.isBlank(csv)) {
      return names;
    }
    for (String n : csv.split(',')) {
      if (String.isNotBlank(n)) {
        names.add(n.trim());
      }
    }
    return names;
  }
}
