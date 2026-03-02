export const USERINPUTFILENAME = "UserInput",
  PUBLIC_BUCKET_DEV = "ejustice-public-bucket",
  GPT3_5 = "GPT3_5",
  GPT3_5_FINE_TUNED = "GPT3_5FineTuned",
  FINE_TUNED_RESPONSE_JSON = "FineTunedJson",
  GPT3_5_RESPONSE_JSON = "GPT3_5Json",
  GPT4 = "GPT4",
  GPT4_RESPONSE_JSON = "GPT4Json",
  ASSISTANT = "Assistant",
  PUBLIC_BUCKET_URL = "https://storage.googleapis.com/ejustice-public-bucket";

// Special access users who can use services without payment
// Add user IDs to this array to grant special access
export const SPECIAL_ACCESS_USER_IDS = [
  "68fb2361becd55065b10a6c3",
  // Add more user IDs here as needed
];

// Document generation configuration
export const DOCUMENT_CONFIG = {
  branding: {
    companyName: "EqualJustice",
    email: "equal@equaljustice.ai",
    trademark: "EqualJustice",
  },
  templates: {
    headerFooterHtml: "assets/templates/header-footer.html",
    wordTemplate: "assets/templates/document-template.docx",
  },
  pdf: {
    format: "A4",
    margin: {
      top: "60px",
      right: "40px",
      bottom: "60px",
      left: "40px",
    },
    printBackground: true,
  },
};
