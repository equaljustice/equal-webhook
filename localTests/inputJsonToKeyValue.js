const inputJson = [
    {
        "qid": 1,
        "questionText": "What is your PINCODE?",
        "answer": "414604",
        "isEditAnswer": false,
        "parameter": "area_pincode"
    },
    {
        "qid": 23,
        "questionText": "How many ATM transactions?",
        "answer": "1",
        "isEditAnswer": false,
        "parameter": "fraud_transactions_count",
        "transactions": {
            "T0": [
                {
                    "qid": 24,
                    "questionText": "Date of the fraudulent ATM transaction",
                    "answer": "03/26/2024 22:38:54",
                    "isEditAnswer": false,
                    "parameter": "transaction_date"
                },
                {
                    "qid": 25,
                    "questionText": "Amount of the fraudulent ATM transaction",
                    "answer": "22232",
                    "isEditAnswer": false,
                    "parameter": "transaction_amount"
                },
                {
                    "qid": 26,
                    "questionText": "Did you get any SMS from the bank of this withdrawal?",
                    "answer": "Yes",
                    "isEditAnswer": false,
                    "parameter": "transaction_sms_recieved"
                }
            ]
        }
    },
    {
        "qid": 28,
        "questionText": "Did the fraudulent transaction happen from the ATM within the same city where you live or work?",
        "answer": "Yes",
        "isEditAnswer": false,
        "parameter": "transaction_in_home_or_work_city"
    },
    {
        "qid": 29,
        "questionText": "Are you regularly withdrawing money from the ATM of the bank account from where the money was fraudulently withdrawn?",
        "answer": "Yes",
        "isEditAnswer": false,
        "parameter": "transaction_atm_regularly_used"
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
        "parameter": "transaction_sms_recieved_within_hour"
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
        "parameter": "transaction_email_recieved_within_hour"
    },
    {
        "qid": 37,
        "questionText": "Did you informed the bank about this fraudulent transaction?",
        "answer": "Yes",
        "isEditAnswer": false,
        "parameter": "informed_bank_fraud_transaction"
    },
    {
        "qid": 8,
        "questionText": "Total amount of refund and compensation you wish to claim from the Bank?",
        "answer": "12",
        "isEditAnswer": false,
        "parameter": "refund_compensesion_expected"
    }
];
  
  const convertToJsonFormat = (jsonArray) => {
    const result = {};

    jsonArray.forEach((item) => {
        const { parameter, answer } = item;
        result[parameter] = answer;

        if (item.transactions) {
            const transactions = item.transactions.T0;
            transactions.forEach((transaction) => {
                const { parameter, answer } = transaction;
                result[parameter] = answer;
            });
        }
    });

    return result;
};

  
  const outputJson = convertToJsonFormat(inputJson);
  console.log(JSON.stringify(outputJson, null, 2));
  