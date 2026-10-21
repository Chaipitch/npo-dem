/**
 * @description Handler class for Program trigger operations
 *              Handles cascading updates to ProgramEnrollment records when Program Name changes
 * @author Salesforce
 * @date 2026
 */
public with sharing class ngo_ProgramTriggerHandler {
    
    /**
     * @description Handles after update trigger context
     *              Updates related ProgramEnrollment Names when Program Name changes
     * @param newPrograms List of new Program records
     * @param oldProgramMap Map of old Program records by Id
     */
    public static void handleAfterUpdate(List<Program> newPrograms, Map<Id, Program> oldProgramMap) {
        // Collect Program IDs where Name has changed
        Set<Id> programIdsWithNameChange = new Set<Id>();
        Map<Id, String> programIdToNewName = new Map<Id, String>();
        
        for (Program prog : newPrograms) {
            Program oldProgram = oldProgramMap.get(prog.Id);
            
            // Check if Name field has changed
            if (prog.Name != oldProgram.Name) {
                programIdsWithNameChange.add(prog.Id);
                programIdToNewName.put(prog.Id, prog.Name);
            }
        }
        
        // If no Name changes, exit early
        if (programIdsWithNameChange.isEmpty()) {
            return;
        }
        
        // Update related Program Enrollments
        updateProgramEnrollmentNames(programIdsWithNameChange, programIdToNewName);
    }
    
    /**
     * @description Updates ProgramEnrollment Names based on new Program Names
     * @param programIds Set of Program IDs that had name changes
     * @param programIdToNewName Map of Program ID to new Program Name
     */
    private static void updateProgramEnrollmentNames(Set<Id> programIds, Map<Id, String> programIdToNewName) {
        // Single SOQL query for all affected Program Enrollments
        List<ProgramEnrollment> enrollmentsToUpdate = [
            SELECT Id, Name, Account.FirstName, Account.LastName, ProgramId
            FROM ProgramEnrollment
            WHERE ProgramId IN :programIds
        ];
        
        // If no enrollments found, exit early
        if (enrollmentsToUpdate.isEmpty()) {
            return;
        }
        
        // Update enrollment names in memory
        for (ProgramEnrollment enrollment : enrollmentsToUpdate) {
            String firstName = enrollment.Account.FirstName != null ? enrollment.Account.FirstName : '';
            String lastName = enrollment.Account.LastName != null ? enrollment.Account.LastName : '';
            String programName = programIdToNewName.get(enrollment.ProgramId);
            
            // Build the new name: "FirstName LastName -- ProgramName"
            enrollment.Name = firstName + ' ' + lastName + ' -- ' + programName;
        }
        
        // Single DML operation for all updates
        try {
            update enrollmentsToUpdate;
        } catch (DmlException e) {
            // Log error and add to first Program record that triggered this
            System.debug(LoggingLevel.ERROR, 'Error updating Program Enrollments: ' + e.getMessage());
            
            // Find the first Program record to add the error message to
            for (Id programId : programIds) {
                Program errorProgram = [SELECT Id FROM Program WHERE Id = :programId LIMIT 1];
                errorProgram.addError('Unable to update related Program Enrollments: ' + e.getMessage());
                break;
            }
        }
    }
}