import { createLetterWithGPT3_5, createLetterWithGPT4, createLetterwithFineTuned, createUserInputParagraph } from "../chatGPT/completion.js";


export async function createLetter(fraudType, letterOption, userInputData, threadId) {
    try {
        console.log("user Input json", userInputData);
        let letterType = 'ATMFraudBank';
        let textResponse = '';
        switch (fraudType) {
            case "ATM":
                switch (letterOption) {
                    case "Bank":
                        letterType = "ATMFraudBank";
                        createLetterwithFineTuned(letterType, userInputData, threadId);
                        createLetterWithGPT3_5(letterType, userInputData, threadId)
                        textResponse = 'Creating Document'

                        break;
                    case "Banking Ombudsman":
                        letterType = "ATMOmbudsman";
                        createLetterWithGPT3_5(letterType, userInputData, threadId)
                        //  createUserInputParagraph(userInputData,threadId);
                        textResponse = 'Creating Document'

                        break;
                    case "Police Complaint":
                        //assi_id = (police_investigation === "Request to thoroughly investigate") ? assistant_id_atm_Police_Compaint_Investigation : assistant_id_atm_Police_complaint;
                        break;
                    case "Consumer court":
                        //assi_id = assistant_id_atm_consumer_court;
                        break;
                    case "RTI Application":
                        
                        textResponse = await createUserInputParagraph(userInputData,threadId);
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
                letterType = "ATMFraudBank";
                createLetterWithGPT4(letterType, userInputData, threadId);
                textResponse = 'Creating Document'

                break;
            case "ATMGPT4BANKOmbudsman":
                letterType = "ATMOmbudsman";
                createLetterWithGPT4(letterType, userInputData, threadId);
                textResponse = 'Creating Document'
                break;
        }


        return textResponse;
    } catch (err) {
        console.log(err);
    }
}