trigger NGO_CaseMan_Referral_Trigger on Referral (before insert) {
    
    for (Referral ref : trigger.new) {
        IF (ref.ClientId <> null) {
            Account client = [SELECT Id, PersonEmail, Name, Phone FROM Account WHERE Id =: ref.ClientId LIMIT 1];
                ref.ClientEmail = client.PersonEmail;
            	ref.ReferralDate = date.today();
            	ref.Status = 'New';
        }
        IF (ref.ProviderId <> null) {
            Account prov = [SELECT Id, PersonEmail, Name, Phone FROM Account WHERE Id =: ref.ProviderId LIMIT 1];
            ref.ProviderEmail = prov.PersonEmail;
            ref.ProviderName = prov.Name;
            ref.ProviderPhone = prov.Phone;
        }
        
        IF (ref.ReferrerId <> null) {
            Account refer = [SELECT Id, PersonEmail, Name, Phone FROM Account WHERE Id =: ref.ReferrerId LIMIT 1];
            ref.ReferrerEmail = refer.PersonEmail;
            ref.ReferrerName = refer.Name;
            ref.ReferrerPhone = refer.Phone;
        }
    }

}