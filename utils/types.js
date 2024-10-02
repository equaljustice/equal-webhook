export const openAIModels = {
    GPT3_5: 'gpt-3.5-turbo-16k',
    GPT4: 'gpt-4-0125-preview',
    GPT4o: 'gpt-4o',
    /* ATM_FRAUD_BANK: 'ft:gpt-4o-2024-08-06:ashish-chandra:bankatmletter:A7fDUFJj',
    ATM_FRAUD_CONSUMER_COURT: 'ft:gpt-4o-2024-08-06:ashish-chandra:bnkltrandobdsuman:A7eFDO1q',
    ATM_FRAUD_OMBUDSMAN: 'ft:gpt-4o-2024-08-06:ashish-chandra:atmombudsman:A97nEp09',
    FAILED_TRANSACTION_BANK: 'ft:gpt-4o-2024-08-06:ashish-chandra:failed-trn-bankltr:A7e7meJC',
    FAILED_TRANSACTION_CONSUMER_COURT: 'ft:gpt-4o-2024-08-06:ashish-chandra:failedtr-consumerc:A7dkWYtO',
    FAILED_TRANSACTION_OMBUDSMAN: 'ft:gpt-4o-2024-08-06:ashish-chandra:failedtr-obmudsman:A7dksJ7I',
     */FINANCIAL_COMBINED: 'ft:gpt-4o-2024-08-06:ashish-chandra:atmftcombined:ADBvd5R9',
    OPEN_QNA: 'ft:gpt-4o-2024-08-06:ashish-chandra::A98Mssc2'
}

export const openAIAssist = {
    EMP_OFFER: 'asst_em2POAQCJrN5O8QoHnLBFLQz'
}

export const transaction = {
    ATM: 'ATM',
    FAILED_TRANSACTION: 'FAILED_TXN',
    UPI: 'UPI',

}

export const employee = {
    Retrenchment: 'Retrenchment',
    Offer: 'JobOffer'
}

export const travel = {
    Flights: 'Flights'
}
export const actions = {
    Welcome: 'WELCOME',
    Fallback: 'FALLBACK'
}

export const letterOption = {
    BANK_LETTER: "Bank",
    BANKING_OMBUDSMAN: "Banking Ombudsman",
    POLICE_COMPLAINT: "Police Complaint",
    CONSUMER_COURT: "Consumer court",
    RTI_APPLICATION: "RTI Application",
    NOTICE_TO_COMPANY_HR: "Notice To The Company",
    HUMAN_RIGHTS: "Complaint before Human Rights Commission",
    BOARD_OF_DIRECTOR: "Complaint To The Board Of Directors",
    AIRLINE_NODAL_OFFICER: "Letter To The Airline Nodal Officer",
    AIRLINE_APPELLATE_AUTH: "Letter To The Airline Appellate Authority",
    AIRLINE_CONSUMER_COURT: "Complaint Before Consumer Court"
}

export const targetpage = {
    ATMLetterOption: "projects/atmprebuiltagent/locations/asia-south1/agents/9d9f910c-d14b-4489-b1f9-98c6c3e67c61/flows/aa979626-23c2-4a9c-b456-45403d2dbf61/pages/43328113-8eb4-4cd5-911a-40700ad78d5c",
    UPILetterOption: "projects/atmprebuiltagent/locations/us-central1/agents/b2e20d6e-110e-4076-832f-09795e5d53a2/flows/aa979626-23c2-4a9c-b456-45403d2dbf61/pages/11e0abf0-ea69-47be-bb5a-744585f50f39",
    FailedTrLetterOption: "projects/atmprebuiltagent/locations/us-central1/agents/7f79f692-4e94-4d04-9bf1-203e68b815dc/flows/10d45ea1-8174-4894-96ed-0bbfb9b802ae/pages/43328113-8eb4-4cd5-911a-40700ad78d5c",

}

export const pricing = {
    ATM: { amount: 9900, sale_amount: 4900, tax: 0, discount: 4600 },
    FAILED_TRANSACTION: { amount: 4900, sale_amount: 2900, tax: 0, discount: 2600 },
    UPI: { amount: 9900, sale_amount: 4900, tax: 0, discount: 4600 },
    Retrenchment: { amount: 4900, sale_amount: 9900, tax: 0, discount: 9600 },
    Flights: { amount: 9900, sale_amount: 4900, tax: 0, discount: 4600 },
    Offer: { amount: 9900, sale_amount: 4900, tax: 0, discount: 4600 },
}