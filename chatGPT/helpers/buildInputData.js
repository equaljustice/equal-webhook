import * as types from "../../utils/types.js";
import { openAiChatCompletion } from './openAI.js';
import { prompts } from "../prompts.js";

export async function createMessageContent(prompttype, userInputPara, legalTraining) {
    const message = [{
            "role": "system",
            "content": `${prompts[prompttype]}`
        },
        {
            "role": "user",
            "content": `Transaction details:
      ${userInputPara}

      ${legalTraining}`
        }
    ]
    return message;
}

export async function createUserInputParagraph(updatedUserData, transactionType) {
    try {

        //console.log("updatedUserData", updatedUserData);
        let userInputMessage;
        switch (transactionType) {
            case types.transaction.ATM:
                userInputMessage = [{
                        "role": "system",
                        "content": "Your Job is to convert the given Json objects in a simple textual paragraph without sounding like a storyboard"
                    },
                    {
                        "role": "user",
                        "content": `Here is the JSON data related Financial Fraud happend to me. All the transaction amounts are in rupees describe this in simple english language not more than 200 words,
        ${JSON.stringify(updatedUserData, null, 2)}`
                    }
                ];
                break;
            case types.transaction.FAILED_TRANASACTION:

                userInputMessage = [{
                    "role": "user",
                    "content": `convert below json to a textual summary in a paragraph without sounding like a story. only state the facts,
        ${JSON.stringify(updatedUserData, null, 2)}
        All the transaction amounts are in rupees.`
                }];
                break;
            case types.transaction.UPI:

                userInputMessage = [{
                    "role": "user",
                    "content": `convert below json to a textual summary in a paragraph without sounding like a story. only state the facts,
        ${JSON.stringify(updatedUserData, null, 2)}
        All the transaction amounts are in rupees.`
                }];
                break;

        }
        const GPT4Response = await openAiChatCompletion(userInputMessage, types.openAIModels.GPT4);

        return GPT4Response.choices[0].message.content;
    } catch (error) {
        console.log(error);
    }
}

export async function removeKeys(jsonData) {
    let cleanedJson = JSON.parse(JSON.stringify(jsonData)); // Create a deep copy of the json
    (function _clean(obj) {
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    obj[index] = _clean(item);
                });
            } else {
                Object.keys(obj).forEach(key => {
                    if (obj[key] && typeof obj[key] === 'object') {
                        obj[key] = _clean(obj[key]); // Recurse if the value is an object
                    } else if (['senior_citizen', 'pension_savings_account', 'lost_atm',
                            'withdrawn_amount_exceed_daily_limit', 'prior_police_complaint',
                            'transaction_happen_after_informed_bank_of_previous_fraud','senior-citizen',
                            'upi-handle-of-pension-bank-account','last-upi-transaction-more-than-one-year-ago',
                            'transaction-happened-after-block-disable-upi-id','upi-pin-share-with-bank-or-upiapp-officer-at-bank-office',
                            'upi-lost-mobileorsim','upi-simclone', 'user-enabled-geolocation-on-upi-app',
                            'did-the-fraud-amount-exceeded-the-daily-payment-limit',
                            'transaction_happen_after_informed_bank_or_UPIapp_of_previous_fraud'
                        ]
                        .includes(key) && String(obj[key]).toLowerCase() === 'no') {
                        delete obj[key];
                    } else if (['applied_for_atmcard', 'withdrawing_regularly_from_atm',
                            'refund_compensesion_expected', 'domestic_transaction',
                            'transaction_sms_recieved', 'transaction_sms_recieved_within_one_hour',
                            'transaction_email_recieved', 'transaction_email_recieved_within_one_hour',
                            'transaction_from_ATM_in_home_city_or_work_city',
                            'transaction_from_ATM_in_home_city_or_work_city_regularly_withdrawing',
                            'user_created_upi_handle'
                        ]
                        .includes(key) && String(obj[key]).toLowerCase() === 'yes') {
                        delete obj[key]; // Delete the key if the value is 'yes' 
                    } else if (key === 'area_of_user' && String(obj[key]).toLowerCase() === 'urban') { delete obj[key]; } else if (['option_for_compliant'].includes(key)) {
                        delete obj[key];
                    }
                    else if(['pincode', 'transaction-counter', 'option_for_compliant', 'transactionArray',
                            'upi-simclone-telcoinform'].includes(key)){
                        delete obj[key]
                    }
                });
            }
        }
        return obj;
    })(cleanedJson);
    return cleanedJson;
}