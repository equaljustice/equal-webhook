export const UPILegalTrainingData = [{
    "qId": "1",
    "Question": "What is your PINCODE",
    "Parameter": "area_of_user",
    "Condition": "rural",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very critical:
        1. Bank is well aware that I belong to a rural / semi-urban area where the financial literacy is assumed to be low, and customers from these areas are more susceptible to frauds. 2. There is a heightened duty casted on the banks to implement robust technological solutions to protect the vulnerable customers especially those from rural / semi-urban areas from financial frauds. 
        3. The bank should be called upon to demonstrate what additional technology and security parameters the bank has put in place to protect the customers from rural / semi-urban areas from the financial frauds.`
},
{
    "qId": "2",
    "Question": "Did you ever open a UPI handle with your bank or UPI App?",
    "Parameter": "user_created_upi_handle",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very critical:
        1. This is a prima facie case of utter gross negligence and mala fide intent at the bank’s side which may involve connivance of the bank’s officers, including unauthorizedly sharing my information to cause wrongful harm to me. 
        2. The onus is on the bank to demonstrate that I have created a UPI ID and that it is mapped to my mobile phone and sim card. 
        3. The RBI has also mandated banks to not share customer information, and in this case the bank or its employee has shared the information to cause wrongful loss to the user.`
},
{
    "qId": "3",
    "Question": "Where did you create your UPI handle?",
    "Parameter": "upi_handle_provider",
    "Condition": "UPI Apps",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very critical:
        1. Although I have created my UPI ID on a non-bank UPI App service provider, this does not preclude the bank to ensure my bank account and transactions are protected against any fraud including by putting fraud protection and fraud monitoring obligations on the UPI App providers. 
        2. RBI has given a strong recommendation to UPI App providers and NPCI has obligated the UPI App providers to follow the RBI mandated fraud protection and fraud monitoring guidelines to protect the bank account and money of the customers against any fraud or deceit.
        3. Banks have been tasked by RBI to ensure UPI App providers adhere to RBI guidelines on fraud prevention.
        4. Banks can claim compensation or indemnity from the UPI App provider while returning the amount defrauded back to the customer along with interest and compensation. As the UPI App provider is operating under the bank, it is the responsibility of the bank to make good the losses and compensation to the user, and recover the same from the UPI App provider.`
},
{
    "qId": "4",
    "Question": "Are you a senior citizen i.e. is your age above 60 years",
    "Parameter": "senior_citizen",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very critical:
        1. Indian courts and the RBI have imposed heightened duty of care by banks towards senior citizens, as they are susceptible to deceit and trickery, and are not expected to be adept with advanced technology and operations requiring technical knowledge and finesse. 
        2. The bank is also under duty to protect senior citizens from any UPI related frauds and deceit by working closely with the UPI App service providers. 
        3. Indian law and RBI standards emphasise the importance of protective measures to be adopted by the banks (including procedural, technical and logical) for older customers, who may not be as equipped to handle complex electronic banking interfaces or defend against fraudsters employing deceptive tactics. This includes the responsibility to provide immediate assistance and take swift action in cases of reported fraud. A similar duty is casted on the UPI App providers when they are dealing with senior citizens. 
        4. It is very much possible that the user's case is not an isolated case, and the bank and/or UPI App provider must have encountered many similar cases. It is on the bank and/or UPI App provider to demonstrate what actions it / they has / have taken to deploy proactive tools and technology to protect the senior citizens.
        5. It is the banks duty to ensure protection of senior citizens by UPI App providers.`
},
{
    "qId": "5",
    "Question": "does the UPI handle belong to your pension savings bank account?",
    "Parameter": "upi_handle_of_pension_bank_account",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very critical:
        1. The duty of the bank and UPI App provider gets further heightened when the bank is aware that the account is the pensioner account of a senior citizen, which is usually used by the senior citizens for their livelihood. 
        2. RBI has time and again emphasised that senior citizens form an important constituent of the bank, and the entire trust of senior citizens in the banking systems will go down if the highly capitalized banks and technologically sophisticated UPI App providers do not implement proactive and preventive technologies to safeguard the bank accounts and money of senior citizens especially where senior citizens receive their pensions to survive and sustain in the old age.`
},
{
    "qId": "6",
    "Question": "Has one year lapsed from your last transaction?",
    "Parameter": "last_upi_transaction_more_than_one_year_ago",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Very important point that must be included in the generated document: As per NPCI’s directions, a UPI ID which is dormant for a period of one year or more shall be disabled and deregistered. As the same has not been implemented by the bank and the UPI App provider, a fraudulent transaction was not prevented from the user’s bank account. This reveals gross negligence and deficiency of service from both bank and UPI App provider. As per RBI and NPCI directions, the onus is on the bank and UPI App provider to demonstrate that the users UPI ID was active within the past one year or the user has re-registered his/her dormant UPI ID.`
},
{
    "qId": "7",
    "Question": "Did the transaction happen after you have blocked or disabled your UPI ID?",
    "Parameter": "transaction_happened_after_block_disable_upi_id",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Very critical 2 points below that must be included in the generated document:
        1. The bank or the UPI App provider has not properly implemented my UPI ID blocking or disablement request and are therefore grossly negligent in protecting my bank account and the funds. 
        2. This also tantamount to deficiency of service on the account of the bank or UPI App provider. 
        
        A common and generic point to be included in the generated document: As per RBI and NPCI directions, the onus is on the bank and UPI App provider to demonstrate that the fraudulent transaction happened before I made such a request to block or disable my UPI ID.`
},
{
    "qId": "8",
    "Question": "did you share over a phone call or on a website or mobile app or with a bank / UPI App officer?",
    "Parameter": "upi_pinshare_mode_phone_received_call_on_user_number_registered_with_bank",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very critical:
        1. As I received the fake call on the phone number that I had registered with the bank and is available to the UPI App provider, it is prima facie clear that the bank or UPI App provider was negligent in protecting my personal and sensitive data. 
        2. RBI guidelines, NPCI directions, and other legal requirements put various obligations on the bank and UPI App provider to safeguard the data of the customers, which in this case, the bank or UPI App provider has failed to do so. 
        3. Moreover, as per the RBI guidelines, NPCI directions, and settled legal principles a mere sharing of PIN or passcodes by customer does not absolve bank or UPI App provider from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        
        Common and generic text to be included in generated document: Even if there is contributory negligence by the customer, the bank or UPI App provider is still fully liable to compensate the customer if the bank or UPI App provider has been found negligent or there is a deficiency in service by the bank to protect the account of the customer, for which the onus is on the bank and the UPI App provider to demonstrate their innocence and full compliance with all guidelines, directions and legal requirements.`
},
{
    "qId": "9",
    "Question": "did you share over a phone call or on a website or mobile app or with a bank / UPI App officer?",
    "Parameter": "upi_pinshare_mode_phone_received_call_on_user_number_registered_with_bank",
    "Condition": "No",
    "LegalTrainingMaterial": `Include the below point in the generated document as is very very critical:
         The bank and UPI App provider should be asked to demonstrate whether similar cases where the customers are targeted on a different number (maybe through phishing or social media engineering attacks) appeared in the consolidated review of fraud cases detected during any previous period, and if yes, whether the bank and UPI App provider have put any new processes and procedures to combat or mitigate such fraud attempts, and the results of the audit of its effectiveness with any advised for change in the processes and procedures.`
},
{
    "qId": "10",
    "Question": "whether the website was in the name of your bank / UPI App with website address of the bank / UPI App?",
    "Parameter": "whether_website_or_app_where_pin_shared_in_bank_or_upi_app_name:",
    "Condition": "Website",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very critical:
        1. RBI has mandated banks, and both RBI and NPCI have mandated UPI Apps to actively monitor for the non-genuine/ unauthorised/ malicious websites (with similar name/ features) on the internet and respond accordingly to bring them down. 
        2. Regulators have also recognized that multiple options are available to scan the internet / web ecosystem to identify potential fraudsters.
        3. Regulators have further recognised the importance of vigil in cyberspace and recommended that banks and UPI Apps put in place mechanisms to identify fraudsters, especially those impersonating the banks or UPI Apps through similar looking websites, posting wrong contact details, etc. 
        4. As the customer poses utmost trust in the bank and UPI Apps when they deposit and store their hard earned money and use their platform to make financial transaction, which casts a further duty on the bank and UPI Apps to protect its customers against deceitful tactics adopted by bad actors to steal the money of the customer lying with the bank. 
        
        Common and generic text to be included in the generated document: The bank and the UPI App provider have clearly failed to comply with the RBI guidelines and NPCI directions and their general duty to implement processes and technologies to ensure bad actors do not misuse bank’s or UPI App’s name, logo or brand to deceit the customers. As per the RBI guidelines, NPCI directions, and settled legal principles, the onus is on the bank and UPI App provider to prove their innocence here.`
},
{
    "qId": "11",
    "Question": "whether the website was in the name of your bank / UPI App with website address of the bank / UPI App?",
    "Parameter": "whether_website_or_app_where_pin_shared_in_bank_or_upi_app_name:",
    "Condition": "app",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very critical:
        1. RBI has mandated banks, and both RBI and NPCI have mandated UPI Apps to actively monitor for the non-genuine/ unauthorised/ malicious mobile applications (with similar name/ features) on popular mobile app-stores and respond accordingly to bring them down. 
        2. Regulators have also recognized that multiple options are available to scan the internet / web ecosystem to identify potential fraudsters.
        3. Regulators have further recognised the importance of vigil in cyberspace and recommended that banks and UPI Apps put in place mechanisms to identify fraudsters, especially those impersonating the banks or UPI Apps through similar looking mobile apps, posting wrong contact details, etc. 
        4. As the customer poses utmost trust in the bank and UPI Apps when they deposit and store their hard earned money and use their platform to make financial transaction, which casts a further duty on the bank and UPI Apps to protect its customers against deceitful tactics adopted by bad actors to steal the money of the customer lying with the bank. 
        
        Common and generic text to be included in the generated document: The bank and the UPI App provider have clearly failed to comply with the RBI guidelines and NPCI directions and their general duty to implement processes and technologies to ensure bad actors do not misuse bank’s or UPI App’s name, logo or brand to deceit the customers. As per the RBI guidelines, NPCI directions, and settled legal principles, the onus is on the bank and UPI App provider to prove their innocence here.`
},
{
    "qId": "12",
    "Question": "whether the website was in the name of your bank / UPI App with website address of the bank / UPI App?",
    "Parameter": "whether_website_or_app_where_pin_shared_in_bank_or_upi_app_name:",
    "Condition": "No",
    "LegalTrainingMaterial": `Include the below point in the generated document as it is very very critical:
        The bank and UPI App provider should be asked to demonstrate whether similar cases where the customers are targeted from a different website or mobile app (maybe through phishing or social media engineering attacks) appeared in the consolidated review of fraud cases detected during any previous period, and if yes, whether the bank and UPI App provider have put any new processes and procedures to combat or mitigate such fraud attempts, and the results of the audit of its effectiveness with any advised for change in the processes and procedures.`
},
{
    "qId": "13",
    "Question": "Did you get the link of this fake website or app on your email or SMS on the email and phone number registered with your bank / UPI App?",
    "Parameter": "fake_website_or_mobileapp_received_on_user_phone_email_registered_with_bank_upiapp",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include the below point in the generated document as it is very very critical:
        1. It appears that the bank and UPI App provider were negligent in safeguarding my personal and sensitive information, as the bad actor would not have been able to reach out to me with the fraud website or mobile app unless the bad actor is aware that I am a customer of this bank or UPI App provider. 
        
        Common and generic text to be included in the generated document: As per the RBI guidelines, NPCI directions, and settled legal principles, the onus is on the bank and UPI App provider to prove their innocence here.`
},
{
    "qId": "14",
    "Question": "Did you get the link of this fake website or app on your email or SMS on the email and phone number registered with your bank / UPI App?",
    "Parameter": "fake_website_or_mobileapp_received_on_user_phone_email_registered_with_bank_upiapp",
    "Condition": "No",
    "LegalTrainingMaterial": `Include the below point in the generated document as it is very very critical::
         The bank and UPI App provider should be asked to demonstrate whether similar cases where the customers are targeted on a different number or email (maybe through phishing or social media engineering attacks) appeared in the consolidated review of fraud cases detected during any previous period, and if yes, whether the bank and UPI App provider have put any new processes and procedures to combat or mitigate such fraud attempts, and the results of the audit of its effectiveness with any advised for change in the processes and procedures.`
},
{
    "qId": "15",
    "Question": "If a bank officer, did you share the UPI PIN with a bank officer while visiting a bank branch?",
    "Parameter": "upi_pin_share_with_bank_or_upiapp_officer_at_bank_office",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include the below point in the generated document as it is very very critical:
         I was “induced and duped” by the bank or UPI App provider’s officer in parting with my sensitive information. As the bank officer or UPI App provider’s officer was representing the bank or UPI App (as the case may be), it is a liability of the bank or UPI App provider to return the defrauded money and make good the loss caused to me, in addition to taking other legal and disciplinary actions against this errant officer and others those who may have connived with the officer.`
},
{
    "qId": "16",
    "Question": "Did you lose / lost your mobile phone or SIM card? if yes. Did you inform the bank ?",
    "Parameter": "did_user_inform_bank_of_lost_mobile_or_mobilesim_card_before_fraud_transaction",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include the below point in the generated document as it is very very critical:
         As per the RBI guidelines, it is very much clear that the bank is liable for any losses that a customer incur in the bank account after notifying the loss of mobile phone or sim card to the bank. The bank has failed to block the UPI ID and thereby failed to perform its duties as mandated by the RBI and under other laws.`
},
{
    "qId": "17",
    "Question": "Did you lose / lost your mobile phone or SIM card? if yes. Did you inform the bank ?",
    "Parameter": "did_user_inform_bank_of_lost_mobile_or_mobilesim_card_before_fraud_transaction",
    "Condition": "No",
    "LegalTrainingMaterial": `Include the below point in the generated document as it is very very critical:
        1. As per the RBI guidelines and settled legal principles a mere non intimation of the loss of mobile phone or sim by customer does not absolve bank from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer.
    
        Common and generic text to be included in the generated document: Even if there is contributory negligence by the customer, the bank is still fully liable to compensate the customer if the bank has been found negligent or there is a deficiency in service by the bank to protect the account of the customer.`
},
{
    "qId": "18",
    "Question": "Did you lose / lost your mobile phone or SIM card? if yes. Did you inform the UPI app?",
    "Parameter": "did_user_inform_upiapp_of_lost_mobile_or_mobilesim_card_before_fraud_transaction",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very critical:
        1. As per the RBI guidelines and NPCI directions it is very much clear that the UPI App is liable for any losses that a customer incur in the bank account after notifying the loss of mobile phone or sim card to the UPI App provider. 
        2. The UPI App provider has failed to block the UPI ID and thereby failed to perform its duties as mandated by the RBI, NPCI and under other laws. 
        3. As the UPI App provider is operating under the bank, it is the responsibility of the bank to make good the losses and compensation to the user, and recover the same from the UPI App provider.`
},
{
    "qId": "19",
    "Question": "Did you lose / lost your mobile phone or SIM card? if yes. Did you inform the UPI app?",
    "Parameter": "did_user_inform_upiapp_of_lost_mobile_or_mobilesim_card_before_fraud_transaction",
    "Condition": "No",
    "LegalTrainingMaterial": `Include the below point in the generated document as it is very very critical:
        1. As per the RBI guidelines, NPCI directions and settled legal principles a mere non intimation of the loss of mobile phone or sim by customer does not absolve UPI Apps and banks from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        
        Common and generic text to be included in the generated document: 
        1. Even if there is contributory negligence by the customer, the UPI App provider and bank are still fully liable to compensate the customer if the UPI App provider has been found negligent or there is a deficiency in service by the UPI App provider to protect the account of the customer. 
        2. As the UPI App provider is operating under the bank, it is the responsibility of the bank to make good the losses and compensation to the user, and recover the same from the UPI App provider.`
},
{
    "qId": "20",
    "Question": "Whether your mobile phone SIM was cloned (you may have received authentication call from your telco, if not, then check with telco) Did you inform the bank before fraud transaction\nDid you inform the bank before fraud transaction?",
    "Parameter": "user_informed_bank_of_sim_clone_before_fraud_transaction",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very very critical: 
        1. As per the RBI guidelines, it is very much clear that the bank is liable for any losses that a customer incur in the bank account after notifying the cloning of the sim card to the bank. 
        2. The bank has failed to block the UPI ID and thereby failed to perform its duties as mandated by the RBI and under other laws.`
},
{
    "qId": "21",
    "Question": "Whether your mobile phone SIM was cloned (you may have received authentication call from your telco, if not, then check with telco) Did you inform the bank before fraud transaction\nDid you inform the bank before fraud transaction?",
    "Parameter": "user_informed_bank_of_sim_clone_before_fraud_transaction",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very very critical: 
        1. As per the RBI guidelines and settled legal principles a mere non intimation of the cloning of the sim by customer does not absolve bank from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        2. Even if there is contributory negligence by the customer, the bank is still fully liable to compensate the customer if the bank has been found negligent or there is a deficiency in service by the bank to protect the account of the customer.`
},
{
    "qId": "22",
    "Question": "Whether your mobile phone SIM was cloned (you may have received authentication call from your telco, if not, then check with telco) Did you inform the bank before fraud transaction Did you inform the UPI app before fraud transaction?",
    "Parameter": "user_informed_upiapp_of_sim_clone_before_fraud_transaction",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very very critical: 
        1. As per the RBI guidelines and NPCI directions UPI App is liable for any losses that a customer incur in the bank account after notifying the cloning of the sim card to the UPI App provider. 
        2. The UPI App provider has failed to block the UPI ID and thereby failed to perform its duties as mandated by the RBI, NPCI and under other laws.
        3. UPI Apps are operating under the contract with the bank, the bank should refund the amount and pay compensation to me and recover the same from the UPI App`
},
{
    "qId": "23",
    "Question": "Whether your mobile phone SIM was cloned (you may have received authentication call from your telco, if not, then check with telco) Did you inform the bank before fraud transaction Did you inform the UPI app before fraud transaction?",
    "Parameter": "user_informed_upiapp_of_sim_clone_before_fraud_transaction",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very very critical: 
        1. As per the RBI guidelines, NPCI directions and settled legal principles a mere non intimation of the cloning of the sim by customer does not absolve banks and UPI Apps from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        2. Even if there is contributory negligence by the customer, the bank and UPI App provider is still fully liable to compensate the customer if the UPI App provider has been found negligent or there is a deficiency in service by the UPI App provider to protect the account of the customer. 
        3. As the UPI App provider is operating under the bank, it is the responsibility of the bank to make good the losses and compensation to the user, and recover the same from the UPI App provider.`
},
{
    "qId": "24",
    "Question": "Have you enabled customer location / geolocation on your UPI App",
    "Parameter": "user_enabled_geolocation_on_upi_app",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very very critical: 
        1. I have enabled my location sharing feature on the mobile phone for the UPI App. 
        2. As per the RBI guidelines and NPCI directions, it was incumbent on the UPI App provider and the bank (who is presumed to have received the location from the UPI App provider) to map the location so received at the time of receiving the UPI Pin with the actual location of the UPI App as installed in my phone. 
        3. Furthermore, they are required by the RBI guidelines and NPCI directions to implement robust surveillance / monitoring of UPI transactions and related technologies including geo tagging and IP address mapping. Failing to do so has caused this loss to me.`
},
{
    "qId": "25",
    "Question": "Did the total amount defrauded exceed the limit you or UPI App or the Bank have set up for daily payments? ",
    "Parameter": "did_the_fraud_amount_exceeded_the_daily_payment_limit",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very very critical: 
        1. Instead of preventing the fraudulent transaction to be undertaken by the fraudster, UPI App provider and Bank permitted the fraudster to transfer the amount more than the set limit.
        2. The UPI App and bank have clearly failed to comply with its duties to safeguard my account against the misuse of the UPI ID and was negligent in implementing security standards and processes. 
        3. the bank and UPI App provider should undertake internal investigation to ensure no such incident occurs ever again, which materially affects the trust posed by the general public in the banking and UPI system.`
},
{
    "qId": "26",
    "Question": "Total amount of refund and compensation you wish to claim from the Bank? You may note that in addition to refund of the defrauded amount, the Banking Ombudsman can also provide compensation upto \u20b91 lakh for mental agony/ harassment/costs/fees etc. suffered by the complainant, and consumer Courts may even provide higher compensation.",
    "Parameter": "compensation_and_damages",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 5 points in the generated document as they are very very critical: 
        1. I am seeking a full refund of the amounts fraudulently transferred.
        2. I additionally seek an interest of 9% per annum till the date I receive the full refund.
        3. I also seek a reasonable and bona fide compensation as provided in the user’s inputs for the harassment, costs, fees and other grave inconvenience and hardship caused to me due to these negligent and non-compliant acts of the bank. 
        4. In my belief RBI guidelines and various legal theories permit me to claim such additional compensation and interest. 
        5. It is also imperative on the bank to seek a claim under any insurance policy for such fraudulent transactions that the bank may have obtained and as per RBI guidelines, the bank should pay the refund, interest and compensation to me while it waits to get the insurance claim.`
},
{
    "qId": "27",
    "Question": "Did you get any SMS from the bank of this UPI transaction?",
    "Parameter": "transaction_sms_recieved",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very very critical: 
        1. RBI has directed the banks to immediately send SMS to the registered mobile number of the customer for any UPI transaction. In this case, since I did not receive any SMS, I was unable to immediately contact the bank and UPI App provider to stop or resolve this fraudulent transaction. 
        2. The bank should be asked to produce the relevant logs and other information to prove that they have sent the SMS to me. 
        3. Irrespective of sending or not sending the SMS, a mere SMS is not the only obligation on the bank and UPI App provider to safeguard the account and money of the customer. RBI and NPCI have also mandated banks and UPI Apps to adopt robust monitoring and surveillance technologies to ensure no fraud occurs on the customers UPI ID.`
},
{
    "qId": "28",
    "Question": "If yes, did you receive the SMS within one hour of the transaction?",
    "Parameter": "transaction_sms_recieved_within_one_hour",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very very critical: 
        1. RBI has directed the banks to immediately send SMS to the registered mobile number of the customer for any banking transaction. In this case, since I received the SMS not immediately but after a considerable delay, which allowed the fraudster to do full harm to my account, I was unable to immediately contact the bank and UPI App provider to stop or resolve this fraudulent transaction. 
        2. The bank should be asked to produce the relevant logs and other information to prove that they have sent the SMS to me immediately. 
        3. Irrespective of sending or not sending the SMS, a mere SMS is not the only obligation on the bank and UPI App provider to safeguard the account and money of the customer. RBI and NPCI have also mandated banks and UPI Apps to adopt robust monitoring and surveillance technologies to ensure no fraud occurs on the customers UPI ID.`
},
{
    "qId": "29",
    "Question": "Did you inform the bank about this fraudulent transaction",
    "Parameter": "informed_bank_fraud_transaction",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very very critical: 
        1. As per the RBI guidelines and settled legal principles a mere non intimation or not informing of the fraudulent transaction by customer does not absolve bank and UPI Apps from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        2. The bank also did not properly implement robust surveillance / monitoring of card transactions and related technologies including geo tagging and IP address mapping intelligence to verify whether the person who is using the UPI OTP is the user and someone else. 
        3. Even if there is contributory negligence by the customer for not informing about the fraudulent transaction, the bank and UPI Apps are still fully liable to compensate the customer if the bank or UPI Apps have been found negligent or there is a deficiency in service by the bank and UPI Apps to protect the account of the customer. 
        4. In fact, the Supreme Court has also held that the development in means of communication  science & technology etc. have led to an enormous increase in economic crimes viz. phishing  OTP frauds etc. which are being committed by intelligent but devious individuals involving huge sums of public or government money. These are actually public wrongs or crimes committed against society and the gravity and magnitude attached to these offences is concentrated on the public at large.`
},
{
    "qId": "30",
    "Question": "If yes, working days (excluding bank holidays) within which you informed the bank",
    "Parameter": "informed_bank_fraud_transaction_within_time",
    "Condition": "Within 3 days",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very very critical: 
        1. Although it is the responsibility of the bank, per RBI guidelines and settled principles of law and banking practice, to implement robust monitoring / surveillance technologies and other processes to safeguard the account of the customer against any frauds, I was extremely diligent to inform the bank about this transaction within the timeline prescribed by the RBI. 
        2. Therefore, it is incumbent on the bank to immediately return the money to my account and pay me adequate compensation for the deficiency of service and other negligent acts`
},
{
    "qId": "31",
    "Question": "If yes, working days (excluding bank holidays) within which you informed the bank",
    "Parameter": "informed_bank_fraud_transaction_within_time",
    "Condition": "Between 4 - 7 days",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very very critical: 
        1. As per the RBI guidelines and settled legal principles a mere delayed intimation of the transaction does not absolve bank from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        2. Even if there is delay by the customer which in this case is a mere delayed intimation between 4 to 7 days, the bank is still fully liable to compensate the customer if the bank has been found negligent or there is a deficiency in service by the bank to protect the account of the customer.`
},
{
    "qId": "32",
    "Question": "If yes, working days (excluding bank holidays) within which you informed the bank",
    "Parameter": "informed_bank_fraud_transaction_within_time",
    "Condition": "More than 7 days",
    "LegalTrainingMaterial": `Include the below 2 points in the generated document as they are very very critical: 
        1. As per the RBI guidelines and settled legal principles a mere delayed intimation of the transaction does not absolve bank from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        2. Even if there is delay which in this case is a mere delayed intimation of more than 7 days, the bank is still fully liable to compensate the customer if the bank has been found negligent or there is a deficiency in service by the bank to protect the account of the customer.`
},
{
    "qId": "33",
    "Question": "Did you inform the UPI App of this fraudulent transaction? If yes, then within which time frame?",
    "Parameter": "informed_UPIapp_fraud_transaction_within",
    "Condition": "Within 2 hours",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very very critical: 
        1. I was prompt and diligent to immediately inform the UPI App provider of this fraudulent payment, which I believe is before the time of the settlement of this fraudulent transaction by NPCI. 
        2. The UPI App provider ought to have undertaken all its efforts to ensure this fraudulent transaction is not settled by NPCI, and is reversed to my account. 
        3. Irrespective of informing or not informing the UPI App provider of the transaction does not absolve UPI App provider from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        4. Even if there is contributory negligence by the customer, the UPI App provider and the bank are still fully liable to compensate the customer if the UPI App provider has been found negligent or there is a deficiency in service by the UPI App provider to protect the account of the customer.`
},
{
    "qId": "34",
    "Question": "Did you inform the UPI App of this fraudulent transaction? If yes, then within which time frame?",
    "Parameter": "informed_UPIapp_fraud_transaction_within",
    "Condition": "After 2 hours",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very very critical:
        1. I was prompt and diligent to immediately inform the UPI App provider of this fraudulent payment, which may be before the time of the settlement of this fraudulent transaction by NPCI. 
        2. The UPI App provider ought to have undertaken all its efforts to ensure this fraudulent transaction is not settled by NPCI, and is reversed to my account. 
        3. Even if my information to the UPI App provider was post the settlement of the fraudulent transaction by NPCI, as per the RBI guidelines, NPCI directions, and settled legal principles a mere delayed intimation of the transaction does not absolve UPI App provider and the bank from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the account of the customer. 
        4. Even if there is contributory negligence by the customer, the UPI App provider and the bank are still fully liable to compensate the customer if the UPI App provider has been found negligent or there is a deficiency in service by the UPI App provider to protect the account of the customer.`
},
{
    "qId": "35",
    "Question": "Did you inform the UPI App of this fraudulent transaction? If yes, then within which time frame?",
    "Parameter": "informed_UPIapp_fraud_transaction_within",
    "Condition": "did not inform",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very very critical:
        1. As per the RBI guidelines, NPCI directions, and settled legal principles a mere non intimation of the fraudulent transaction by customer does not absolve UPI App provider from getting away from its primary duty to implement adequate monitoring / surveillance and other technologies to prevent the frauds in the UPI ID of the customer. 
        2. Even if there is contributory negligence by the customer, the UPI App provider and bank are still fully liable to compensate the customer if the UPI App provider has been found negligent or there is a deficiency in service by the bank to protect the account of the customer.`
},
{
    "qId": "36",
    "Question": "Did you inform the UPI App of this fraudulent transaction? If yes, then within which time frame?",
    "Parameter": "informed_UPIapp_fraud_transaction_within",
    "Condition": "Raised chargeback within 30 days",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very very critical:
        1. I have timely raised the chargeback for this fraudulent transaction. As per the NPCI directions, the beneficiary bank is required to follow its internal process to recover the money after the charge-back is raised by the user. 
        2. The onus is on the beneficiary bank to demonstrate that it rejected the chargeback within the turnaround time provided by NPCI, or that my bank should demonstrate that it has not received the chargeback from the beneficiary bank. 
        3. If the beneficiary bank has rejected the chargeback, then the beneficiary bank should demonstrate the reason for such rejection along with the necessary proof of steps it has taken to investigate and trace the fraudulent transaction and recover the same`
},
{
    "qId": "37",
    "Question": "Did this fraudulent withdrawal happened after you informed the bank or UPI App about an immediate previous fraudulent transaction",
    "Parameter": "transaction_happen_after_informed_bank_or_UPIapp_of_previous_fraud",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very very critical:
        1. As per the RBI guidelines and NPCI directions, it is very much clear that the bank and UPI App provider are liable for any losses that a customer incur in the bank account after notifying any fraudulent transaction or misuse of UPI ID to the bank or the UPI App provider. 
        2. The bank and UPI App provider have failed to block the UPI ID and thereby failed to perform its duties as mandated by the RBI, NPCI and under other laws.`
},
{
    "qId": "38",
    "Question": "Are you aware that the fraudster has used your UPI PIN within the same city where you were present at that time?",
    "Parameter": "fraudster_used_UPIpin_in_user_city_and_user_present_in_that_city",
    "Condition": "Yes",
    "LegalTrainingMaterial": `Include all the below 2 points in the generated document as they are very very critical:
        1. Bank and UPI App providers are required by the RBI guidelines and NPCI directions to implement robust surveillance / monitoring of UPI transactions and related technologies including geo tagging and IP address mapping. Failing to do so has caused this loss to me, as it appears that the fraudster used my UPI Pin from a different city.`
},
{
    "qId": "39",
    "Question": "Are you aware that the fraudster has used your UPI PIN within the same city where you were present at that time?",
    "Parameter": "fraudster_used_UPIpin_in_user_city_and_user_present_in_that_city",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 4 points in the generated document as they are very very critical:
        1. Bank and UPI App providers are required by the RBI guidelines and NPCI directions to implement robust surveillance / monitoring of UPI transactions and related technologies including geo tagging and IP address mapping. 
        2. Bank and UPI App provider to be called upon to prove that such technologies were implemented and were working and that the IP address and geolocation of my phone was same as that from where the fraudulent transaction took place.`
},
{
    "qId": "40",
    "Question": "Did you share your UPI PIN with anyone?",
    "Parameter": "did_user_share_upi_pin",
    "Condition": "No",
    "LegalTrainingMaterial": `Include all the below 3 points in the generated document as they are very critical:
        1. This is a prima facie case of utter gross negligence and mala fide intent at the bank’s or UPI App’s side which may involve connivance of the bank’s or UPI App’s officers, including unauthorizedly sharing my information to cause wrongful harm to me. 
        2. The onus is on the bank and UPI App provider to demonstrate how a different person can make a UPI transaction from my UPI ID by using my UPI Pin. 
        3. The RBI and NPCI have also mandated banks and UPI App provider to not share customer information, and in this case there could be a possibility that the bank / UPI App provider or its employee has access to my UPI Pin and have shared the information to cause wrongful loss to me, or the bank’s or UPI App systems were not strong to prevent a third party to access my UPI Pin and undertake a fraudulent transaction.`
}
]