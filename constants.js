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

/**
 * Layout profiles for PDF/DOCX generation. Add new ids when you add a new layout
 * block in documentGenerator (e.g. legal_notice, prenup).
 */
export const DOCUMENT_TEMPLATE_PROFILE = {
  DEFAULT: "default",
  WILL: "will",
};

/**
 * Maps Session.assistantKey (product use-case) to a DOCUMENT_TEMPLATE_PROFILE value.
 * One assistant key → one template. Unlisted keys use metadata/heuristic fallback.
 */
export const ASSISTANT_KEY_TO_DOCUMENT_TEMPLATE = {
  will: DOCUMENT_TEMPLATE_PROFILE.WILL,
  will_instructions: DOCUMENT_TEMPLATE_PROFILE.WILL,
  create_my_will: DOCUMENT_TEMPLATE_PROFILE.WILL,
};

/**
 * User-facing brand strings. BRAND env: "equaljustice" (default) | "jollyji".
 * Read lazily (dotenv loads after ESM imports). Internal identifiers such as
 * the "ej:" Redis prefixes and data-ej-* markers are deliberately not branded.
 */
export const BRANDS = {
  equaljustice: {
    id: "equaljustice",
    name: "EqualJustice",
    trademark: "EqualJustice",
    email: "equal@equaljustice.ai",
    site: "equaljustice.ai",
    guestEmailDomain: "guest.equaljustice.local",
    watermarkSvg: "assets/templates/ej-watermark.svg",
  },
  jollyji: {
    id: "jollyji",
    name: "JollyJi",
    trademark: "JollyJi",
    email: "askjolly@jollyji.in",
    site: "jollyji.in",
    guestEmailDomain: "guest.jollyji.local",
    watermarkSvg: "assets/templates/jollyji-watermark.svg",
  },
};

export function getBrand() {
  const id = String(process.env.BRAND || "").trim().toLowerCase();
  return BRANDS[id] || BRANDS.equaljustice;
}

// Document generation configuration
export const DOCUMENT_CONFIG = {
  get branding() {
    const brand = getBrand();
    return {
      companyName: brand.name,
      email: brand.email,
      trademark: brand.trademark,
    };
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
