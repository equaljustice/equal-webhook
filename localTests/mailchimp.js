import mailchimpClient from "@mailchimp/mailchimp_transactional"
const mailchimpClient1 = new mailchimpClient(
    "md-it8Upep8tA7b-Lp1Z_QA_g"
  );    

async function run() {
  const response = await mailchimpClient1.users.ping();
  console.log(response);
}

run();