import { createAssistantThread, interactWithAssistant } from "../chatGPT/assistant-api.js";
import { processDocx } from "../CloudStorage/processDocs.js";
import { urbanPincodes } from '../JSONs/urbanPincodes.js';
import * as constants from '../constants.js';
import * as types from '../utils/types.js'
import { ATMLegalTrainingData, EmployeeTrainingData, FailedTransactionLegalTrainingData, UPILegalTrainingData } from "../LegalMaterial/legalTrainingData.js";
import { createLetter } from "../chatGPT/createDocuments.js";
let assi_id = "";
let option = "";
var responseMessage;
var assistant_id_open_qna = "asst_ldyj4IYjSyywEZPky8GA2V81";
var assistant_id_upi_Police_Compaint_Investigation = "asst_WiVx7D6lZqsB8FzxdJyxIgkc";
var assistant_id_upi_Police_complaint = "asst_D9rZyFvHQyw6ErXcHfk95PKW";
var assistant_id_upi_bank_obdsuman = "asst_f0QE8GmppBRuWisX2BbC0pfa";
var assistant_id_upi_bank = "asst_BbJlOnqf8iUxliIqzhoZnBaV";
var assistant_id_upi_RTI = "asst_KlbBF280KvlGhBVkSEnWM2fR";
var assistant_id_upi_consumer_court = "asst_QWamYKG49ZwLspcMmwfGz9Xz";
var assistant_id_failed_Police_Compaint_Investigation = "asst_Z0Ho8Js5ARqES2UZa57i6Q3J";
var assistant_id_failed_Police_complaint = "asst_P51x1vOKAwr9dg2KLDcCSW93";
var assistant_id_failed_bank_obdsuman = "asst_G0kVGeyEEyGjTjxQmELYlvai";
var assistant_id_failed_bank = "asst_fH5wEohrAz74A6dL4bHYpS5x";
var assistant_id_failed_RTI = "asst_WyVP31LavBR40dVXTN9K6kyM";
var assistant_id_failed_consumer_court = "asst_fecdkBrqZdpeSBVe0wvFNojd";
var assistant_id_atm_Police_Compaint_Investigation = "asst_40JZxhPmD3Ql4AP29X8k7I9M";
var assistant_id_atm_Police_complaint = "asst_CAFGrFNd7y1qgntXtIrvpY4F";
var assistant_id_atm_bank_obdsuman = "asst_GNSQ6pHoSiR3JiPKiCRdSyYN";
var assistant_id_atm_bank = "asst_JXg4cxpxQo0ZukFcQuNs2229";
var assistant_id_atm_RTI = "aasst_cYcV9lF2cCydoSFrv14Iozl7";
var assistant_id_atm_consumer_court = "asst_AC6SXOaB2PgjyaTMF8YlarTh";
var query = "";
export const openQnA = async (req, res) => {
    //console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
    try {
        let sessionInfo = req.body.sessionInfo;
        var counter = sessionInfo.parameters.counter;
        var threadId = sessionInfo.parameters.threadId != null ? sessionInfo.parameters.threadId : "";
        var responseJson = '';
        //feeding the query based upon the requirment

        query = req.body.text;
        assi_id = assistant_id_open_qna;
        let len = req.body.text.length;
        query += "restrict response to 1500 chars"
        query += "remove annotations from the response"
        if (len > 300 && counter < 12) {
            let response = "It's crossing 300 characters limit, please be within limit"
            responseMessage = { response, threadId };
        } else if (counter == null || counter < 12 && len < 300) {
            responseMessage = await interactWithAssistant(query, threadId, assi_id);
        } else {
            let response = "Your 10 questions are over, Thank you for using our service, hope your issue will be resolved"
            responseMessage = { response, threadId };
        }
        // console.log("Response from Assistant:", JSON.stringify(responseMessage));
        responseJson = {
            fulfillment_response: {
                messages: [{
                    text: {
                        text: [responseMessage.response]
                    }
                }]
            },
            sessionInfo: {
                parameters: { threadId: responseMessage.threadId }
            }
        };


        res.json(responseJson);

    } catch (error) {
        console.error('Error handling the webhook request:', error);
        res.status(500).send('Error processing the request');
    }
};

