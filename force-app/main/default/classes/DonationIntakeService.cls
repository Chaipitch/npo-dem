/**
 * Donation intake for the ABC Hope LWR site (guest and signed-in donors).
 * Validates the request, matches or creates the donor, creates the gift
 * (GiftTransaction for one-time, GiftCommitment + schedule for monthly)
 * and allocates it to a GiftDesignation. Payment is simulated: nothing is charged.
 *
 * Runs without sharing because the guest user must be able to match existing
 * donors it cannot see; every input is validated here before any DML.
 */
public without sharing class DonationIntakeService {
    public static final String FREQ_ONE_TIME = 'One-time';
    public static final String FREQ_MONTHLY = 'Monthly';
    public static final String TYPE_INDIVIDUAL = 'Individual';
    public static final String TYPE_ORGANIZATION = 'Organization';
    public static final Decimal MIN_AMOUNT = 100;
    public static final Decimal MAX_AMOUNT = 1000000;
    @TestVisible
    static final String PERSON_RT = 'NGO_Fundraising_Supporter';
    @TestVisible
    static final String BUSINESS_RT = 'Business_Account';
    static final Pattern EMAIL_PATTERN = Pattern.compile('^[A-Za-z0-9._%+\'-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');
    static final Integer DUPLICATE_WINDOW_SECONDS = 60;

    public class DonationException extends Exception {
    }

    public class Request {
        public String campaignName;
        public String frequency;
        public Decimal amount;
        public Id designationId;
        public String donorType;
        public String firstName;
        public String lastName;
        public String organizationName;
        public String email;
        public String sourceCode;
    }

    public class Result {
        @AuraEnabled
        public String reference;
        @AuraEnabled
        public String frequency;
        @AuraEnabled
        public Decimal amount;
        @AuraEnabled
        public String designationName;
        @AuraEnabled
        public String donorName;
        @AuraEnabled
        public String donorEmail;
    }

    public class Donor {
        @AuraEnabled
        public String firstName;
        @AuraEnabled
        public String lastName;
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String email;
    }

    public class Option {
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String value;
        Option(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }

    public class Options {
        @AuraEnabled
        public String campaignName;
        @AuraEnabled
        public List<Option> designations = new List<Option>();
        @AuraEnabled
        public String defaultDesignationId;
        @AuraEnabled
        public Donor currentDonor;
    }

    // ---------------------------------------------------------------- options

    public static Options getOptions(String campaignName, String designationNames) {
        Campaign camp = findCampaign(campaignName);
        Options opts = new Options();
        opts.campaignName = camp.Name;

        List<String> wanted = splitNames(designationNames);
        List<GiftDesignation> gds = wanted.isEmpty()
            ? [SELECT Id, Name FROM GiftDesignation WHERE IsActive = TRUE ORDER BY Name LIMIT 50]
            : [SELECT Id, Name FROM GiftDesignation WHERE IsActive = TRUE AND Name IN :wanted];
        Map<String, GiftDesignation> byName = new Map<String, GiftDesignation>();
        for (GiftDesignation gd : gds) {
            byName.put(gd.Name, gd);
        }
        // Keep the order the site admin configured.
        for (String n : wanted.isEmpty() ? new List<String>(byName.keySet()) : wanted) {
            if (byName.containsKey(n)) {
                opts.designations.add(new Option(n, byName.get(n).Id));
            }
        }
        for (GiftDefaultDesignation gdd : [
            SELECT GiftDesignationId
            FROM GiftDefaultDesignation
            WHERE ParentRecordId = :camp.Id
            ORDER BY AllocatedPercentage DESC
            LIMIT 1
        ]) {
            opts.defaultDesignationId = gdd.GiftDesignationId;
        }
        if (opts.defaultDesignationId == null && !opts.designations.isEmpty()) {
            opts.defaultDesignationId = opts.designations[0].value;
        }
        opts.currentDonor = getCurrentDonor();
        return opts;
    }

    /** Donor for the signed-in community user, or null for guests/internal users. */
    public static Donor getCurrentDonor() {
        Id accountId = currentUserAccountId();
        if (accountId == null) {
            return null;
        }
        Account acc = [
            SELECT Name, FirstName, LastName, PersonEmail, IsPersonAccount
            FROM Account
            WHERE Id = :accountId
        ];
        Donor d = new Donor();
        d.name = acc.Name;
        d.firstName = acc.FirstName;
        d.lastName = acc.LastName;
        d.email = acc.IsPersonAccount ? acc.PersonEmail : UserInfo.getUserEmail();
        return d;
    }

    // ---------------------------------------------------------------- submit

    public static Result submit(Request req) {
        Id signedInAccountId = currentUserAccountId();
        validate(req, signedInAccountId != null);

        Campaign camp = findCampaign(req.campaignName);
        GiftDesignation designation = findDesignation(req.designationId);
        Id sourceCodeId = findSourceCodeId(req.sourceCode);

        Account donor = signedInAccountId != null
            ? [SELECT Id, Name, IsPersonAccount, PersonEmail FROM Account WHERE Id = :signedInAccountId]
            : matchOrCreateDonor(req);

        String giftName = buildName(camp.Name, donor.Name);
        Result res = new Result();
        res.frequency = req.frequency;
        res.amount = req.amount;
        res.designationName = designation.Name;
        res.donorName = donor.Name;
        res.donorEmail = donor.IsPersonAccount ? donor.PersonEmail : req.email;

        if (req.frequency == FREQ_MONTHLY) {
            res.reference = createCommitment(req, donor, camp, designation, sourceCodeId, giftName);
        } else {
            res.reference = createTransaction(req, donor, camp, designation, sourceCodeId, giftName);
        }
        return res;
    }

    @TestVisible
    static void validate(Request req, Boolean signedIn) {
        if (req == null) {
            throw new DonationException('Missing donation details.');
        }
        if (req.frequency != FREQ_ONE_TIME && req.frequency != FREQ_MONTHLY) {
            throw new DonationException('Please choose one-time or monthly.');
        }
        if (req.amount == null || req.amount < MIN_AMOUNT || req.amount > MAX_AMOUNT) {
            throw new DonationException('Please enter an amount between 100 and 1,000,000.');
        }
        req.amount = req.amount.setScale(2);
        if (req.designationId == null) {
            throw new DonationException('Please choose what you would like to support.');
        }
        if (signedIn) {
            return; // donor comes from the running user
        }
        if (req.donorType != TYPE_INDIVIDUAL && req.donorType != TYPE_ORGANIZATION) {
            throw new DonationException('Please choose Individual or Organization.');
        }
        req.email = clean(req.email, 80);
        if (String.isBlank(req.email) || !EMAIL_PATTERN.matcher(req.email).matches()) {
            throw new DonationException('Please enter a valid email address.');
        }
        req.email = req.email.toLowerCase();
        req.firstName = clean(req.firstName, 40);
        req.lastName = clean(req.lastName, 80);
        req.organizationName = clean(req.organizationName, 255);
        if (req.donorType == TYPE_INDIVIDUAL && (String.isBlank(req.firstName) || String.isBlank(req.lastName))) {
            throw new DonationException('Please enter your first and last name.');
        }
        if (req.donorType == TYPE_ORGANIZATION && String.isBlank(req.organizationName)) {
            throw new DonationException('Please enter the organization name.');
        }
    }

    static Campaign findCampaign(String campaignName) {
        List<Campaign> camps = [
            SELECT Id, Name
            FROM Campaign
            WHERE Name = :clean(campaignName, 80) AND IsActive = TRUE
            LIMIT 1
        ];
        if (camps.isEmpty()) {
            throw new DonationException('This campaign is not accepting donations right now.');
        }
        return camps[0];
    }

    static GiftDesignation findDesignation(Id designationId) {
        List<GiftDesignation> gds = [
            SELECT Id, Name
            FROM GiftDesignation
            WHERE Id = :designationId AND IsActive = TRUE
            LIMIT 1
        ];
        if (gds.isEmpty()) {
            throw new DonationException('Please choose what you would like to support.');
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
    static Account matchOrCreateDonor(Request req) {
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
            Account org = new Account(Name = req.organizationName, RecordTypeId = recordTypeId(BUSINESS_RT));
            insertAllowingDuplicates(org);
            return [SELECT Id, Name, IsPersonAccount, PersonEmail FROM Account WHERE Id = :org.Id];
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
        return [SELECT Id, Name, IsPersonAccount, PersonEmail FROM Account WHERE Id = :person.Id];
    }

    static Id recordTypeId(String developerName) {
        Schema.RecordTypeInfo rti = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get(developerName);
        return rti == null ? null : rti.getRecordTypeId();
    }

    static void insertAllowingDuplicates(SObject record) {
        Database.DMLOptions dml = new Database.DMLOptions();
        dml.DuplicateRuleHeader.allowSave = true;
        Database.SaveResult sr = Database.insert(record, dml);
        if (!sr.isSuccess()) {
            throw new DonationException('We could not save your details. Please try again.');
        }
    }

    // ---------------------------------------------------------------- gifts

    static String createTransaction(
        Request req,
        Account donor,
        Campaign camp,
        GiftDesignation designation,
        Id sourceCodeId,
        String giftName
    ) {
        // Guard against double-submits: same donor, amount and campaign within a minute.
        Datetime since = Datetime.now().addSeconds(-DUPLICATE_WINDOW_SECONDS);
        for (GiftTransaction recent : [
            SELECT Name
            FROM GiftTransaction
            WHERE DonorId = :donor.Id AND CampaignId = :camp.Id AND OriginalAmount = :req.amount AND CreatedDate >= :since
            LIMIT 1
        ]) {
            return recent.Name;
        }

        GiftTransaction gt = new GiftTransaction(
            Name = giftName,
            DonorId = donor.Id,
            CampaignId = camp.Id,
            OutreachSourceCodeId = sourceCodeId,
            OriginalAmount = req.amount,
            TransactionDate = Date.today(),
            Status = 'Unpaid',
            PaymentMethod = 'Unknown',
            GiftType = donor.IsPersonAccount ? 'Individual' : 'Organizational',
            Description = description(req, donor)
        );
        insert gt;
        insert new GiftTransactionDesignation(
            GiftTransactionId = gt.Id,
            GiftDesignationId = designation.Id,
            Amount = req.amount,
            Percent = 100
        );
        return giftName;
    }

    static String createCommitment(
        Request req,
        Account donor,
        Campaign camp,
        GiftDesignation designation,
        Id sourceCodeId,
        String giftName
    ) {
        Datetime since = Datetime.now().addSeconds(-DUPLICATE_WINDOW_SECONDS);
        for (GiftCommitment recent : [
            SELECT Name
            FROM GiftCommitment
            WHERE DonorId = :donor.Id AND CampaignId = :camp.Id AND CreatedDate >= :since
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
            TransactionPeriod = 'Monthly',
            TransactionInterval = 1,
            StartDate = startDate,
            PaymentMethod = 'Unknown',
            CampaignId = camp.Id,
            OutreachSourceCodeId = sourceCodeId
        );
        insert new GiftDefaultDesignation(
            ParentRecordId = gc.Id,
            GiftDesignationId = designation.Id,
            AllocatedPercentage = 100
        );
        return giftName;
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
        List<User> users = [SELECT Contact.AccountId FROM User WHERE Id = :UserInfo.getUserId() AND ContactId != NULL];
        return users.isEmpty() ? null : users[0].Contact.AccountId;
    }

    static String buildName(String campaignName, String donorName) {
        String name = campaignName + ' - ' + donorName + ' - ' + Datetime.now().format('yyyy-MM-dd HH:mm');
        return name.abbreviate(80);
    }

    static String description(Request req, Account donor) {
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
