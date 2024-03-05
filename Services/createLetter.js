import { createLetterWithGPT3_5, createLetterWithGPT4, createLetterwithFineTuned, createMessageContent } from "../chatGPT/completion.js";


export async function createLetter(fraudType, letterOption, userInputData, threadId) {
    try {
        console.log("user Input json", userInputData);
        let promptType = 'ATMFraudBank';
        let textResponse = 'Invalid fraudType or letterOption';
        switch (fraudType) {
            case "ATM":
                switch (letterOption) {
                    case "Bank":
                        promptType = "ATMFraudBank";
                        createMessageContent(promptType, userInputData, threadId);

                        break;
                    case "Banking Ombudsman":
                        promptType = "ATMOmbudsman";
                        createMessageContent(promptType, userInputData, threadId)
                        //  createUserInputParagraph(userInputData,threadId);


                        break;
                    case "Police Complaint":
                        //assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_atm_Police_Compaint_Investigation : assistant_id_atm_Police_complaint;
                        break;
                    case "Consumer court":
                        //assi_id = assistant_id_atm_consumer_court;
                        break;
                    case "RTI Application":
                    promptType = "RTI";
                    createMessageContent(promptType, userInputData, threadId);
                        break;
                }
                break;
            case "UPI":
                switch (letterOption) {
                    case "Bank":
                        //assi_id = assistant_id_upi_bank;
                        break;
                    case "Banking Ombudsman":
                        //assi_id = assistant_id_upi_bank_obdsuman;
                        break;
                    case "Police Complaint":
                        //assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_upi_Police_Compaint_Investigation : assistant_id_upi_Police_complaint;
                        break;
                    case "Consumer court":
                        //assi_id = assistant_id_upi_consumer_court;
                        break;
                    case "RTI Application":
                        //assi_id = assistant_id_upi_RTI;
                        break;
                }
                break;
            case "FAILED TR":
                switch (letterOption) {
                    case "Bank":
                        //assi_id = assistant_id_failed_bank;
                        break;
                    case "Banking Ombudsman":
                        //assi_id = assistant_id_failed_bank_obdsuman;
                        break;
                    case "Police Complaint":
                        //assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_failed_Police_Compaint_Investigation : assistant_id_failed_Police_complaint;
                        break;
                    case "Consumer court":
                        //assi_id = assistant_id_failed_consumer_court;
                        break;
                    case "RTI Application":
                        //assi_id = assistant_id_failed_RTI;
                        break;
                }
            case "ATMGPT4BANK":
                promptType = "ATMFraudBank";
                createLetterWithGPT4(promptType, userInputData, threadId);


                break;
            case "ATMGPT4BANKOmbudsman":
                promptType = "ATMOmbudsman";
                createLetterWithGPT4(promptType, userInputData, threadId);

                break;
        }
       return textResponse;
    } catch (err) {
        console.log(err);
    }
}