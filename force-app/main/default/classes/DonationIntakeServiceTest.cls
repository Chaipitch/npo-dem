@IsTest
private class DonationIntakeServiceTest {
    static final String CAMPAIGN = 'Test Christmas Giving';

    @TestSetup
    static void setup() {
        Campaign camp = new Campaign(Name = CAMPAIGN, IsActive = true, Status = 'In Progress');
        insert camp;
        List<GiftDesignation> gds = new List<GiftDesignation>{
            new GiftDesignation(Name = 'Test School Supplies', IsActive = true),
            new GiftDesignation(Name = 'Test Learning Kits', IsActive = true),
            new GiftDesignation(Name = 'Test Retired Fund', IsActive = true)
        };
        insert gds;
        // Designations are always created active; retire one afterwards.
        update new GiftDesignation(Id = gds[2].Id, IsActive = false);
        insert new GiftDefaultDesignation(ParentRecordId = camp.Id, GiftDesignationId = gds[0].Id, AllocatedPercentage = 100);
        insert new OutreachSourceCode(Name = 'Test Email', SourceCode = 'TEST-XMAS', Status = 'Active', CampaignId = camp.Id);
    }

    static Id designationId(String name) {
        return [SELECT Id FROM GiftDesignation WHERE Name = :name].Id;
    }

    static DonationIntakeService.Request individual(String email) {
        DonationIntakeService.Request req = new DonationIntakeService.Request();
        req.campaignName = CAMPAIGN;
        req.frequency = DonationIntakeService.FREQ_ONE_TIME;
        req.amount = 1000;
        req.designationId = designationId('Test School Supplies');
        req.donorType = DonationIntakeService.TYPE_INDIVIDUAL;
        req.firstName = 'Ann';
        req.lastName = 'Demo';
        req.email = email;
        return req;
    }

    @IsTest
    static void getOptionsReturnsConfiguredDesignationsInOrderWithCampaignDefault() {
        Test.startTest();
        DonationIntakeService.Options opts = DonationIntakeService.getOptions(
            CAMPAIGN,
            'Test Learning Kits, Test School Supplies, Test Retired Fund'
        );
        Test.stopTest();
        Assert.areEqual(CAMPAIGN, opts.campaignName);
        Assert.areEqual(2, opts.designations.size(), 'inactive designations are excluded');
        Assert.areEqual('Test Learning Kits', opts.designations[0].label, 'admin order is kept');
        Assert.areEqual(designationId('Test School Supplies'), opts.defaultDesignationId);
        Assert.isNull(opts.currentDonor, 'internal user is not a donor');
    }

    @IsTest
    static void oneTimeGiftCreatesPersonAccountTransactionAndDesignation() {
        DonationIntakeService.Request req = individual('Ann.Demo@Example.com');
        req.sourceCode = 'TEST-XMAS';

        Test.startTest();
        DonationIntakeService.Result res = DonationIntakeService.submit(req);
        Test.stopTest();

        Account donor = [SELECT Id, IsPersonAccount, PersonEmail FROM Account WHERE PersonEmail = 'ann.demo@example.com'];
        Assert.isTrue(donor.IsPersonAccount);
        GiftTransaction gt = [
            SELECT Name, OriginalAmount, Status, PaymentMethod, GiftType, Campaign.Name, OutreachSourceCode.SourceCode
            FROM GiftTransaction
            WHERE DonorId = :donor.Id
        ];
        Assert.areEqual(1000, gt.OriginalAmount);
        Assert.areEqual('Unpaid', gt.Status);
        Assert.areEqual('Unknown', gt.PaymentMethod);
        Assert.areEqual('Individual', gt.GiftType);
        Assert.areEqual(CAMPAIGN, gt.Campaign.Name);
        Assert.areEqual('TEST-XMAS', gt.OutreachSourceCode.SourceCode);
        Assert.areEqual(gt.Name, res.reference);
        GiftTransactionDesignation gtd = [
            SELECT GiftDesignation.Name, Percent
            FROM GiftTransactionDesignation
            WHERE GiftTransaction.DonorId = :donor.Id
        ];
        Assert.areEqual('Test School Supplies', gtd.GiftDesignation.Name);
        Assert.areEqual(100, gtd.Percent);
        Assert.areEqual('Test School Supplies', res.designationName);
    }

