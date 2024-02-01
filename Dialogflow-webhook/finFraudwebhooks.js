import { interactWithAssistant } from "../chatGPT/assistant-api.js";
import { processDocx } from "../CloudStorage/processDocs.js";
let assi_id = "";
let option = "";
var responseMessage;
var assistant_id_open_qna = "asst_ldyj4IYjSyywEZPky8GA2V81";
var assistant_id_upi_Police_Compaint_Inestigation = "asst_WiVx7D6lZqsB8FzxdJyxIgkc";
var assistant_id_upi_Police_complaint = "asst_D9rZyFvHQyw6ErXcHfk95PKW";
var assistant_id_upi_bank_obdsuman = "asst_f0QE8GmppBRuWisX2BbC0pfa";
var assistant_id_upi_bank = "asst_BbJlOnqf8iUxliIqzhoZnBaV";
var assistant_id_upi_RTI = "asst_KlbBF280KvlGhBVkSEnWM2fR";
var assistant_id_upi_consumer_court = "asst_QWamYKG49ZwLspcMmwfGz9Xz";
var assistant_id_failed_Police_Compaint_Inestigation = "asst_Z0Ho8Js5ARqES2UZa57i6Q3J";
var assistant_id_failed_Police_complaint = "asst_P51x1vOKAwr9dg2KLDcCSW93";
var assistant_id_failed_bank_obdsuman = "asst_G0kVGeyEEyGjTjxQmELYlvai";
var assistant_id_failed_bank = "asst_fH5wEohrAz74A6dL4bHYpS5x";
var assistant_id_failed_RTI = "asst_WyVP31LavBR40dVXTN9K6kyM";
var assistant_id_failed_consumer_court = "asst_fecdkBrqZdpeSBVe0wvFNojd";
var assistant_id_atm_Police_Compaint_Inestigation = "asst_40JZxhPmD3Ql4AP29X8k7I9M";
var assistant_id_atm_Police_complaint = "asst_CAFGrFNd7y1qgntXtIrvpY4F";
var assistant_id_atm_bank_obdsuman = "asst_GNSQ6pHoSiR3JiPKiCRdSyYN";
var assistant_id_atm_bank = "asst_JXg4cxpxQo0ZukFcQuNs2229";
var assistant_id_atm_RTI = "aasst_cYcV9lF2cCydoSFrv14Iozl7";
var assistant_id_atm_consumer_court = "asst_AC6SXOaB2PgjyaTMF8YlarTh";
var query = "";

