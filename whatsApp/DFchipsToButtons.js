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
                  id: trimString(option.text, 256),
                  title: trimString(option.text, 20)
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

export function DFchipsToButtonOrList(DFPayload) {
  let options = [];
  let sections = [];
  let ctaUrlFound = false;

  // ⚡ VALIDATION: Check if DFPayload has expected structure
  if (!DFPayload || !DFPayload.richContent || !Array.isArray(DFPayload.richContent)) {
    console.warn('Invalid DFPayload structure:', DFPayload);
    return [];
  }

  // Traverse the 'richContent' array to extract options
  const richContent = DFPayload.richContent;

  // ⚡ FIRST PASS: Check for CTA URL content (download/info types take precedence)
  for (const contentArray of richContent) {
    if (!Array.isArray(contentArray)) {
      console.warn('Expected contentArray to be array, got:', typeof contentArray);
      continue;
    }
    
    for (const content of contentArray) {
      if (content.type === 'download') {
        // ⚡ FIX: Validate download content structure
        if (!content.payload || !content.payload.fileURL || !content.payload.docName) {
          console.error('Invalid download payload structure:', content.payload);
          continue;
        }
        
        // ⚡ FIX: Validate URL format (must be HTTPS)
        try {
          const urlObj = new URL(content.payload.fileURL);
          if (urlObj.protocol !== 'https:') {
            console.error('Download URL must use HTTPS:', content.payload.fileURL);
            continue;
          }
        } catch (urlError) {
          console.error('Invalid download URL format:', content.payload.fileURL, urlError.message);
          continue;
        }
        
        // ⚡ FIX: Return CTA URL with proper structure immediately
        const ctaOption = {
          name: "cta_url",
          parameters: {
            display_text: trimString(content.payload.docName, 20),
            url: content.payload.fileURL
          }
        };
        
        console.log('CTA URL option created from download:', ctaOption);
        return ctaOption;
      }
      else if (content.type === 'info' && content.actionLink) {
        // ⚡ NEW: Handle 'info' type with actionLink (used in payment flow)
        try {
          const urlObj = new URL(content.actionLink);
          if (urlObj.protocol !== 'https:') {
            console.error('Info actionLink must use HTTPS:', content.actionLink);
            continue;
          }
          
          const ctaOption = {
            name: "cta_url",
            parameters: {
              display_text: trimString(content.title || 'Download', 20),
              url: content.actionLink
            }
          };
          
          console.log('CTA URL option created from info:', ctaOption);
          return ctaOption;
          
        } catch (urlError) {
          console.error('Invalid info actionLink format:', content.actionLink, urlError.message);
          continue;
        }
      }
    }
  }
  
  // ⚡ SECOND PASS: Process chips/buttons if no CTA URL found
  richContent.forEach(contentArray => {
    if (!Array.isArray(contentArray)) return;
    
    contentArray.forEach(content => {
      if (content.type === 'chips' && content.options && Array.isArray(content.options)) {
        content.options.forEach((option, index) => {
          if (option.text) {
            options.push({
              type: "reply",
              reply: {
                id: trimString(option.text, 256),
                title: trimString(option.text, 20)
              }
            });

            // Add to sections array for large option sets
            sections.push({
              id: trimString(option.text, 24),
              title: index + 1,
              description: trimString(option.text, 72),
            });
          }
        });
      }
    });
  });

  // If there are more than 3 options, convert to the button/sections format
  if (options.length > 3 && options.length < 10) {
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
  else if(options.length > 10){
    return {
      button: "Options",
      sections: [
        {
          title: "Choose one option",
          rows: sections.slice(0,10),
        }
      ]
    };
  }
  return options;
}

export function trimString(input, charcount) {
  if (input.length < charcount)
    return input;
  const keywordsToRemove = ['the', 'and', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for',
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
    result = result.substring(0, charcount - 3) + '...'; // Keeping space for "..."
  }

  return result;
}
