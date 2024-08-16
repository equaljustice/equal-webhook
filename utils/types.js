export const openAIModels = {
    GPT3_5: 'gpt-3.5-turbo-16k',
    GPT4: 'gpt-4-0125-preview',
    GPT4o: 'gpt-4o',
    ATM_FRAUD_BANK: 'ft:gpt-3.5-turbo-1106:ashish-chandra:bankatmletter:90dP3i8f',
    ATM_FRAUD_CONSUMER_COURT: 'ft:gpt-3.5-turbo-1106:ashish-chandra:bnkltrandobdsuman:90dcJiEd',
    ATM_FRAUD_OMBUDSMAN: 'ft:gpt-3.5-turbo-1106:ashish-chandra:atmombudsman:8zov1AhH',
    FAILED_TRANASACTION_BANK: 'ft:gpt-3.5-turbo-1106:ashish-chandra:failed-trn-bankltr:96IUpuRq',
    FAILED_TRANASACTION_CONSUMER_COURT: 'ft:gpt-3.5-turbo-1106:ashish-chandra:failedtr-consumerc:9AFwUlml',
    FAILED_TRANASACTION_OMBUDSMAN: 'ft:gpt-3.5-turbo-1106:ashish-chandra:failedtr-obmudsman:9AEMVzCm',
    OPEN_QNA: 'ft:gpt-3.5-turbo-1106:ashish-chandra::8xglmTtV'
}

export const transaction = {
    ATM: 'ATM',
    FAILED_TRANASACTION: 'FAILED_TXN',
    UPI: 'UPI',
    
}

export const employee = {
    Retrenchment: 'Retrenchment'
}

export const travel = {
    Flights: 'Flights'
}

export const letterOption = {
    BANK_LETTER: "Bank",
    BANKING_OMBUDSMAN: "Banking Ombudsman",
    POLICE_COMPLAINT: "Police Complaint",
    CONSUMER_COURT: "Consumer court",
    RTI_APPLICATION: "RTI Application",
    NOTICE_TO_COMPANY_HR: "Notice To The Company",
    HUMAN_RIGHTS: "Complaint before Human Rights Commission",
    BORD_OF_DIRECTOR: "Complaint To The Board Of Directors",
    AIRLINE_NODEL_OFFICER: "Letter To The Airline Nodal Officer",
    AIRLINE_APPELLATE_AUTH: "Letter To The Airline Appellate Authority",
    AIRLINE_CONSUMER_COURT: "Complaint Before Consumer Court"
}

export const targetpage = {
    ATMLetterOption: "projects/atmprebuiltagent/locations/asia-south1/agents/9d9f910c-d14b-4489-b1f9-98c6c3e67c61/flows/aa979626-23c2-4a9c-b456-45403d2dbf61/pages/43328113-8eb4-4cd5-911a-40700ad78d5c",
    UPILetterOption: "projects/atmprebuiltagent/locations/us-central1/agents/b2e20d6e-110e-4076-832f-09795e5d53a2/flows/aa979626-23c2-4a9c-b456-45403d2dbf61/pages/11e0abf0-ea69-47be-bb5a-744585f50f39",
    FailedTrLetterOption: "projects/atmprebuiltagent/locations/us-central1/agents/7f79f692-4e94-4d04-9bf1-203e68b815dc/flows/10d45ea1-8174-4894-96ed-0bbfb9b802ae/pages/43328113-8eb4-4cd5-911a-40700ad78d5c",
                  
}