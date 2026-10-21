trigger NGO_CaseMan_BenDisbTrigger on BenefitDisbursement (after insert, after update) {

    for (BenefitDisbursement bd : trigger.new) {
        if (bd.DisbursementStatus == 'Attended' || bd.DisbursementStatus == 'Unexcused Absent' || bd.DisbursementStatus == 'Excused Absent') {
            NGO_CaseMan_BenDisbAttendance.updateBenefit(bd);
            NGO_CaseMan_BenDisbAttendance.updateProgramEnrollment(bd);
            
            if(bd.BenefitSessionId <> null) {
                NGO_CaseMan_BenDisbAttendance.updateBenefitSession(bd);
                NGO_CaseMan_BenDisbAttendance.updateBenefitSchedule(bd);
            }
        }
    }
}