    @IsTest
    static void returningDonorIsMatchedByEmailCaseInsensitively() {
        Account existing = new Account(
            FirstName = 'Maya',
            LastName = 'Grande',
            PersonEmail = 'maya.test@example.com',
            RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
                .get(DonationIntakeService.PERSON_RT)
                .getRecordTypeId()
        );
        insert existing;
        DonationIntakeService.Request req = individual('MAYA.TEST@example.com');
        req.firstName = 'Different';

        Test.startTest();
        DonationIntakeService.submit(req);
        Test.stopTest();

        Assert.areEqual(1, [SELECT COUNT() FROM Account WHERE PersonEmail = 'maya.test@example.com']);
        Assert.areEqual(1, [SELECT COUNT() FROM GiftTransaction WHERE DonorId = :existing.Id]);
    }

    @IsTest
    static void organizationGiftCreatesBusinessAccountOnceAndIsOrganizational() {
        DonationIntakeService.Request req = individual('csr@acme.example.com');
        req.donorType = DonationIntakeService.TYPE_ORGANIZATION;
        req.organizationName = 'Acme Test Co';
        req.firstName = null;
        req.lastName = null;

        Test.startTest();
        DonationIntakeService.submit(req);
        req.amount = 2500; // different amount so the duplicate guard does not apply
        DonationIntakeService.submit(req);
        Test.stopTest();

        Account org = [SELECT Id, IsPersonAccount FROM Account WHERE Name = 'Acme Test Co'];
        Assert.isFalse(org.IsPersonAccount);
        List<GiftTransaction> gts = [SELECT GiftType, Description FROM GiftTransaction WHERE DonorId = :org.Id];
        Assert.areEqual(2, gts.size(), 'second gift reuses the same organization');
        Assert.areEqual('Organizational', gts[0].GiftType);
        Assert.isTrue(gts[0].Description.contains('csr@acme.example.com'));
    }

    @IsTest
    static void monthlyGiftCreatesCommitmentScheduleAndDefaultDesignation() {
        DonationIntakeService.Request req = individual('monthly@example.com');
        req.frequency = DonationIntakeService.FREQ_MONTHLY;
        req.amount = 500;
        req.designationId = designationId('Test Learning Kits');

        Test.startTest();
        DonationIntakeService.Result res = DonationIntakeService.submit(req);
        Test.stopTest();

        GiftCommitment gc = [
            SELECT Id, Name, Status, Campaign.Name
            FROM GiftCommitment
            WHERE Donor.PersonEmail = 'monthly@example.com'
        ];
        Assert.areEqual(CAMPAIGN, gc.Campaign.Name);
        Assert.areEqual(gc.Name, res.reference);
        GiftCommitmentSchedule gcs = [
            SELECT TransactionAmount, TransactionPeriod, TransactionInterval
            FROM GiftCommitmentSchedule
            WHERE GiftCommitmentId = :gc.Id
            LIMIT 1
        ];
        Assert.areEqual(500, gcs.TransactionAmount);
        Assert.areEqual('Monthly', gcs.TransactionPeriod);
        Assert.areEqual(1, gcs.TransactionInterval);
        GiftDefaultDesignation gdd = [
            SELECT GiftDesignation.Name, AllocatedPercentage
            FROM GiftDefaultDesignation
            WHERE ParentRecordId = :gc.Id
        ];
        Assert.areEqual('Test Learning Kits', gdd.GiftDesignation.Name);
        Assert.areEqual(100, gdd.AllocatedPercentage);
    }

    @IsTest
    static void doubleSubmitReturnsSameGift() {
        Test.startTest();
        DonationIntakeService.Result first = DonationIntakeService.submit(individual('double@example.com'));
        DonationIntakeService.Result second = DonationIntakeService.submit(individual('double@example.com'));
        Test.stopTest();
        Assert.areEqual(first.reference, second.reference);
        Assert.areEqual(1, [SELECT COUNT() FROM GiftTransaction WHERE Donor.PersonEmail = 'double@example.com']);
    }

