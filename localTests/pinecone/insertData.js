import { Pinecone } from '@pinecone-database/pinecone'
import LegalTrainingATM from '../../JSONs/embOutput.json'
const pc = new Pinecone({ apiKey: "59b5ebcc-942b-4a5d-bce7-b778a42056d8" })
const index = pc.index("atm-conditions")

let records = [];

// Loop through the JSON array and transform objects into desired format
for (let i = 0; i < LegalTrainingATM.length; i++) {
  records.push({
    id: LegalTrainingATM[i].qId,
    values: LegalTrainingATM[i].Condition,
    metadata: { "LegalTrainingMaterial": LegalTrainingATM[i].LegalTrainingMaterial }
  });
}



await index.upsert(records);