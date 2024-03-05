import data from '../JSONs/LegalTrainingATMsample.json' assert {type: "json"}; 
import fs from 'fs';
import OpenAI from "openai";

async function getEmbeddings(text) {
  const openai = new OpenAI(process.env.OPENAI_API_KEY);
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return response.data[0].embedding;
}

async function processQuestions() {
  const processedData = [];

  for (const item of data) {
    const conditionEmbedding = await getEmbeddings(item.Parameter +':'+ item.Condition);
    //const conditionEmbedding = await getEmbeddings(item.Condition);
    //const legalTrainingMaterialEmbedding = await getEmbeddings(item.LegalTrainingMaterial);

    processedData.push({
      qId: item.qId,
      Condition: conditionEmbedding,
      LegalTrainingMaterial: item.LegalTrainingMaterial
    });
  }

  return processedData;
}

async function saveToCSV(data) {
  const csvContent = data.map(item => Object.values(item).join(',')).join('\n');
  fs.writeFileSync('emboutput.csv', csvContent);
  console.log('Data saved to output.csv');
}
const writeOutputJSON = (embeddingsResults) => {
  console.log('Writing data to new .json...');
  const stringifiedJSON = JSON.stringify(embeddingsResults);

  try {
      fs.writeFile('embOutput.json', stringifiedJSON, 'utf-8', () => {
          console.log('Data writing to .json completed.\n');
      });
  } catch (error) {
      console.log('Error while writing .json file.');
      console.log(error);
  }
}

async function main() {
  const processedData = await processQuestions();
  console.log("processedData:", processedData);
  writeOutputJSON(processedData);
  
}

main();
