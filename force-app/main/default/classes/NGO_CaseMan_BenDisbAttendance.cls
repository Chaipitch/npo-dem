public class NGO_CaseMan_BenDisbAttendance {
    
    public static void updateBenefit(BenefitDisbursement bd) {
        BenefitAssignment ba = [SELECT Id, BenefitId FROM BenefitAssignment WHERE Id =: bd.BenefitAssignmentId LIMIT 1];
        Benefit ben = [SELECT Id FROM Benefit WHERE Id =: ba.BenefitId LIMIT 1];
        Integer absent = 0;
        Integer attended = 0;
        List<BenefitDisbursement> bdList = [SELECT Id, DisbursementStatus FROM BenefitDisbursement WHERE BenefitAssignment.BenefitId =: ben.Id];
        for (BenefitDisbursement loopBD : bdList) {
            if (loopBd.DisbursementStatus == 'Attended') {
                attended++;
            } else if (loopBd.DisbursementStatus == 'Unexcused Absent' || loopBd.DisbursementStatus == 'Excused Absent') {
                absent++;
            }
 
        }
                   
            ben.Number_of_Absent_Benefit_Disbursements__c = absent;
            ben.Number_of_Attended_Benefit_Disbursements__c = attended;
        update ben;
    }

    
        public static void updateBenefitSession(BenefitDisbursement bd) {
        BenefitSession bs = [SELECT Id, BenefitScheduleId FROM BenefitSession WHERE Id =: bd.BenefitSessionId LIMIT 1];
        Integer absent = 0;
        Integer attended = 0;
        List<BenefitDisbursement> bdList = [SELECT Id, DisbursementStatus FROM BenefitDisbursement WHERE BenefitSessionId =: bs.Id];
        for (BenefitDisbursement loopBD : bdList) {
            if (loopBd.DisbursementStatus == 'Attended') {
                attended++;
            } else if (loopBd.DisbursementStatus == 'Unexcused Absent' || loopBd.DisbursementStatus == 'Excused Absent') {
                absent++;
            }
 
        }
                   
           bs.NGO_CaseMan_Total_Unattended__c = absent;
           bs.NGO_CaseMan_Total_Attended__c = attended;
        update bs;
    }
    
        public static void updateBenefitSchedule(BenefitDisbursement bd) {
        BenefitSession bs = [SELECT Id, BenefitScheduleId FROM BenefitSession WHERE Id =: bd.BenefitSessionId LIMIT 1];
        BenefitSchedule bsched = [SELECT Id FROM BenefitSchedule WHERE Id =: bs.BenefitScheduleId LIMIT 1];
        Integer absent = 0;
        Integer attended = 0;
        List<BenefitDisbursement> bdList = [SELECT Id, DisbursementStatus FROM BenefitDisbursement WHERE BenefitSession.BenefitScheduleId =: bsched.Id];
        for (BenefitDisbursement loopBD : bdList) {
            if (loopBd.DisbursementStatus == 'Attended') {
                attended++;
            } else if (loopBd.DisbursementStatus == 'Unexcused Absent' || loopBd.DisbursementStatus == 'Excused Absent') {
                absent++;
            }
 
        }
                   
           bsched.Number_of_Absent_Benefit_Disbursements__c = absent;
           bsched.Number_of_Attended_Benefit_Disbursements__c = attended;
        update bsched;
    }
    
            public static void updateProgramEnrollment(BenefitDisbursement bd) {
        ProgramEnrollment pe = [SELECT Id FROM ProgramEnrollment WHERE Id =: bd.ProgramEnrollmentId LIMIT 1];
        Integer absent = 0;
        Integer attended = 0;
        List<BenefitDisbursement> bdList = [SELECT Id, DisbursementStatus FROM BenefitDisbursement WHERE ProgramEnrollmentId =: pe.Id];
        for (BenefitDisbursement loopBD : bdList) {
            if (loopBd.DisbursementStatus == 'Attended') {
                attended++;
            } else if (loopBd.DisbursementStatus == 'Unexcused Absent' || loopBd.DisbursementStatus == 'Excused Absent') {
                absent++;
            }
 
        }
                   
           pe.Number_of_Absent_Benefit_Disbursements__c = absent;
           pe.Number_of_Attended_Benefit_Disbursements__c = attended;
        update pe;
    }

}