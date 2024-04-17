export const qjson = [
    {
      "qid": 1,
      "question": {
        "text": "What is your area Pincode?",
        "audio_url": "https://equaljustice.ai/assest/recordings/audio/pincode-question.mp3"
      },
      "question_help": {
        "text": "Pincode will be used to identify the laws applicable under your residence area",
        "audio_url": "https://equaljustice.ai/assest/recordings/audio/pincode-question_help.mp3"
      },
      "question_alt_1": {
        "text": "What is your residence area Pincode?",
        "audio_url": "https://equaljustice.ai/assest/recordings/audio/pincode-question_alt_text1.mp3"
      },
      "answerType": "text",
      "validation": {
        "regex": "^[1-9]{1}[0-9]{2}s{0,1}[0-9]{3}$",
        "errorMessage": "Please enter a valid 6-digit Indian Pincode"
      },
      "video_url": "https:www.youtube.com/v=93939",
      "parameter": "area_of_user",
      "nextQuestionId": [2]
    },
    {
      "qid": 2,
      "question": {
        "text": "Are you a senior citizen i.e. is your age above 60 years?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/senior-citizen-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "Senior_citizen",
      "nextQuestionId": {
        "Yes": [3],
        "No": [4]
      }
    },
    {
      "qid": 3,
      "question": {
        "text": "Is this your pension savings bank account?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/pension-savings-account-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "pension_savings_account",
      "nextQuestionId": {
        "Yes": [9,4],
        "No": [9,4]
      }
    },
    {
      "qid": 4,
      "question": {
        "text": "Did you ever apply for an ATM card from your bank?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/apply-atm-card-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "applied_for_atmcard",
      "nextQuestionId": {
        "Yes": [7,10],
        "No": [22]
      }
    },
    {
      "qid": 7,
      "question": {
        "text": "Are you regularly withdrawing money from the ATM card?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/regular-withdrawal-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "withdrawing_regularly_from_atm",
      "nextQuestionId": {
        "Yes": [10],
        "No": [10]
      }
    },
    {
      "qid": 8,
      "question": {
        "text": "Total amount of refund and compensation you wish to claim from the Bank?",
        "audioUrl": ""
      },
      "answerType": "text",
      "parameter": "refund_compensesion_expected",
      "isLastQuestion":true,
      "nextQuestionId": []
    },
    {
      "qid": 9,
      "question": {
        "text": "Can you please specify name of your bank?",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Bank name and address will be used to identify services offered by bank.",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/bankname-question_help.mp3"
      },
      "question_alt": {
        "text": "What is your bank name and branch address?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/bankname-question.mp3"
      },
      "answerType": "autocomplete",
      "validation": {
        "regex": "",
        "errorMessage": "Please enter valid bank name and branch address"
      },
      "parameter": "bank_name",
      "nextQuestionId": [4]
    },
    {
      "qid": 10,
      "question": {
        "text": "Did you share your ATM card PIN with a fraudster?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/share-atm-pin-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "atm_pin_shared",
      "nextQuestionId": {
        "Yes": [11],
        "No": [18]
      }
    },
    {
      "qid": 11,
      "question": {
        "text": "Did you share over a phone call or on a website or mobile app or with a bank officer?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/share-method-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Mobile App", "Website", "Phone Call", "Bank Officer"],
      "parameter": "atm_pin_shared_using",
      "nextQuestionId": {
        "Mobile App": [120],
        "Website": [12],
        "Phone Call": [13],
        "Bank Officer": [17]
      }
    },
    {
      "qid": 12,
      "question": {
        "text": "Whether the website was in the name of your bank with the website address of the bank?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/website-authenticity-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "website_in_bank_name",
      "nextQuestionId": {
        "Yes": [15],
        "No": [18]
      }
    },
    {
      "qid": 120,
      "question": {
        "text": "Whether App was in the name of your bank?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/website-authenticity-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "mobileapp_in_bank_name",
      "nextQuestionId": {
        "Yes": [150],
        "No": [150]
      }
    },
    {
      "qid": 13,
      "question": {
        "text": "Did you get the call on the phone number you have registered with the bank?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/phone-call-confirmation-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "got_phonecall_on_user_bank_registered_number",
      "nextQuestionId": {
        "Yes": [18],
        "No": [18]
      }
    },
    {
      "qid": 14,
      "question": {
        "text": "Did you get the link of this fake website or app on your email or SMS on the email and phone number registered with your bank?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fake-website-link-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "recieved_website_app_on_bank_registered_contact",
      "nextQuestionId": {
        "Yes": [15],
        "No": [15]
      }
    },
    {
      "qid": 15,
      "question": {
        "text": "Share the URL of the website.",
        "audioUrl": ""
      },
      "answerType": "text",
      "parameter": "name_website_app",
      "nextQuestionId": [16]
    },
    {
      "qid": 150,
      "question": {
        "text": "Share name of the App.",
        "audioUrl": ""
      },
      "answerType": "text",
      "parameter": "name_website_app",
      "nextQuestionId": [16]
    },
    {
      "qid": 16,
      "question": {
        "text": "Share the email ID or phone number from where you received this link.",
        "audioUrl": ""
      },
      "answerType": "text",
      "parameter": "website_mobileapp_sender_contacted_from",
      "nextQuestionId": [18]
    },
    {
      "qid": 17,
      "question": {
        "text": "Did you share the ATM PIN with a bank officer while visiting a bank branch?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/share-atm-pin-bank-officer-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "shared_atm_pin_to_bank_officer",
      "nextQuestionId": {
        "Yes": [18],
        "No": [18]
      }
    },
    {
      "qid": 18,
      "question": {
        "text": "Did you lose/lost your ATM card?",
        "audioUrl": ""
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "atmcard_lost_informed_bank_before_fraud",
      "nextQuestionId": {
        "Yes": [19],
        "No": [22]
      }
    },
    {
      "qid": 19,
      "question": {
        "text": "Did you inform about the lost ATM to the bank before the fraudulent transaction?",
        "audioUrl": ""
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "atm_lost_informed_before_fraud",
      "nextQuestionId": {
        "Yes": [22,23],
        "No": [22,23]
      }
    },
    {
      "qid": 22,
      "question": {
        "text": "Did the total amount withdrawn exceed the daily withdrawal limit?",
        "audioUrl": ""
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "withdrawn_amount_exceed_daily_limit",
      "nextQuestionId": {
        "Yes": [23],
        "No": [23]
      }
    },
    {
      "qid": 23,
      "question": {
        "text": "How many ATM transactions?",
        "audioUrl": ""
      },
      "answerType": "text",
      "validation": {
        "regex": "^\\d+$",
        "errorMessage": "Please enter a valid numeric value"
      },
      "parameter": "fraud_transactions_count",
      "repeatQusetions": [24,25,26,27, 28, 29, 30, 31, 32,33,34,35,36,37,38],
      "nextQuestionId": [8]
    },
    {
      "qid": 24,
      "question": {
        "text": "Date of the fraudulent ATM transaction",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Date of the fraudulent ATM transaction",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-transaction-date-question-help.mp3"
      },
      "question_alt": {
        "text": "Date of the fraudulent ATM transaction",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-transaction-date-question.mp3"
      },
      "answerType": "datetime",
      "validation": {
        "regex": "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$",
        "errorMessage": "Please enter a valid date in YYYY-MM-DD format"
      },
      "parameter": "transaction_date",
      "nextQuestionId": [25]
    },
    {
      "qid": 25,
      "question": {
        "text": "Amount of the fraudulent ATM transaction",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Amount of the fraudulent ATM transaction",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-transaction-amount-question-help.mp3"
      },
      "question_alt": {
        "text": "Amount of the fraudulent ATM transaction",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-transaction-amount-question.mp3"
      },
      "answerType": "text",
      "validation": {
        "regex": "^\\d+$",
        "errorMessage": "Please enter a valid numeric value"
      },
      "parameter": "transaction_amount",
      "nextQuestionId": [26]
    },
    {
      "qid": 26,
      "question": {
        "text": "Did you get any SMS from the bank of this withdrawal?",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Did you get any SMS from the bank of this withdrawal?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question-help.mp3"
      },
      "question_alt": {
        "text": "Did you get any SMS from the bank of this withdrawal?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "transaction_sms_recieved",
      "nextQuestionId": {
        "Yes": [34],
        "No": [35]
      }
    },
    {
      "qid": 27,
      "question": {
        "text": "Did this fraudulent withdrawal happen after you informed the bank about a previous fraudulent withdrawal / loss of ATM card / compromise on the ATM Pin?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-withdrawal-after-informing-bank-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "transaction_happen_after_informed_bank_of_previous_fraud",
      "nextQuestionId": {
        "Yes": [28],
        "No": [28]
      }
    },
    {
      "qid": 28,
      "question": {
        "text": "Did the fraudulent transaction happen from the ATM within the same city where you live or work?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-transaction-same-city-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No", "Not Aware"],
      "parameter": "transaction_from_ATM_in_home_city_or_work_city",
      "nextQuestionId": {
        "Yes": [29],
        "No": [30],
        "Not Aware": [8]
      }
    },
    {
      "qid": 29,
      "question": {
        "text": "Are you regularly withdrawing money from the ATM of the bank account from where the money was fraudulently withdrawn?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/regular-withdrawal-from-fraud-account-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "transaction_from_ATM_in_home_city_or_work_city_regularly_withdrawing",
      "nextQuestionId": {
        "Yes": [8],
        "No": [8]
      }
    },
    {
      "qid": 30,
      "question": {
        "text": "Was the fraudulent transaction in a different city within India or from a different country?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-transaction-different-city-country-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Different City in India", "Different Country"],
      "parameter": "transaction_atm_different_city_or_different_country",
      "nextQuestionId": {
        "Different City in India": [31],
        "Different Country": [31]
      }
    },
    {
      "qid": 31,
      "question": {
        "text": "Were you present in that city during the time of the ATM transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/fraudulent-transaction-present-in-city-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "user_present_in_different_city_or_different_country_where_fraud_atm_transaction_happened",
      "nextQuestionId": {
        "Yes": [32],
        "No": [8]
      }
    },
    {
      "qid": 32,
      "question": {
        "text": "Did you undertake any banking transaction around the time of the ATM fraud in that different city or other country?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/banking-transaction-around-fraud-time-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "user_did_transaction_from_that_different_city_or_different_country",
      "nextQuestionId": {
        "Yes": [8],
        "No": [8]
      }
    },
    
    {
      "qid": 34,
      "question": {
        "text": "Did you received SMS within one hour of the transaction?",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Did you received SMS within one hour of the transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question-help.mp3"
      },
      "question_alt": {
        "text": "Did you received SMS within one hour of the transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "transaction_sms_recieved_within_one_hour",
      "nextQuestionId": {
        "Yes": [35],
        "No": [35]
      }
    },
    {
      "qid": 35,
      "question": {
        "text": "Did you received Email of the transaction?",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Did you get received the Email of the transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question-help.mp3"
      },
      "question_alt": {
        "text": "Did you get received the Email of the transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "transaction_email_recieved",
      "nextQuestionId": {
        "Yes": [36],
        "No": [37]
      }
    },
    {
      "qid": 36,
      "question": {
        "text": "Did you received Email within one hour of the transaction?",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Did you get received the Email within one hour of the transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question-help.mp3"
      },
      "question_alt": {
        "text": "Did you get received the Email within one hour of the transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "transaction_email_recieved_within_one_hour",
      "nextQuestionId": {
        "Yes": [37],
        "No": [37]
      }
    },
    {
      "qid": 37,
      "question": {
        "text": "Did you informed the bank about this fraudulent transaction?",
        "audioUrl": ""
      },
      "question_help": {
        "text": "Did you informed the bank about this fraudulent transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question-help.mp3"
      },
      "question_alt": {
        "text": "Did you informed the bank about this fraudulent transaction?",
        "audioUrl": "https://equaljustice.ai/assest/recordings/audio/sms-from-bank-question.mp3"
      },
      "answerType": "choice",
      "choices": ["Yes", "No"],
      "parameter": "informed_bank_fraud_transaction",
      "nextQuestionId": {
        "Yes": [38],
        "No": [8]
      }
    },
    {
      "qid": 38,
      "question": {
        "text": "Working days (excluding bank holidays) within which you informed the bank?",
        "audioUrl": ""
      },
      "answerType": "choice",
      "choices": ["Within 3 days", "Between 4 to 7 days", "More than 7 days"],
      "parameter": "informed_bank_fraud_transaction_within",
      "nextQuestionId": [27]
    }
  ]
  