    @IsTest
    static void signedInDonorUsesOwnAccountAndIgnoresTypedDetails() {
        Account maya = new Account(
            FirstName = 'Maya',
            LastName = 'Signed',
            PersonEmail = 'maya.signed@example.com',
            RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
                .get(DonationIntakeService.PERSON_RT)
                .getRecordTypeId()
        );
        insert maya;
        DonationIntakeService.accountIdOverride = maya.Id;
        DonationIntakeService.Request req = individual(null); // no email needed when signed in
        req.donorType = null;

        Test.startTest();
        DonationIntakeService.Donor donor = DonationIntakeService.getCurrentDonor();
        DonationIntakeService.Result res = DonationIntakeService.submit(req);
        Test.stopTest();

        Assert.areEqual('maya.signed@example.com', donor.email);
        Assert.areEqual('Maya Signed', res.donorName);
        Assert.areEqual(1, [SELECT COUNT() FROM GiftTransaction WHERE DonorId = :maya.Id]);
        Assert.areEqual(0, [SELECT COUNT() FROM Account WHERE Name = 'Ann Demo']);
    }

    @IsTest
    static void unknownSourceCodeIsIgnored() {
        DonationIntakeService.Request req = individual('nosrc@example.com');
        req.sourceCode = 'NOT-A-CODE';
        Test.startTest();
        DonationIntakeService.submit(req);
        Test.stopTest();
        Assert.isNull([SELECT OutreachSourceCodeId FROM GiftTransaction WHERE Donor.PersonEmail = 'nosrc@example.com'].OutreachSourceCodeId);
    }

    @IsTest
    static void invalidRequestsAreRejected() {
        Map<String, DonationIntakeService.Request> bad = new Map<String, DonationIntakeService.Request>();
        DonationIntakeService.Request r;

        r = individual('a@example.com');
        r.amount = 0;
        bad.put('zero amount', r);
        r = individual('a@example.com');
        r.amount = -100;
        bad.put('negative amount', r);
        r = individual('a@example.com');
        r.amount = 2000000;
        bad.put('amount over max', r);
        r = individual('ann@');
        bad.put('bad email', r);
        r = individual('a@example.com');
        r.frequency = 'Weekly';
        bad.put('bad frequency', r);
        r = individual('a@example.com');
        r.donorType = 'Robot';
        bad.put('bad donor type', r);
        r = individual('a@example.com');
        r.lastName = '  ';
        bad.put('missing last name', r);
        r = individual('a@example.com');
        r.donorType = DonationIntakeService.TYPE_ORGANIZATION;
        bad.put('missing org name', r);
        r = individual('a@example.com');
        r.designationId = null;
        bad.put('missing designation', r);
        r = individual('a@example.com');
        r.designationId = designationId('Test Retired Fund');
        bad.put('inactive designation', r);
        r = individual('a@example.com');
        r.campaignName = 'No Such Campaign';
        bad.put('unknown campaign', r);
        bad.put('null request', null);

        Test.startTest();
        for (String label : bad.keySet()) {
            try {
                DonationIntakeService.submit(bad.get(label));
                Assert.fail('Expected rejection: ' + label);
            } catch (DonationIntakeService.DonationException e) {
                Assert.isTrue(String.isNotBlank(e.getMessage()), label);
            }
        }
        Test.stopTest();
        Assert.areEqual(0, [SELECT COUNT() FROM GiftTransaction WHERE Campaign.Name = :CAMPAIGN]);
    }

    @IsTest
    static void htmlIsStrippedFromNames() {
        DonationIntakeService.Request req = individual('xss@example.com');
        req.firstName = '<b>Ann</b>';
        Test.startTest();
        DonationIntakeService.submit(req);
        Test.stopTest();
        Assert.areEqual('Ann', [SELECT FirstName FROM Account WHERE PersonEmail = 'xss@example.com'].FirstName);
    }
}
