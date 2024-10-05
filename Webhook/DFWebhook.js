import { urbanPincodes } from '../JSONs/urbanPincodes.js';
import * as constants from '../constants.js';
import * as types from '../utils/types.js'
import { logger } from '../utils/logging.js';
import {
    ATMLegalTrainingData, EmployeeTrainingData,
    EmployeeTrainingData_PoliceComplaint, FailedTransactionLegalTrainingData,
    UPILegalTrainingData, FlightsTrainingData
} from "../LegalMaterial/legalTrainingData.js";
import { createLetter } from "../chatGPT/createDocuments.js";

let option = "";
export const createDocWithFineTuned = async (req, res) => {

    try {
        //console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
        let sessionInfo = req.body.sessionInfo;
        option = sessionInfo.parameters.option_for_compliant;
        let userInputData, legalTrainingData;
        var threadId = sessionInfo.parameters.threadId != null ?
            sessionInfo.parameters.threadId : generateSessionId(15);
        const tag = req.body.fulfillmentInfo.tag;
        let textResponse = 'Invalid request';
        let fileURL = '';
        let docName = '';
        let generalData, transactionArray;
        let openAiConfig = {
            model: types.openAIModels.GPT4o,
            temperature: 0.25,
            max_tokens: 2500,
            n: 1,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        }
        switch (tag) {
            case types.transaction.ATM:
                generalData = sessionInfo.parameters.generalData ?
                    await cleanJson(sessionInfo.parameters.generalData) : "";
                transactionArray = sessionInfo.parameters.transactionArray ?
                    cleanJson(sessionInfo.parameters.transactionArray) : "";
                userInputData = { ...generalData, transactionArray: [...transactionArray] };
                userInputData.area_of_user = await pincodeToArea(sessionInfo.parameters.pincode);
                legalTrainingData = ATMLegalTrainingData;

                switch (option) {
                    case types.letterOption.BANK_LETTER:
                    case types.letterOption.BANKING_OMBUDSMAN:
                    case types.letterOption.CONSUMER_COURT:
                        openAiConfig.model = types.openAIModels.FINANCIAL_COMBINED;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.RTI_APPLICATION:
                        if (isPublicSectorBank(generalData.bank_name)) {
                            openAiConfig.temperature = 0.5;
                        } else {
                            textResponse = 'RTI Application is applicable only for Public Sector Banks';

                            res.json({
                                fulfillment_response: {
                                    messages: [{
                                        text: {
                                            text: [textResponse]
                                        }
                                    }]
                                },
                                sessionInfo: {
                                    parameters: { option_for_compliant: null }
                                },
                                targetPage: types.targetpage.ATMLetterOption
                            })
                            return;
                        }
                        break;
                }
                break;
            case types.transaction.UPI:
                userInputData = sessionInfo.parameters ?
                    await cleanJson(sessionInfo.parameters) : "";
                userInputData.area_of_user = await pincodeToArea(sessionInfo.parameters.pincode);
                //console.log('cleaned JSon', userInputData);
                legalTrainingData = UPILegalTrainingData;
                switch (option) {
                    case types.letterOption.BANK_LETTER:
                    case types.letterOption.BANKING_OMBUDSMAN:
                    case types.letterOption.CONSUMER_COURT:
                        openAiConfig.model = types.openAIModels.FINANCIAL_COMBINED;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.RTI_APPLICATION:
                        if (isPublicSectorBank(sessionInfo.parameters.name_of_bank)) {
                            openAiConfig.temperature = 0.5;
                        } else {
                            textResponse = 'RTI Application is applicable only for Public Sector Banks';

                            res.json({
                                fulfillment_response: {
                                    messages: [{
                                        text: {
                                            text: [textResponse]
                                        }
                                    }]
                                },
                                sessionInfo: {
                                    parameters: { option_for_compliant: null }
                                },
                                targetPage: types.targetpage.UPILetterOption
                            })
                            return;
                        }
                        break;
                }
                break;
            case types.transaction.FAILED_TRANSACTION:
                userInputData = sessionInfo.parameters;
                userInputData.area_of_user = await pincodeToArea(sessionInfo.parameters.area_of_user);
                legalTrainingData = FailedTransactionLegalTrainingData;
                switch (option) {
                    case types.letterOption.BANK_LETTER:
                    case types.letterOption.BANKING_OMBUDSMAN:
                    case types.letterOption.CONSUMER_COURT:
                        openAiConfig.model = types.openAIModels.FINANCIAL_COMBINED;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.RTI_APPLICATION:
                        if (isPublicSectorBank(sessionInfo.parameters.name_of_bank)) {
                            openAiConfig.temperature = 0.5;
                        } else {
                            textResponse = 'RTI Application is applicable only for Public Sector Banks';
                            res.json({
                                fulfillment_response: {
                                    messages: [{
                                        text: {
                                            text: [textResponse]
                                        }
                                    }]
                                },
                                sessionInfo: {
                                    parameters: { option_for_compliant: null }
                                },
                                targetPage: types.targetpage.FailedTrLetterOption
                            })
                            return;
                        }
                        break;
                }
                break;
            case types.employee.Retrenchment:
                userInputData = sessionInfo.parameters ?
                    await cleanJson(sessionInfo.parameters) : "";
                logger.info(`DFCX session data: ${JSON.stringify(sessionInfo.parameters)}`);
                legalTrainingData = EmployeeTrainingData;
                switch (option) {
                    case types.letterOption.NOTICE_TO_COMPANY_HR:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.BOARD_OF_DIRECTOR:
                        //openAiConfig.model = types.openAIModels.FAILED_TRANSACTION_OMBUDSMAN;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        legalTrainingData = EmployeeTrainingData_PoliceComplaint;
                        break;
                    case types.letterOption.LABOUR_COURT:
                        //openAiConfig.model = types.openAIModels.FAILED_TRANSACTION_CONSUMER_COURT;
                        break;
                }
                break;
            case types.travel.Flights:
                userInputData = sessionInfo.parameters ?
                    await cleanJson(sessionInfo.parameters) : "";
                console.log("User input data", userInputData);
                legalTrainingData = FlightsTrainingData;
                switch (option) {
                    case types.letterOption.AIRLINE_NODAL_OFFICER:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.AIRLINE_APPELLATE_AUTH:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.AIRLINE_CONSUMER_COURT:
                        openAiConfig.temperature = 0.5;
                        break;
                }
                break;
            default:
                legalTrainingData = '';
                userInputData = sessionInfo.parameters ?
                    await cleanJson(sessionInfo.parameters) : "";
        }

        textResponse = `Creating draft for ${option}. It might take around 1 minute, Please wait`;
        docName = `Draft ${option}`;
        option = option.split(' ').join('_');
        fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + tag + '_' + option + '.docx';
        createLetter(tag, option, userInputData, legalTrainingData, threadId, openAiConfig);

        const responseJson = {
            fulfillment_response: {
                messages: [{
                    text: {
                        text: [textResponse]
                    }
                }]
            },
            sessionInfo: {
                parameters: { threadId, fileURL, docName }
            }
        };
        res.json(responseJson);
    } catch (error) {
        console.log("error in catch", error);
        res.json({
            fulfillment_response: {
                messages: [{
                    text: {
                        text: ["Something went wrong"]
                    }
                }]
            }
        });
    }

};