export const upi = async (req, res) => {
    console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
    try {

        //responseMessage = "";
        let sessionInfo = req.body.sessionInfo;
        let parameters = sessionInfo.parameters;
        option = sessionInfo.parameters.option_for_compliant;
        var counter = sessionInfo.parameters.counter;
        var police_investigation = sessionInfo.parameters.police_investigation;
        var pop = true;
        var paramsString = JSON.stringify(parameters);
        var threadId = parameters.threadId != null ? parameters.threadId : "";
        console.log("Prameters", paramsString)
        console.log("option", option)
        //feeding the query based upon the requirment
        if (option == null) {
            query = req.body.text;
            pop = false;
            assi_id = assistant_id_open_qna;
        } else if (option === "Bank") {
            query = " User situation Info: " + paramsString;
            temp_doc = "Bank.docx";
            assi_id = assistant_id_upi_bank;
        } else if (option === "Banking Ombudsman") {
            query = " User situation Info:" + paramsString;
            temp_doc = "Banking_Ombudsman.docx";
            assi_id = assistant_id_upi_bank_obdsuman;
        } else if (option === "Police Complaint") {
            if (police_investigation === "Request to thoroughly investigate") {
                query = " User situation Info:" + paramsString;
                temp_doc = "Police_Compliant.docx";
                assi_id = assistant_id_upi_Police_Compaint_Inestigation;
            } else {
                query = " User situation Info:" + paramsString;
                temp_doc = "Police_Compliant.docx";
                assi_id = assistant_id_upi_Police_complaint;
            }
        } else if (option === "Consumer court") {
            query = " User situation Info:" + paramsString;
            temp_doc = "Consumer_Court.docx";
            assi_id = assistant_id_upi_consumer_court;
        } else if (option == "RTI Application") {
            query = "User situation Info:" + paramsString;
            temp_doc = "RTI.docx";
            assi_id = assistant_id_upi_RTI;
        }
        let len = req.body.text.length;
        query += "Charter Limit: Kindly restrict your response within 1500 characters"
        query += "Don't create any source and bold i.e avoid ** and 【7†source】etc"
        if (len > 300 && counter < 12) {
            let response = "It's crossing 300 characters limit, please be within limit"
            responseMessage = { response, threadId };
        } else if (counter == null || counter < 12 && len < 300) {
            responseMessage = await interactWithAssistant(query, threadId, assi_id);
        } else {
            let response = "Your 10 questions are over, Thank you for using our service, hope your issue will be resolved"
            responseMessage = { response, threadId };
        }
        console.log("Response from Assistant:", JSON.stringify(responseMessage));
        const responseJson = {
            fulfillment_response: {
                messages: [{
                    text: {
                        text: [responseMessage.response]
                    }
                }]
            },
            sessionInfo: {
                parameters: { ...parameters, threadId: responseMessage.threadId }
            }
        };
        if (pop == true) { processDocx(responseMessage.response); }
        res.json(responseJson);

    } catch (error) {
        console.error('Error handling the webhook request:', error);
        res.status(500).send('Error processing the request');
    }
}
export const failed_transaction = async (req, res) => {
    console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
    try {

        //responseMessage = "";
        let sessionInfo = req.body.sessionInfo;
        let parameters = sessionInfo.parameters;
        option = sessionInfo.parameters.option_for_compliant;
        var counter = sessionInfo.parameters.counter;
        var police_investigation = sessionInfo.parameters.police_investigation;
        var pop = true;
        let paramsString = JSON.stringify(parameters);
        var threadId = parameters.threadId != null ? parameters.threadId : "";
        console.log("Prameters", paramsString)
        console.log("option", option)
        //feeding the query based upon the requirment
        if (option == null) {
            query = req.body.text;
            pop = false;
            assi_id = assistant_id_open_qna;
        } else if (option === "Bank") {
            query = " User situation Info: " + paramsString;
            temp_doc = "Bank.docx";
            assi_id = assistant_id_failed_bank;
        } else if (option === "Banking Ombudsman") {
            query = " User situation Info:" + paramsString;
            temp_doc = "Banking_Ombudsman.docx";
            assi_id = assistant_id_failed_bank_obdsuman;
        } else if (option === "Police Complaint") {
            if (police_investigation === "Request to thoroughly investigate") {
                query = " User situation Info:" + paramsString;
                temp_doc = "Police_Compliant.docx";
                assi_id = assistant_id_failed_Police_Compaint_Inestigation;
            } else if (option === "RTI Application") {
                query = " User situation Info:" + paramsString;
                temp_doc = "Police_Compliant.docx";
                assi_id = assistant_id_failed_Police_complaint;
            }
        } else if (option === "Consumer court") {
            query = " User situation Info:" + paramsString;
            temp_doc = "Consumer_Court.docx";
            assi_id = assistant_id_failed_consumer_court;
        } else if (option === "RTI Application") {
            query = "User situation Info:" + paramsString;
            temp_doc = "RTI.docx";
            assi_id = assistant_id_failed_RTI;
        }
        console.log("assi_id", assi_id);
        let len = req.body.text.length;
        query += "Charter Limit: Kindly restrict your response within 1500 characters"
        query += "Don't create any source and bold i.e avoid ** and 【7†source】etc"

        if (len > 300 && counter < 12) {
            let response = "It's crossing 300 characters limit, please be within limit"
            responseMessage = { response, threadId };
        } else if (counter == null || counter < 12 && len < 300) {
            responseMessage = await interactWithAssistant(query, threadId, assi_id);
        } else {
            let response = "Your 10 questions are over, Thank you for using our service, hope your issue will be resolved"
            responseMessage = { response, threadId };
        }
        console.log("Response from Assistant:", JSON.stringify(responseMessage));
        const responseJson = {
            fulfillment_response: {
                messages: [{
                    text: {
                        text: [responseMessage.response]
                    }
                }]
            },
            sessionInfo: {
                parameters: { ...parameters, threadId: responseMessage.threadId }
            }
        };
        if (pop == true) { processDocx(responseMessage.response); }
        res.json(responseJson);

    } catch (error) {
        console.error('Error handling the webhook request:', error);
        res.status(500).send('Error processing the request');
    }
}
export const atm = async (req, res) => {
    console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
    try {

        //responseMessage = "";
        let sessionInfo = req.body.sessionInfo;
        let parameters = sessionInfo.parameters;
        option = sessionInfo.parameters.option_for_compliant;
        var counter = sessionInfo.parameters.counter;
        var police_investigation = sessionInfo.parameters.police_investigation;
        var pop = true;
        let paramsString = JSON.stringify(parameters);
        var threadId = parameters.threadId != null ? parameters.threadId : "";
        console.log("Prameters", paramsString);
        console.log("option", option);
        var responseJson ='';
        //feeding the query based upon the requirment
        if (option == null) {
            query = req.body.text;
            pop = false;
            assi_id = assistant_id_open_qna;
            let len = req.body.text.length;
            query += "Charter Limit: Kindly restrict your response within 1500 characters"
            query += "Don't create any source and bold i.e avoid ** and 【7†source】etc"
            if (len > 300 && counter < 12) {
                let response = "It's crossing 300 characters limit, please be within limit"
                responseMessage = { response, threadId };
            } else if (counter == null || counter < 12 && len < 300) {
                responseMessage = await interactWithAssistant(query, threadId, assi_id);
            } else {
                let response = "Your 10 questions are over, Thank you for using our service, hope your issue will be resolved"
                responseMessage = { response, threadId };
            }
            console.log("Response from Assistant:", JSON.stringify(responseMessage));
            responseJson = {
                fulfillment_response: {
                    messages: [{
                        text: {
                            text: [responseMessage.response]
                        }
                    }]
                },
                sessionInfo: {
                    parameters: {...parameters, threadId: responseMessage.threadId }
                }
            };
    
        } else {
            if (option === "Bank") {
                query = " User situation Info: " + paramsString;
                //temp_doc = "Bank.docx";
                assi_id = assistant_id_atm_bank;
            } else if (option === "Banking Ombudsman") {
                query = " User situation Info:" + paramsString;
                temp_doc = "Banking_Ombudsman.docx";
                assi_id = assistant_id_atm_bank_obdsuman;
            } else if (option === "Police Complaint") {
                if (police_investigation === "Request to thoroughly investigate") {
                    query = " User situation Info:" + paramsString;
                    temp_doc = "Police_Compliant.docx";
                    assi_id = assistant_id_atm_Police_Compaint_Inestigation;
                } else {
                    query = " User situation Info:" + paramsString;
                    temp_doc = "Police_Compliant.docx";
                    assi_id = assistant_id_atm_Police_complaint;
                }
            } else if (option === "Consumer court") {
                query = " User situation Info:" + paramsString;
                temp_doc = "Consumer_Court.docx";
                assi_id = assistant_id_atm_consumer_court;
            } else if (option === "RTI Application") {
                query = "User situation Info:" + paramsString;
                temp_doc = "RTI.docx";
                assi_id = assistant_id_atm_RTI;
            }
            console.log("assi_id", assi_id);
            let len = req.body.text.length;
            query += "Charter Limit: Kindly restrict your response within 1500 characters"
            query += "Don't create any source and bold i.e avoid ** and 【7†source】etc"
            if (len > 300 && counter < 12) {
                let response = "It's crossing 300 characters limit, please be within limit"
                responseMessage = { response, threadId };
            } else if (counter == null || counter < 12 && len < 300) {
                responseMessage = interactWithAssistant(query, threadId, assi_id);
            } else {
                let response = "Your 10 questions are over, Thank you for using our service, hope your issue will be resolved"
                responseMessage = { response, threadId };
            }
            console.log("Response from Assistant:", JSON.stringify(responseMessage));
            var filepath = '';
            if (pop == true) { filepath = processDocx(responseMessage.response); }
            responseJson = {
                fulfillment_response: {
                    messages: [{
                        text: {
                            text: ["Creating document please wait"]
                        }
                    }]
                },
                sessionInfo: {
                    parameters: { ...parameters, threadId: responseMessage.threadId, filepath}
                }
            };
        }
        res.json(responseJson);

    } catch (error) {
        console.error('Error handling the webhook request:', error);
        res.status(500).send('Error processing the request');
    }
};
