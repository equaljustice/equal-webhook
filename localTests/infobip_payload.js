const inputJson = {
    "Employment_type": "{\"payload\":\"On-probation\",\"title\":null,\"type\":\"POSTBACK_RESPONSE\"}",
    "Reason_for_termination_during_probabtion": "{\"payload\":\"Part of mass layoff\",\"title\":null,\"type\":\"POSTBACK_RESPONSE\"}",
    "localkey":"testdata",
    "Nature_of_employment": {
        "payload": "On-probation",
        "title": null,
        "type": "POSTBACK_RESPONSE"
      }
  };
  
  const convertJson = (input) => {
    const output = {};
  
    for (const key in input) {
        if (input.hasOwnProperty(key)) {
          let value = input[key];
    
          // Check if value is a JSON string and try to parse it
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Do nothing if parsing fails, keep the original string value
            }
          }
    
          // If value is an object and contains the 'payload' key, use its value
          if (value && typeof value === 'object' && 'payload' in value) {
            output[key] = value.payload;
          } else {
            // Otherwise, keep the original value
            output[key] = input[key];
          }
        }
      }
    return output;
  };
  
  const outputJson = convertJson(inputJson);
  console.log(JSON.stringify(outputJson, null, 2));