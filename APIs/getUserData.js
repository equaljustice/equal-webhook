import { createLetter } from "../Services/createLetter.js";
import { createAssistantThread } from "../chatGPT/assistant-api.js";
import urbanPincodes from '../JSONs/urbanPincodes.json' assert {type: "json"};

const postUserAnswers = async (req, res) => {
    // console.log('Input from API', JSON.stringify(req.body, null, 2));
    let userInputData = convertToKeyValue(req.body.data);
    userInputData.area_of_user = urbanPincodes.includes(Number(userInputData.area_of_user.slice(0, 3))) ? "urban" : "rural";
    var threadId = req.body.threadId != null ?
        req.body.threadId
        : await createAssistantThread();
    createLetter(req.body.fraudType, req.body.letterOption, userInputData, threadId)
    res.send('https://equal-webhook-nh3rcdoxhq-el.a.run.app/' + threadId);
}
const convertToKeyValue = (jsonArray) => {
    const result = {};

    jsonArray.forEach((item) => {
        const { parameter, answer } = item;
        result[parameter] = answer;

        if (item.transactions) {
            const transactions = item.transactions.T0;
            transactions.forEach((transaction) => {
                const { parameter, answer } = transaction;
                result[parameter] = answer;
            });
        }
    });

    return result;
};
export { postUserAnswers };