const inputJson = [
    {
      "qid": 1,
      "questionText": "What is your area Pincode?",
      "answer": "422201",
      "isEditAnswer": false,
      "parameter": "area_of_user"
    },
    {
      "qid": 2,
      "questionText": "Are you a senior citizen i.e. is your age above 60 years?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "Senior_citizen"
    },
    {
      "qid": 3,
      "questionText": "Is this your pension savings bank account?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "pension_savings_account"
    },
    {
      "qid": 9,
      "questionText": "Can you please specify name of your bank?",
      "answer": "Bank of Maharashtra",
      "isEditAnswer": false,
      "parameter": "bank_name"
    },
    {
      "qid": 4,
      "questionText": "Did you ever apply for an ATM card from your bank?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "applied_for_atmcard"
    },
    {
      "qid": 7,
      "questionText": "Are you regularly withdrawing money from the ATM card?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "withdrawing_regularly_from_atm"
    },
    {
      "qid": 10,
      "questionText": "Did you share your ATM card PIN with a fraudster?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "atm_pin_shared"
    },
    {
      "qid": 11,
      "questionText": "Did you share over a phone call or on a website or mobile app or with a bank officer?",
      "answer": "Website",
      "isEditAnswer": false,
      "parameter": "atm_pin_shared_using"
    },
    {
      "qid": 12,
      "questionText": "Whether the website was in the name of your bank with the website address of the bank?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "website_in_bank_name"
    },
    {
      "qid": 15,
      "questionText": "Share the URL of the website or app.",
      "answer": "Jahdg.xbsj.sjsg",
      "isEditAnswer": false,
      "parameter": "name_website_app"
    },
    {
      "qid": 16,
      "questionText": "Share the email ID or phone number from where you received this link.",
      "answer": "Xhang@63562",
      "isEditAnswer": false,
      "parameter": "website_mobileapp_sender_contacted_from"
    },
    {
      "qid": 18,
      "questionText": "Did you lose/lost your ATM card?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "atmcard_lost_informed_bank_before_fraud"
    },
    {
      "qid": 19,
      "questionText": "Did you inform about the lost ATM to the bank before the fraudulent transaction?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "atm_lost_informed_before_fraud"
    },
    {
      "qid": 22,
      "questionText": "Did the total amount withdrawn exceed the daily withdrawal limit?",
      "answer": "Yes",
      "isEditAnswer": false,
      "parameter": "withdrawn_amount_exceed_daily_limit"
    },
    {
      "qid": 23,
      "questionText": "How many ATM transactions?",
      "answer": "2",
      "isEditAnswer": false,
      "parameter": "fraud_transactions_count",
      "transactions": {
        "T0": [
          {
            "qid": 24,
            "questionText": "Date of the fraudulent ATM transaction",
            "answer": "2024-03-03",
            "isEditAnswer": false,
            "parameter": "transaction_date"
          },
          {
            "qid": 25,
            "questionText": "Amount of the fraudulent ATM transaction",
            "answer": "6363",
            "isEditAnswer": false,
            "parameter": "transaction_amount"
          },
          {
            "qid": 26,
            "questionText": "Did you get any SMS from the bank of this withdrawal?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_sms_recieved"
          },
          {
            "qid": 34,
            "questionText": "Did you get received the SMS within one hour of the transaction?",
            "answer": "No",
            "isEditAnswer": false,
            "parameter": "transaction_sms_recieved_within_one_hour"
          },
          {
            "qid": 35,
            "questionText": "Did you get received the Email of the transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_email_recieved"
          },
          {
            "qid": 36,
            "questionText": "Did you get received the Email within one hour of the transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_email_recieved_within_one_hour"
          },
          {
            "qid": 37,
            "questionText": "Did you informed the bank about this fraudulent transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "informed_bank_fraud_transaction"
          },
          {
            "qid": 38,
            "questionText": "Working days (excluding bank holidays) within which you informed the bank?",
            "answer": "Between 4 to 7 days",
            "isEditAnswer": false,
            "parameter": "informed_bank_fraud_transaction_within"
          },
          {
            "qid": 27,
            "questionText": "Did this fraudulent withdrawal happen after you informed the bank about a previous fraudulent withdrawal / loss of ATM card / compromise on the ATM Pin?",
            "answer": "No",
            "isEditAnswer": false,
            "parameter": "transaction_happen_after_informed_bank_of_previous_fraud"
          },
          {
            "qid": 28,
            "questionText": "Did the fraudulent transaction happen from the ATM within the same city where you live or work?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_from_ATM_in_home_city_or_work_city"
          },
          {
            "qid": 29,
            "questionText": "Are you regularly withdrawing money from the ATM of the bank account from where the money was fraudulently withdrawn?",
            "answer": "No",
            "isEditAnswer": false,
            "parameter": "transaction_from_ATM_in_home_city_or_work_city_regularly_withdrawing"
          }
        ],
        "T1": [
          {
            "qid": 24,
            "questionText": "Date of the fraudulent ATM transaction",
            "answer": "2024-03-03",
            "isEditAnswer": false,
            "parameter": "transaction_date"
          },
          {
            "qid": 25,
            "questionText": "Amount of the fraudulent ATM transaction",
            "answer": "3366",
            "isEditAnswer": false,
            "parameter": "transaction_amount"
          },
          {
            "qid": 26,
            "questionText": "Did you get any SMS from the bank of this withdrawal?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_sms_recieved"
          },
          {
            "qid": 34,
            "questionText": "Did you get received the SMS within one hour of the transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_sms_recieved_within_one_hour"
          },
          {
            "qid": 35,
            "questionText": "Did you get received the Email of the transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_email_recieved"
          },
          {
            "qid": 36,
            "questionText": "Did you get received the Email within one hour of the transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_email_recieved_within_one_hour"
          },
          {
            "qid": 37,
            "questionText": "Did you informed the bank about this fraudulent transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "informed_bank_fraud_transaction"
          },
          {
            "qid": 38,
            "questionText": "Working days (excluding bank holidays) within which you informed the bank?",
            "answer": "Within 3 days",
            "isEditAnswer": false,
            "parameter": "informed_bank_fraud_transaction_within"
          },
          {
            "qid": 27,
            "questionText": "Did this fraudulent withdrawal happen after you informed the bank about a previous fraudulent withdrawal / loss of ATM card / compromise on the ATM Pin?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "transaction_happen_after_informed_bank_of_previous_fraud"
          },
          {
            "qid": 28,
            "questionText": "Did the fraudulent transaction happen from the ATM within the same city where you live or work?",
            "answer": "No",
            "isEditAnswer": false,
            "parameter": "transaction_from_ATM_in_home_city_or_work_city"
          },
          {
            "qid": 30,
            "questionText": "Was the fraudulent transaction in a different city within India or from a different country?",
            "answer": "Different Country",
            "isEditAnswer": false,
            "parameter": "transaction_atm_different_city_or_different_country"
          },
          {
            "qid": 31,
            "questionText": "Were you present in that city during the time of the ATM transaction?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "user_present_in_different_city_or_different_country_where_fraud_atm_transaction_happened"       
          },
          {
            "qid": 32,
            "questionText": "Did you undertake any banking transaction around the time of the ATM fraud in that different city or other country?",
            "answer": "Yes",
            "isEditAnswer": false,
            "parameter": "did_transaction_from_that_city"
          }
        ]}
    },
{
  "qid": 8,
  "questionText": "Total amount of refund and compensation you wish to claim from the Bank?",
  "answer": "62626",
  "isEditAnswer": false,
  "parameter": "refund_compensesion_expected"
}
]

  
  function convertToJsonFormat(inputJson){
    const outputJson = {}
    inputJson.forEach(item => {
        if (item.parameter === 'fraud_transactions_count') {
          outputJson['transactions'] = [];
          for (const key in item.transactions) {
            const transactionObj = {};
            item.transactions[key].forEach(transaction => {
             
              transactionObj[transaction.parameter] = transaction.answer;
              
            });
            outputJson['transactions'].push(transactionObj);
          }
        } else {
          outputJson[item.parameter] = item.answer;
        }
      });
    return outputJson;
};

  
  const outputJson = convertToJsonFormat(inputJson);
  console.log(JSON.stringify(outputJson, null, 2));
  