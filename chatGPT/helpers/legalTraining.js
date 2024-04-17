export async function getLegalTraining(userInputData, legalTrainingData) {
    const result = [];

    const processValue = async(key, value) => {
        if (typeof value === 'object') {

            // If the value is an object (either JSON object or array), process recursively
            for (const key in value) {
                const nestedResult = await getLegalTraining(value[key], legalTrainingData);
                result.push(...nestedResult);
            }
        } else {
            // If the value is not an object, find matching questions

            const matchingQuestions = legalTrainingData.filter(item => item.Parameter.toLowerCase() === key.toLowerCase() && item.Condition.toLowerCase() === value.toLowerCase());
            //console.log('matchingQuestions', matchingQuestions);
            matchingQuestions.forEach(matchingQuestion => {
                result.push(matchingQuestion.LegalTrainingMaterial + `\n\n`);
            });
        }
    };

    for (const key in userInputData) {
        await processValue(key, userInputData[key]);
    }

    return result;
}