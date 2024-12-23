  export function convertProtobufToJson(protobufJson) {
    function convertValue(value) {
      switch (value.kind) {
        case 'stringValue':
          return value.stringValue;
        case 'numberValue':
          return value.numberValue;
        case 'boolValue':
          return value.boolValue;
        case 'listValue':
          return value.listValue.values.map(item => convertValue(item));
        case 'structValue':
          return convertProtobufToJson(value.structValue);
        default:
          return null; // Handle unsupported types or missing kinds
      }
    }
  
    const normalJson = {};
  
    for (const key in protobufJson.fields) {
      if (protobufJson.fields.hasOwnProperty(key)) {
        normalJson[key] = convertValue(protobufJson.fields[key]);
      }
    }
    return normalJson;
  }
  
  