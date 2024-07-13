import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
const rootFolder = 'C://Users//Sadhana-PC//Documents//HomeServe//staging-before-ssml//agentTransitionRouteGroups'; // Change this to your root folder path
// Function to recursively search through folders and files
const walkSync = (dir, filelist = []) => {
  readdirSync(dir).forEach(file => {
    const filePath = join(dir, file);
    filelist = statSync(filePath).isDirectory()
      ? walkSync(filePath, filelist)
      : filelist.concat(filePath);
  });
  return filelist;
};

// Function to process and modify JSON files
const processJsonFile = (filePath) => {
  try {
    const data = readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    
    let modified = false;
if(json.transitionRoutes){
    json.transitionRoutes.forEach(route => {
      let hasOutputAudioText = false;
      if(route.triggerFulfillment.messages){
      route.triggerFulfillment.messages.forEach(message => {
        if (message.outputAudioText) {
          hasOutputAudioText = true;
        }
      });
    }
      if (!hasOutputAudioText && route.triggerFulfillment.messages) {
        const textObject = route.triggerFulfillment.messages[0]?.text?.text?.[0];
        if (textObject) {
          const newAudioTextMessage = {
            outputAudioText: {
              ssml: `<speak> ${textObject} </speak>`
            },
            languageCode: "en"
          };
          route.triggerFulfillment.messages.push(newAudioTextMessage);
          modified = true;
        }
      }
      
      // Remove duplicates
      const duplicatetext = removeDuplicateAudioText(route.triggerFulfillment.messages);
      if(duplicatetext){
      route.triggerFulfillment.messages = removeDuplicateAudioText(route.triggerFulfillment.messages);
    }
});
  }
    if (modified) {
      writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`Modified: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
};

// Function to remove duplicate outputAudioText objects from messages array
const removeDuplicateAudioText = (messages) => {
  const seen = new Set();
  if(!messages){return false}
  return messages.filter(message => {
    if (message.outputAudioText) {
      if (seen.has('outputAudioText')) {
        return false;
      } else {
        seen.add('outputAudioText');
      }
    }
    return true;
  });
};

// Main function to start the process
const main = () => {
  const files = walkSync(rootFolder);

  files.forEach(file => {
    if (extname(file) === '.json') {
      processJsonFile(file);
    }
  });

  console.log('Processing completed.');
};

main();
