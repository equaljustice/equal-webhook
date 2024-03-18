import LegalTrainingATM from '../JSONs/LegalTrainingATM.json' assert { type: "json" };
import RBI_laws_failed_txn from '../JSONs/RBI_laws_failed_txn.json' assert { type: "json" };
import { tag } from './Dialogflow-webhook/finFraudwebhooks.js'
export function getLegalTrainingMaterials(userInputData) {
    const legalTrainingMaterials = [];
    for (const key in userInputData) {
        if(tag=="ATM"){
          const matchingQuestions = LegalTrainingATM.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === userInputData[key].toLowerCase());
        } else if(tag=="Failed_txn"){
          const matchingQuestions = LegalTrainingATM.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === userInputData[key].toLowerCase());
        }
        matchingQuestions.forEach(matchingQuestion => {
            legalTrainingMaterials.push(matchingQuestion.LegalTrainingMaterial);
        });
    }

    return legalTrainingMaterials;
}