export function cleanJson(jsonData) {
    try {
        let cleanedJson = JSON.parse(JSON.stringify(jsonData)); // Create a deep copy of the json
        (function _clean(obj) {
            Object.keys(obj).forEach(key => {
                if (obj[key] && typeof obj[key] === 'object') {
                    if (Array.isArray(obj[key])) {
                        obj[key] = obj[key].map(item => {
                            if (typeof item === 'object') {
                                return _clean(item);
                            } else {
                                return item;
                            }
                        });
                    } else {
                        _clean(obj[key]); // Recurse if the value is an object
                    }
                }
                if (obj[key] === 'NA' || obj[key] === null || String(obj[key]).includes('$') || obj[key] == '') {
                    delete obj[key]; // Delete the key if the value is 'NA' or starts with '$'
                }
            });
        })(cleanedJson);
        return cleanedJson;
    } catch (error) {
        console.log(error);
        return jsonData;
    }
}

function pincodeToArea(pincode) {
    try {
        const area = urbanPincodes.includes(Number(pincode.slice(0, 3))) ? "urban" : "rural";
        return area;
    } catch (err) {
        console.log(err)
        return pincode;
    }
}

function isPublicSectorBank(name_of_bank) {
    return ["Bank of Baroda",
        "Bank of India",
        "Bank of Maharashtra",
        "Canara Bank",
        "Central Bank of India",
        "Indian Bank",
        "Indian Overseas Bank",
        "Punjab and Sind Bank",
        "Punjab National Bank",
        "State Bank of India",
        "UCO Bank",
        "Union Bank of India"
    ].includes(name_of_bank)
}

function generateSessionId(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let sessionId = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        sessionId += charset.charAt(randomIndex);
    }

    return sessionId;
}