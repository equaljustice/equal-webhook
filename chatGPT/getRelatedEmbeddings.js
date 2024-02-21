import fs from 'fs';
import OpenAI from "openai";
import similarity from "cosine-similarity";
const openai = new OpenAI({apiKey:'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'});

async function loadEmbeddingsCsv() {
    return new Promise((resolve, reject) => {
      fs.readFile('emboutput.csv', 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          const embeddings = data.split('\n').map(row => {
            const values = row.split(',');
            return {
              qId: values[0],
              Condition: JSON.parse(values[1])
            };
          });
          resolve(embeddings);
        }
      });
    });
  }

async function loadEmbeddings(){
  const jsonData = fs.readFileSync('emboutput.json', 'utf8');
  return JSON.parse(jsonData);
}
  
  // Find most similar embeddings for given key-value pairs
  async function findRelatedEmbeddings(query) {
    const queryEmbedding = getEmbeddings(query);
    const embeddings = await loadEmbeddings();
    const similarities = calculateCosineSimilarity(queryEmbedding['pensionner'], embeddings);

    // Print the similarities
    similarities.forEach((similarity, index) => {
      console.log(`Similarity with condition ${index + 1}: ${similarity}`);
    });

  }
  
  async function getEmbeddings(values) {
    const embeddings = {};
  
    for (const key of Object.keys(values)) {
         embeddings[key] = getKeyEmbeddings(key+":"+[values[key]]);
    }
  
    return embeddings;
  }
  // Get embedding for a key
  async function getKeyEmbeddings(text) {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    return response.data[0].embedding;
  }
  
  // Find most similar embedding from the list based on value
  function findMostSimilar(keyEmbedding, embeddings) {
    const similarities = embeddings.map(embedding => similarity(keyEmbedding, embedding.Condition));
    console.log('similarities :', similarities);
    const maxSimilarity = Math.max(...similarities);
    const index = similarities.indexOf(maxSimilarity);
    return {
      Parameter: embeddings[index],
      Similarity: maxSimilarity
    };
  }

  function calculateCosineSimilarity(queryEmbedding, conditionEmbeddings) {
    const similarities = conditionEmbeddings.map((Condition) => {
      return similarity(queryEmbedding, Condition);
    });
    return similarities;
  }

  
  
  // Example input data
  const inputData = {
    "pensionner": "No"};
  const inputData2 = {
    "pensionner": "No",
    "applied_for_atm": "Yes",
    "withdrawing_regularly_from_atm": "Yes",
    "bank_name": "HDFC Bank",
    "Senior_citizen": "Yes",
    "atm-pin-shared": "No"
  };

  findRelatedEmbeddings(inputData);
