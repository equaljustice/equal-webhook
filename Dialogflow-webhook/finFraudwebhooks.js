import { createAssistantThread, interactWithAssistant } from "../chatGPT/assistant-api.js";
import { processDocx } from "../CloudStorage/processDocs.js";
import { createLetterWithGPT3_5, createLetterWithGPT4, 
    createBankLetterwithFineTuned, createUserInputParagraph, createOmbudsmanLetterwithFineTuned } from "../chatGPT/completion.js";
import urbanPincodes from '../JSONs/urbanPincodes.json' assert {type: "json"};
import * as constants from '../constants.js';
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
        JSON.stringify(cleanJson(sessionInfo.parameters.generalData))
        : "";
    let transitionArray = sessionInfo.parameters.transactionArray ?
        JSON.stringify(cleanJson(sessionInfo.parameters.transactionArray))
        : "";
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
        sessionInfo.parameters.threadId
        : await createAssistantThread();
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
    //console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
    let sessionInfo = req.body.sessionInfo;
    let letterType = "ATMFraudBank";
    option = sessionInfo.parameters.option_for_compliant;
    let generalData = sessionInfo.parameters.generalData ?
        cleanJson(sessionInfo.parameters.generalData)
        : "";
    let transactionArray = sessionInfo.parameters.transactionArray ?
        cleanJson(sessionInfo.parameters.transactionArray)
        : "";
    var police_investigation = sessionInfo.parameters.police_investigation;
    generalData.area_of_user = urbanPincodes.includes(Number(generalData.area_of_user.slice(0, 3))) ? "urban" : "rural";
    var threadId = sessionInfo.parameters.threadId != null ?
        sessionInfo.parameters.threadId
        : await createAssistantThread();
    let userInputData = { ...generalData, transactionArray: [...transactionArray] };
    const tag = req.body.fulfillmentInfo.tag;
    let textResponse = 'Not valid request';
    switch (tag) {
        case "ATM":
            switch (option) {
                case "Bank":
                    letterType = "ATMFraudBank";
                    try {
                        //console.log("user Input json", userInputData);
                        createBankLetterwithFineTuned(letterType, userInputData, threadId);
                        createLetterWithGPT3_5(letterType, userInputData, threadId);
                        textResponse = 'Creating Bank Letter';
                    } catch (err) {
                        console.log(err);
                    }
                    break;
                case "Banking Ombudsman":
                    letterType = "ATMOmbudsman";
                    try {
                        // console.log("user Input json", userInputData);
                        createLetterWithGPT3_5(letterType, userInputData, threadId);
                        createOmbudsmanLetterwithFineTuned(letterType, userInputData, threadId);
                        textResponse = 'Creating Banking Ombudsman letter'
                    } catch (err) {
                        console.log(err);
                    }
                    break;
                case "Police Complaint":
                    assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_atm_Police_Compaint_Investigation : assistant_id_atm_Police_complaint;
                    break;
                case "Consumer court":
                    assi_id = assistant_id_atm_consumer_court;
                    break;
                case "RTI Application":
                    if (["Bank of Baroda",
                        "Bank of India",
                        "Bank of Maharashtra",
                        "Canara Bank",
                        "Central Bank of India",
                        "Indian Bank",
                        "Indian Overseas Bank",
                        "Punjab & Sind Bank",
                        "Punjab National Bank",
                        "State Bank of India",
                        "UCO Bank",
                        "Union Bank of India"].includes(generalData.bank_name)) {
                        letterType = 'RTI'
                        createLetterWithGPT4(letterType, userInputData, threadId)
                        textResponse = 'Creating RTI Application'
                        
                    }
                    else textResponse = 'RTI Application is applicable only for Public Sector Banks';
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
        case "ATMGPT4BANK":
            letterType = "ATMFraudBank";
            try {
                createLetterWithGPT4(letterType, userInputData, threadId);
                textResponse = 'Creating Document'
            } catch (err) {
                console.log(err);
            }
            break;
        case "ATMGPT4BANKOmbudsman":
            letterType = "ATMOmbudsman";
            try {
                createLetterWithGPT4(letterType, userInputData, threadId);
                textResponse = 'Creating Document'
            } catch (err) {
                console.log(err);
            }
    }


    const responseJson = {
        fulfillment_response: {
            messages: [{
                text: {
                    text: [textResponse]
                }
            }]
        },
        sessionInfo: {
            parameters: { threadId }
        }
    };
    res.json(responseJson);


};
function cleanJson2(json) {
    try {
        //json = json.replace(/\\/g, "");
        let cleanedJson = JSON.parse(JSON.stringify(json)); // Create a deep copy of the json
        (function _clean(obj) {
            Object.keys(obj).forEach(key => {
                if (obj[key] && typeof obj[key] === 'object' || typeof obj === '') _clean(obj[key]); // Recurse if the value is an object
                else if (obj[key] === 'NA' || String(obj[key]).includes('$')) delete obj[key]; // Delete the key if the value is 'NA' or starts with '$'
            });
        })(cleanedJson);
        return cleanedJson;
    } catch (err) {
        return "";
    }
}

export function cleanJson(jsonData) {
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
            if (obj[key] === 'NA' || String(obj[key]).includes('$')) {
                delete obj[key]; // Delete the key if the value is 'NA' or starts with '$'
            }
        });
    })(cleanedJson);
    return cleanedJson;
}

