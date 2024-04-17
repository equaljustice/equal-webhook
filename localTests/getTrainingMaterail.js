import LegalTrainingATM from '../JSONs/LegalTrainingATM.js'
  
  const inputJson = {"senior-citizen": "yes", "pensionner": "yes", "tr-sms":"No"};
  
  export function getLegalTrainingMaterials(input, data) {
    const legalTrainingMaterials = [];
  
    for (const key in input) {
      const matchingQuestions = data.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === input[key].toLowerCase());
      
      matchingQuestions.forEach(matchingQuestion => {
        legalTrainingMaterials.push(matchingQuestion.LegalTrainingMaterial);
      });
    }
  
    return legalTrainingMaterials;
  }
  
  const result = getLegalTrainingMaterials(inputJson, LegalTrainingATM);
  console.log("Legal Training Materials:", result);
  