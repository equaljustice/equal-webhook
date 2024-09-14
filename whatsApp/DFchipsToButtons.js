export function DFchipsToWAbuttons(DFPayload) {
    const buttons = [];
  
    // Traverse the 'richContent' array to extract options
    const richContent = DFPayload.richContent;
    
    if (Array.isArray(richContent)) {
      richContent.forEach(contentArray => {
        contentArray.forEach(content => {
          if (content.type === 'chips' && content.options && Array.isArray(content.options)) {
            content.options.forEach(option => {
              if (option.text) {
                buttons.push({
                  type: "reply",
                  reply: {
                    id: option.text,
                    title: option.text
                  }
                });
              }
            });
          }
        });
      });
    }
  
    return buttons;
  }

export function DFchipsToButtonOrList(DFPayload){
  let options = [];
  let sections = [];

  // Traverse the 'richContent' array to extract options
  const richContent = DFPayload.richContent;

  if (Array.isArray(richContent)) {
    richContent.forEach(contentArray => {
      contentArray.forEach(content => {
        if (content.type === 'chips' && content.options && Array.isArray(content.options)) {
          content.options.forEach(option => {
            if (option.text) {
              options.push({
                type: "reply",
                reply: {
                  id: trimString(option.text,256),
                  title: trimString(option.text, 20)
                }
              });

              // Add to sections array for large option sets
              sections.push({
                id: trimString(option.text,200),
                title: trimString(option.text,24),
                description: trimString(option.text,72),
              });
            }
          });
        }
        else if (content.type === 'download'){
          options ={
            name: "cta_url",
            parameters: {
                display_text: content.payload.docName,
                url: content.payload.fileURL
            }
        }
        }
      });
    });
  }

  // If there are more than 3 options, convert to the button/sections format
  if (options.length > 3) {
    return {
      button: "Options",
      sections: [
        {
          title: "Choose one option",
          rows: sections
        }
      ]
    };
  }

  // If 3 or fewer options, return the original reply format
  return options;
}

export function trimString(input, charcount) {
  if(input.length < charcount)
    return input;
  const keywordsToRemove =['the', 'and', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 
  'with', 'by', 'about', 'as', 'from', 'that', 'this', 'those', 
  'these', 'or', 'but', 'if', 'then', 'there', 'so', 'such', 'also', 
  'is', 'was', 'are', 'were', 'be', 'being', 'been', 'do', 'does', 
  'did', 'has', 'have', 'had', 'can', 'could', 'will', 'would', 
  'should', 'shall', 'may', 'might', 'must', 'etc'];

  // Remove common keywords
  let words = input.split(' ').filter(word => !keywordsToRemove.includes(word.toLowerCase()));

  // Rebuild the sentence
  let result = words.join(' ');

  // If the result is longer than 20 characters, trim it and add "..."
  if (result.length > charcount) {
      result = result.substring(0, charcount-3) + '...'; // Keeping space for "..."
  }

  return result;
}