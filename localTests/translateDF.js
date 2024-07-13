import { readFileSync, writeFileSync } from 'fs';
import { v2 } from '@google-cloud/translate';
const { Translate } = v2;

// Creates a client
const translate = new Translate();
// Path to the JSON file
const inputFilePath = './JSONs/exported_flow_Routine.json';
const outputFilePath = './exported_flow_Routine_translated.json';

// Load the JSON file
const data = JSON.parse(readFileSync(inputFilePath, 'utf-8'));

// Function to translate text
async function translateText(text, targetLanguage = 'es') {
  let [translations] = await translate.translate(text, targetLanguage);
  return translations;
}

// Recursively translate the values of "text" keys
async function translateJson(obj) {
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (let key in obj) {
      if (key === "text" && typeof obj[key] === 'string') {
        obj[key] = await translateText(obj[key]);
      } else {
        await translateJson(obj[key]);
      }
    }
  } else if (Array.isArray(obj)) {
    for (let item of obj) {
      await translateJson(item);
    }
  }
  return obj;
}

// Translate the JSON data
translateJson(data).then(translatedData => {
  // Save the translated JSON to a new file
  writeFileSync(outputFilePath, JSON.stringify(translatedData, null, 4), 'utf-8');
  console.log(`Translated file saved to: ${outputFilePath}`);
}).catch(err => {
  console.error('Error translating JSON:', err);
});
