import LegalTrainingATM from '../JSONs/LegalTrainingATM.json' assert { type: "json" };
import RBI_laws_failed_txn from '../JSONs/RBI_laws_failed_txn.json' assert { type: "json" };
import { tag } from './Dialogflow-webhook/finFraudwebhooks.js'
export function getLegalTrainingMaterials(userInputData) {
    const legalTrainingMaterials = [];
    const matchingQuestions = "";
    for (const key in userInputData) {
      if(promttype=='ATMFraudBank'|| promttype=='ATMOmbudsman'){
                console.log("Got legal material");
              matchingQuestions = LegalTrainingATM.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === userInputData[key].toLowerCase());
            } else if(promttype=='Failed_txn_bank' || promttype=='Failed_txn_Failed_txn_Ombudsman'){
              console.log("Got legal material");
              matchingQuestions = LegalTrainingATM.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === userInputData[key].toLowerCase());
            }
        matchingQuestions.forEach(matchingQuestion => {
            legalTrainingMaterials.push(matchingQuestion.LegalTrainingMaterial);
        });
    }

    return legalTrainingMaterials;
}

       
