// code by Jessie Rymph
// January 20, 2023
// TO DO: Make part of the spin up process. run AFTER demo boost.
// Look at swift set up for how to schedule npsp triggers for 30 min after it runs. 
// SEs will run demo boost again day of the demo.
// we will need a VF page with a button. 
public class ngo_programs_base_Benefits_rollup{
    
    static integer currentYear = Date.Today().year();
    static integer previousYear= currentYear - 1;
    static integer currentMonth = Date.Today().month();
    static integer previousMonth = currentMonth - 1;
    
    public static void rollUpBenefits () {
        List<Benefit> updatedBenefits = new List<Benefit>();
        
        List<Benefit> ourBenefits = [SELECT Id, 
                                     (SELECT DisbursedQuantity, ActualCompletionDate FROM Benefit_Disbursements__r
                                      WHERE Calendar_Year(ActualCompletionDate) >= :previousYear),
                                     (SELECT EnrollmentCount, StartDateTime FROM BenefitAssignmentBenefits
                                      WHERE Calendar_Year(StartDateTime) >= :previousYear)
                                     FROM Benefit];
        
        
        
        for (Benefit benny : ourBenefits) {
            decimal cY = 0;
            decimal pY = 0;
            decimal cM = 0;
            decimal pM = 0;
            (system.debug('entered first loop'));
                for (BenefitDisbursement benD : benny.benefit_disbursements__r) {
                    if(benD.ActualCompletionDate.year() == currentyear) {
                        
                        if (benD.ActualCompletionDate.month() == currentmonth) {
                            cM= benD.disbursedQuantity + cM;
                            //system.debug('cm'+cm);
                            CY = benD.DisbursedQuantity + cY;
                        } else  {
                            CY = benD.DisbursedQuantity + cY;}
                        system.debug('cy'+cY);
                    }
                    
                    
                    else if ((previousMonth == 0 && benD.ActualCompletionDate.year() == previousyear && 
                              benD.ActualCompletionDate.month()==12) 
                             
                             ||
                             (benD.ActualCompletionDate.month() == previousmonth))
                    {
                        pM = benD.disbursedQuantity + pM;
                        system.debug('pm'+pm);
                        pY = benD.DisbursedQuantity + pY;
                    }
                    
                    
                    else {
                        pY = benD.DisbursedQuantity + pY;
                    }
                    system.debug('pm'+pm);
                    benny.PreviousMonthDisbursedQty = pm;
                    benny.CurrentMonthDisbursedQty = cm;
                    benny.CurrentYearDisbursedQty = cy;
                    benny.PreviousYearDisbursedQty = py;
                }
            
            //updatedBenefits.add(benny);
            decimal cYA = 0;
            decimal pYA = 0;
            for (BenefitAssignment benA : benny.benefitAssignmentBenefits) {
                if(benA.StartDateTime.year() == currentyear) {
                    
                    CYA = benA.enrollmentCount + cYA;
                }
                
                else {
                    pYA = benA.enrollmentCount + pYA;
                }
                
                benny.CurrentYearAssignedQty = cyA;
                benny.PreviousYearAssignedQty = pyA;
            }
            updatedBenefits.add(benny);
            
        } update updatedBenefits;
        system.debug(updatedBenefits);
    }
    
    public static void rollUpProgramEnrollments () {
        List<ProgramEnrollment> updatedPEs = new List<ProgramEnrollment>();
        
        List<ProgramEnrollment> allPEs = [SELECT Id, 
                                          (SELECT DisbursedQuantity, ActualCompletionDate FROM BenefitDisbursementPE
                                           WHERE Calendar_Year(ActualCompletionDate) >= :previousYear)
                                          FROM ProgramEnrollment];
        for (ProgramEnrollment myPE : allPEs) {
            decimal cY = 0;
            decimal pY = 0;
            decimal cM = 0;
            decimal pM = 0;
            (system.debug('entered first loop'));
                for (BenefitDisbursement benD : myPE.benefitdisbursementPE) {
                    if(benD.ActualCompletionDate.year() == currentyear) {
                        
                        if (benD.ActualCompletionDate.month() == currentmonth) {
                            cM= benD.disbursedQuantity + cM;
                            //system.debug('cm'+cm);
                            CY = benD.DisbursedQuantity + cY;
                        } else  {
                            CY = benD.DisbursedQuantity + cY;}
                        system.debug('cy'+cY);
                    }
                    
                    
                    else if ((previousMonth == 0 && benD.ActualCompletionDate.year() == previousyear && 
                              benD.ActualCompletionDate.month()==12) 
                             
                             ||
                             (benD.ActualCompletionDate.month() == previousmonth))
                    {
                        pM = benD.disbursedQuantity + pM;
                        system.debug('pm'+pm);
                        pY = benD.DisbursedQuantity + pY;
                    }
                    
                    
                    else {
                        pY = benD.DisbursedQuantity + pY;
                    }
                    system.debug('pm'+pm);
                    myPE.PreviousMonthDisbCount = pm;
                    myPE.CurrentMonthDisbCount = cm;
                    myPE.CurrentYearDisbCount = cy;
                    myPE.PreviousYearDisbCount = py;
                }
            
            updatedPEs.add(myPE);
        }
        update updatedPEs;
        
    }
    
}