export const createDocWithAssistant = async (req, res) => {
    //console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
    let sessionInfo = req.body.sessionInfo;
    option = sessionInfo.parameters.option_for_compliant;
    let generalData = sessionInfo.parameters.generalData ?
        JSON.stringify(cleanJson(sessionInfo.parameters.generalData)) :
        "";
    let transitionArray = sessionInfo.parameters.transactionArray ?
        JSON.stringify(cleanJson(sessionInfo.parameters.transactionArray)) :
        "";
    var police_investigation = sessionInfo.parameters.police_investigation;
    query = " User situation data in json object: " + generalData +
        "\nTransactions Details json array: " + transitionArray;
    const tag = req.body.fulfillmentInfo.tag;
    switch (tag) {
        case "ATM":
            switch (option) {
                case "Bank":
                    assi_id = assistant_id_atm_bank;
                    break;
                case "Banking Ombudsman":
                    assi_id = assistant_id_atm_bank_obdsuman;
                    break;
                case "Police Complaint":
                    assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_atm_Police_Compaint_Investigation : assistant_id_atm_Police_complaint;
                    break;
                case "Consumer court":
                    assi_id = assistant_id_atm_consumer_court;
                    break;
                case "RTI Application":
                    assi_id = assistant_id_atm_RTI;
                    break;
            }
            break;
        case "UPI":
            switch (option) {
                case "Bank":
                    assi_id = assistant_id_upi_bank;
                    break;
                case "Banking Ombudsman":
                    assi_id = assistant_id_upi_bank_obdsuman;
                    break;
                case "Police Complaint":
                    assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_upi_Police_Compaint_Investigation : assistant_id_upi_Police_complaint;
                    break;
                case "Consumer court":
                    assi_id = assistant_id_upi_consumer_court;
                    break;
                case "RTI Application":
                    assi_id = assistant_id_upi_RTI;
                    break;
            }
            break;
        case "FAILED TR":
            switch (option) {
                case "Bank":
                    assi_id = assistant_id_failed_bank;
                    break;
                case "Banking Ombudsman":
                    assi_id = assistant_id_failed_bank_obdsuman;
                    break;
                case "Police Complaint":
                    assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_failed_Police_Compaint_Investigation : assistant_id_failed_Police_complaint;
                    break;
                case "Consumer court":
                    assi_id = assistant_id_failed_consumer_court;
                    break;
                case "RTI Application":
                    assi_id = assistant_id_failed_RTI;
                    break;
            }

    }

    var threadId = sessionInfo.parameters.threadId != null ?
        sessionInfo.parameters.threadId :
        await createAssistantThread();
    const responseJson = {
        fulfillment_response: {
            messages: [{
                text: {
                    text: ["Creating document please wait"]
                }
            }]
        },
        sessionInfo: {
            parameters: { threadId }
        }
    };
    res.json(responseJson);

    try {
        //console.log("Query string", query);
        const letterdata = await interactWithAssistant(query, threadId, assi_id);
        processDocx(letterdata.response, threadId, threadId + constants.ASSISTANT);
    } catch (err) {
        console.log(err);
    }
};
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
            model: types.openAIModels.GPT3_5,
            temperature: 0.25,
            max_tokens: 1500,
            n: 1,
            top_p: 1,
            frequency_penalty: 1,
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
                        openAiConfig.model = types.openAIModels.ATM_FRAUD_BANK;
                        break;
                    case types.letterOption.BANKING_OMBUDSMAN:
                        openAiConfig.model = types.openAIModels.ATM_FRAUD_OMBUDSMAN;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.CONSUMER_COURT:
                        openAiConfig.model = types.openAIModels.ATM_FRAUD_CONSUMER_COURT;
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
                        openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_BANK;
                        break;
                    case types.letterOption.BANKING_OMBUDSMAN:
                        openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_OMBUDSMAN;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.CONSUMER_COURT:
                        openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_CONSUMER_COURT;
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
            case types.transaction.FAILED_TRANASACTION:
                userInputData = sessionInfo.parameters;
                userInputData.area_of_user = await pincodeToArea(sessionInfo.parameters.area_of_user);
                legalTrainingData = FailedTransactionLegalTrainingData;
                switch (option) {
                    case types.letterOption.BANK_LETTER:
                        openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_BANK;
                        break;
                    case types.letterOption.BANKING_OMBUDSMAN:
                        openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_OMBUDSMAN;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.CONSUMER_COURT:
                        openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_CONSUMER_COURT;
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
                console.log("User input data", userInputData);
                legalTrainingData = EmployeeTrainingData;
                switch (option) {
                    case types.letterOption.NOTICE_TO_COMPANY_HR:
                         openAiConfig.temperature = 0.5;
                        // openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_BANK;
                        break;
                    case types.letterOption.BORD_OF_DIRECTOR:
                        //openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_OMBUDSMAN;
                        break;
                    case types.letterOption.POLICE_COMPLAINT:
                        openAiConfig.temperature = 0.5;
                        break;
                    case types.letterOption.LABOUR_COURT:
                        //openAiConfig.model = types.openAIModels.FAILED_TRANASACTION_CONSUMER_COURT;
                        break;
                    case types.letterOption.RTI_APPLICATION:
                        //openAiConfig.model =
                        break;
                }
                break;

        }

        textResponse = `Creating ${option}, Please wait`;
        docName = `${option}`;
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
                if (obj[key] === 'NA' || obj[key] === null || String(obj[key]).includes('$')) {
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