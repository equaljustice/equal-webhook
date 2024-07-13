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
            "content": `Details:
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
            case types.employee.Retrenchment:

                userInputMessage = [{
                    "role": "user",
                    "content": `convert below json to a textual summary in a paragraph without sounding like a story. only state the facts,
        ${JSON.stringify(updatedUserData, null, 2)}`
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
                    'transaction-happened-after-block-disable-upi-id','upi-pin-share-with-bank-or-upiapp-officer-at-bank office',
                    'upi-lost-mobileorsim','upi-simclone', 'user-enabled-geolocation-on-upi-app',
                    'did-the-fraud-amount-exceeded-the-daily-payment-limit',
                    'transaction_happen_after_informed_bank_or_upiapp_of_previous_fraud',
                    'role_and_responsibility_changed_by_company_during_probation_period',
                    'contractual_employment_contract_regularly_renewed',
                    'employee_holding_statutory_positions',
                    'employee_signed_cheques_remain_uncashed',
                    'employee_named_as_complainant_or_witness_for_employer_legal_matters',
                    'open_disciplinary_performance_actions','employee_seeks_immediate_reinsatement_in_job',
                    'employee_seeks_right_of_rehire_in_future',
                    'employee_threatened_by_employer_to_voluntary_resign',
                    'employee_belongs_to_schedule_cast_or_schedule_tribe_and_unfairly_terminated',
                    'employee_is_person_with_disability_and_unfairly_terminated',
                    'employee_is_sufferring_with_hiv_or_aids_and_unfairly_terminated',
                    'employee_is_transgender_and_unfairly_terminated',
                    'employer_did_gender_pay_discrimination_employee_now_wants_to_claim_differential_remuneration_law',
                    'woman_employee_seeks_compensation_for_employer_discriminating_women_employee_on_condition_of_servi',
                    'employee_terminated_as_retaliation_to_previous_complaint_filed_by_employee',
                    'employee_esop_will_miss_vesting_if_notice_period_is_not_served',
                    'employee_claims_full_vesting_of_esop_due_to_unfair_termination',
                    'working_outside_working_hours_and_weekends_and_wants_overtime',
                    'employee_made_to_forego_accumulated_leaves_now_claims_compensation',
                    'employee_recently_asked_to_move_to_different_city_for_work_and_want_to_claim_cost_of_relocation',
                    'employee_paid_enhanced_insurance_from_salary',
                    'informed_employer_of_health_status',
                    'counseling_from_employer_sponsored_mental_health_counselor',
                    'availing_employee_health_insurance_for_self_and_family',
                    'workplace_injury_in_past_still_subsisting',
                    'employee_covered_under_esi_act'

                        ]
                        .includes(key) && String(obj[key]).toLowerCase() === 'no') {
                        delete obj[key];
                    } else if (['applied_for_atmcard', 'withdrawing_regularly_from_atm',
                    'refund_compensesion_expected', 'domestic_transaction',
                    'transaction_sms_recieved', 'transaction_sms_recieved_within_one_hour',
                    'transaction_sms_recieved_within_hour','transaction_email_recieved_within_hour',
                    'transaction_email_recieved', 'transaction_email_recieved_within_one_hour',
                    'transaction_from_atm_in_home_city_or_work_city',
                    'transaction_from_atm_in_home_city_or_work_city_regularly_withdrawing',
                    'user_created_upi_handle',
                    'did_the_employer_follow_last_in_first_out_principle_for_termination_or_layoff',
                    'employee_received_all_salary_for_retrenchment', 'employee_received_bonus_or_incentive_on_retrenchment',
                    'employee_received_leave_encashment_that_was_due', 'employee_received_gratuity_that_was_due',
                    'employee_received_severance_pay_for_15_days_salary_for_each_completed_service_year_on_retrenchment',
                    'employee_received_3_months_notice_period_or_salary_in_lieu_of_shorter_notice_period',
                    'employee_received_notice_pay_for_retrenchment',
                    'employer_deposited_tds_on_salary_to_government_department',
                    'employer_deposited_employee_pf_contribution_to_government_department',
                    'employer_deposited_employer_own_pf_contribution_to_government_department',

                        ]
                        .includes(key) && String(obj[key]).toLowerCase() === 'yes') {
                        delete obj[key]; // Delete the key if the value is 'yes' 
                    } else if (key === 'area_of_user' && String(obj[key]).toLowerCase() === 'urban') { delete obj[key]; } else if (['option_for_compliant'].includes(key)) {
                        delete obj[key];
                    }
                    else if(['pincode', 'transaction-counter', 'option_for_compliant', 'transactionArray',
                            'upi-simclone-telcoinform','compensation-and-damages'].includes(key)){
                        delete obj[key]
                    }
                });
            }
        }
        return obj;
    })(cleanedJson);
    return cleanedJson;
}