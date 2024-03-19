import { createAssistantThread, interactWithAssistant } from "../chatGPT/assistant-api.js";
import { processDocx } from "../CloudStorage/processDocs.js";
import {
    createLetterWithGPT3_5,
    createLetterWithGPT4,
    createBankLetterwithFineTuned,
    createUserInputParagraph,
    createOmbudsmanLetterwithFineTuned,
    createConsumerCourtLetterwithFineTuned,
    createBankLetterwithFineTunedFailedtxnbank,
    createOmbudsmanLetterwithFineTunedFailedtxnOmbudsman,
    createLetterWithGPT3_5_Failed_txn
} from "../chatGPT/completion.js";
import urbanPincodes from '../JSONs/urbanPincodes.json' assert { type: "json" };
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
export const openQnA = async(req, res) => {
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

export const createDocWithAssistant = async(req, res) => {
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
export const createDocWithFineTuned = async(req, res) => {
        try {
            //console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
            let sessionInfo = req.body.sessionInfo;
            let letterType = "";
            let targetPage;
            option = sessionInfo.parameters.option_for_compliant;

            var police_investigation = sessionInfo.parameters.police_investigation;

            var threadId = sessionInfo.parameters.threadId != null ?
                sessionInfo.parameters.threadId :
                await createAssistantThread();
            let userInputData = sessionInfo.parameters;
            const tag = req.body.fulfillmentInfo.tag;
            let textResponse = 'Not valid request';
            let fileURL = '';
            let docName = '';
            let generalData = sessionInfo.parameters.generalData ?
                    cleanJson(sessionInfo.parameters.generalData) :
                    "";
            console.log(userInputData);
            console.log(tag);
            switch (tag) {
                case "ATM":
                    let transactionArray = sessionInfo.parameters.transactionArray ?
                        cleanJson(sessionInfo.parameters.transactionArray) :
                        "";
                    
                    generalData.area_of_user = urbanPincodes.includes(Number(generalData.area_of_user.slice(0, 3))) ? "urban" : "rural";
                    userInputData = {...generalData, transactionArray: [...transactionArray] };
                    
                    switch (option) {
                        case "Bank":
                            letterType = "ATMFraudBank";

                            //console.log("user Input json", userInputData);
                            createBankLetterwithFineTuned(letterType, userInputData, threadId);
                            //createLetterWithGPT3_5(letterType, userInputData, threadId);
                            textResponse = 'Creating Bank Letter, Please wait';
                            docName = 'Bank letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5_FINE_TUNED + letterType + '.docx';

                            break;
                        case "Banking Ombudsman":
                            letterType = "ATMOmbudsman";

                            createOmbudsmanLetterwithFineTuned(letterType, userInputData, threadId);
                            textResponse = 'Creating Banking Ombudsman letter, Please wait'
                            docName = 'Banking Ombudsman letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5_FINE_TUNED + letterType + '.docx';

                            break;
                        case "Police Complaint":
                            letterType = "PoliceComplaint";

                            createLetterWithGPT3_5(letterType, userInputData, threadId);
                            textResponse = 'Creating Police Complaint, Please wait'
                            docName = 'Police Complaint letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5 + letterType + '.docx';
                            break;
                        case "Consumer court":
                            letterType = "ConsumerCourt";

                            createConsumerCourtLetterwithFineTuned(letterType, userInputData, threadId);
                            textResponse = 'Creating Consumer Court letter, Please wait'
                            docName = 'Consumer Court letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5_FINE_TUNED + letterType + '.docx';

                            break;
                        case "RTI Application":
                            if (["Bank of Baroda",
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
                                ].includes(generalData.bank_name)) {
                                letterType = 'RTI'
                                createLetterWithGPT3_5(letterType, userInputData, threadId)
                                textResponse = 'Creating RTI Application, Please wait'
                                docName = 'RTI letter';
                                fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5 + letterType + '.docx';


                            } else {
                                textResponse = 'RTI Application is applicable only for Public Sector Banks';
                                let targetPage = "projects/atmprebuiltagent/locations/asia-south1/agents/9d9f910c-d14b-4489-b1f9-98c6c3e67c61/flows/aa979626-23c2-4a9c-b456-45403d2dbf61/pages/43328113-8eb4-4cd5-911a-40700ad78d5c";
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
                                    targetPage
                                })
                                return;
                            }
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
                case "FAILED_TXN":
                    generalData.area_of_user = urbanPincodes.includes(Number(generalData.area_of_user.slice(0, 3))) ? "urban" : "rural";
                    console.log(generalData.area_of_user);
                    switch (option) {

                        case "Bank":
                            
                            letterType = "Failed_txn_Bank";

                            //console.log("user Input json", userInputData);
                            createBankLetterwithFineTunedFailedtxnbank(letterType, userInputData, threadId);
                            //createLetterWithGPT3_5(letterType, userInputData, threadId);
                            textResponse = 'Creating Bank Letter, Please wait';
                            docName = 'Bank letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5_FINE_TUNED + letterType + '.docx';

                            break;
                        case "Banking Ombudsman":
                            letterType = "Failed_txn_Ombudsman";

                            createOmbudsmanLetterwithFineTunedFailedtxnOmbudsman(letterType, userInputData, threadId);
                            textResponse = 'Creating Banking Ombudsman letter, Please wait'
                            docName = 'Banking Ombudsman letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5_FINE_TUNED + letterType + '.docx';

                            break;
                        case "Police Complaint":
                            letterType = "PoliceComplaint";
                            createLetterWithGPT3_5_Failed_txn(letterType, userInputData, threadId);
                            textResponse = 'Creating Police Complaint, Please wait'
                            docName = 'Police Complaint letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5 + letterType + '.docx';
                            break;
                        case "Consumer court":
                            letterType = "ConsumerCourt";

                            createConsumerCourtLetterwithFineTuned(letterType, userInputData, threadId);
                            textResponse = 'Creating Consumer Court letter, Please wait'
                            docName = 'Consumer Court letter';
                            fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5_FINE_TUNED + letterType + '.docx';

                            break;
                        case "RTI Application":
                            if (["Bank of Baroda",
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
                                ].includes(sessionInfo.parameters.name_of_bank)) {
                                letterType = 'RTI'
                                createLetterWithGPT3_5_Failed_txn(letterType, userInputData, threadId)
                                textResponse = 'Creating RTI Application, Please wait'
                                docName = 'RTI letter';
                                fileURL = constants.PUBLIC_BUCKET_URL + '/' + threadId + '/' + threadId + constants.GPT3_5 + letterType + '.docx';


                            } else {
                                textResponse = 'RTI Application is applicable only for Public Sector Banks';
                                let targetPage = "projects/atmprebuiltagent/locations/asia-south1/agents/9d9f910c-d14b-4489-b1f9-98c6c3e67c61/flows/aa979626-23c2-4a9c-b456-45403d2dbf61/pages/43328113-8eb4-4cd5-911a-40700ad78d5c";
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
                                    targetPage
                                })
                                return;
                            }
                            break;
                        case "ATMGPT4BANK":
                            letterType = "ATMFraudBank";
                            createLetterWithGPT4(letterType, userInputData, threadId);
                            textResponse = 'Creating Document'
                            break;
                        case "ATMGPT4BANKOmbudsman":
                            letterType = "ATMOmbudsman";
                            createLetterWithGPT4(letterType, userInputData, threadId);
                            textResponse = 'Creating Document'
                            break;
                        case "ATMGPT4BANK":
                            letterType = "Failed_txn_Bank";
                            createLetterWithGPT4(letterType, userInputData, threadId);
                            textResponse = 'Creating Document'
                            break;
                        case "ATMGPT4BANKOmbudsman":
                            letterType = "Failed_txn_Ombudsman";
                            createLetterWithGPT4(letterType, userInputData, threadId);
                            textResponse = 'Creating Document'

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
                            parameters: { threadId, fileURL, docName }
                        }
                    };
                    res.json(responseJson);
            }
             catch (error) {
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