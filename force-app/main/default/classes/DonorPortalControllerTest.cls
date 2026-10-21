@IsTest
private class DonorPortalControllerTest {
    static Account createDonor() {
        Account maya = new Account(
            FirstName = 'Maya',
            LastName = 'Portal',
            PersonEmail = 'maya.portal@example.com',
            RecordTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName()
                .get('NGO_Fundraising_Supporter')
                .getRecordTypeId()
        );
        insert maya;
        return maya;
    }

    static void createGift(Account donor, Campaign camp, GiftDesignation gd, Decimal amount, Date d, String status) {
        GiftTransaction gt = new GiftTransaction(
            Name = 'Gift ' + amount,
            DonorId = donor.Id,
            CampaignId = camp.Id,
            OriginalAmount = amount,
            TransactionDate = d,
            Status = status,
            PaymentMethod = 'Unknown'
        );
        insert gt;
        insert new GiftTransactionDesignation(GiftTransactionId = gt.Id, GiftDesignationId = gd.Id, Percent = 100, Amount = amount);
    }

    // Gifts use Unpaid/Pending: the org's "*ASL Trigger v2" flow fails on Paid gifts in a test context.
    @IsTest
    static void dashboardAggregatesOnlyTheDonorsOwnGifts() {
        Account maya = createDonor();
        Account other = new Account(Name = 'Someone Else Org');
        insert other;
        Campaign camp = new Campaign(Name = 'Test Xmas', IsActive = true);
        insert camp;
        GiftDesignation water = new GiftDesignation(Name = 'Test Clean Water', IsActive = true);
        GiftDesignation edu = new GiftDesignation(Name = 'Test Education', IsActive = true);
        insert new List<GiftDesignation>{ water, edu };
        createGift(maya, camp, water, 200, Date.newInstance(2024, 3, 1), 'Unpaid');
        createGift(maya, camp, edu, 250, Date.newInstance(2025, 6, 1), 'Pending');
        createGift(maya, camp, edu, 999, Date.newInstance(2025, 7, 1), 'Canceled');
        createGift(other, camp, water, 5000, Date.newInstance(2025, 1, 1), 'Unpaid');
        DonorPortalController.accountIdOverride = maya.Id;

        Test.startTest();
        DonorPortalController.Dashboard d = DonorPortalController.getDashboard();
        Test.stopTest();

        Assert.areEqual(450, d.totalContributions, 'canceled and other donors excluded');
        Assert.areEqual(2, d.causesSupported);
        Assert.areEqual('2024', d.supporterSince);
        Assert.areEqual(2, d.gifts.size());
        Assert.areEqual('Test Education', d.gifts[0].designations, 'newest first');
        Assert.areEqual(3, d.journey.size());
        Assert.areEqual('Joined as a supporter', d.journey[0].label);
        Assert.areEqual('Supported Test Clean Water', d.journey[1].label);
        Assert.areEqual('2025', d.journey[2].year);
        Assert.areEqual('Maya', d.firstName);
    }

    @IsTest
    static void profileCanBeReadAndSaved() {
        Account maya = createDonor();
        DonorPortalController.accountIdOverride = maya.Id;

        Test.startTest();
        DonorPortalController.Profile p = DonorPortalController.getProfile();
        p.phone = '+66 81 234 5678';
        p.city = 'Bangkok';
        p.country = 'Thailand';
        p.email = 'Maya.New@Example.com';
        p.emailOptOut = true;
        DonorPortalController.Profile saved = DonorPortalController.saveProfile(JSON.serialize(p));
        Test.stopTest();

        Assert.areEqual('maya.new@example.com', saved.email);
        Assert.areEqual('+66 81 234 5678', saved.phone);
        Assert.areEqual('Bangkok', saved.city);
        Assert.isTrue(saved.emailOptOut);
    }

    @IsTest
    static void saveProfileValidatesInput() {
        Account maya = createDonor();
        DonorPortalController.accountIdOverride = maya.Id;
        DonorPortalController.Profile p = DonorPortalController.getProfile();
        List<String> bodies = new List<String>{ 'garbage' };
        p.email = 'nope';
        bodies.add(JSON.serialize(p));
        p.email = 'ok@example.com';
        p.lastName = ' ';
        bodies.add(JSON.serialize(p));
        for (String body : bodies) {
            try {
                DonorPortalController.saveProfile(body);
                Assert.fail('expected error');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage());
            }
        }
    }

    @IsTest
    static void businessAccountProfileCannotBeEdited() {
        Account org = new Account(Name = 'Org Donor');
        insert org;
        DonorPortalController.accountIdOverride = org.Id;
        try {
            DonorPortalController.saveProfile('{"firstName":"a","lastName":"b","email":"a@b.co"}');
            Assert.fail('expected error');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('individual'));
        }
    }

    @IsTest
    static void internalUserWithoutDonorAccountIsRejected() {
        try {
            DonorPortalController.getDashboard();
            Assert.fail('expected error');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('sign in'));
        }
    }
}
