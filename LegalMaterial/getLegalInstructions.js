
import LegalTrainingATM from '../JSONs/LegalTrainingATM.json' assert {type: "json"}; 

export function getLegalTrainingMaterials(userInputData) {
    const legalTrainingMaterials = [];
  
    for (const key in userInputData) {
      const matchingQuestions = LegalTrainingATM.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === userInputData[key].toLowerCase());
      
      matchingQuestions.forEach(matchingQuestion => {
        legalTrainingMaterials.push(matchingQuestion.LegalTrainingMaterial);
      });
    }
  
    return legalTrainingMaterials;
  }