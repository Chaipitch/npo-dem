global class ngo_GenericJSONFormatter {
    
    /**
     * Invocable method that takes a collection of any sObject records
     * and returns a formatted JSON string representation
     * 
     * @param requests Collection of wrapper objects containing sObject records from Flow
     * @return JSON string representing the sObject records
     */
    @InvocableMethod(label='Format sObjects As JSON' 
                    description='Converts a collection of any sObject records to a JSON string')
    global static List<String> formatAsJson(List<FlowInput> requests) {
        List<String> jsonResults = new List<String>();
        
        for (FlowInput request : requests) {
            if (request.records == null || request.records.isEmpty()) {
                jsonResults.add('[]');
                continue;
            }
            
            try {
                // Convert the list of sObject records to JSON
                String jsonString = JSON.serialize(request.records);
                jsonResults.add(jsonString);
            } catch (Exception e) {
                // Handle any serialization errors
                jsonResults.add('{"error": "' + e.getMessage() + '"}');
                System.debug('Error serializing sObject records: ' + e.getMessage());
            }
        }
        
        return jsonResults;
    }
    
    /**
     * Wrapper class for Flow input
     * Allows Flow to pass in a collection of any sObject type
     */
    global class FlowInput {
        @InvocableVariable(required=true description='Collection of sObject records to format as JSON')
        global List<SObject> records;
    }
}