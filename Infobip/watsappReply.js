import { Infobip, AuthType } from "@infobip-api/sdk";

let infobip = new Infobip({
    baseUrl: "l3ldrd.api-in.infobip.com",
    apiKey: process.env.Infobip_API_KEY || 'd6fb60da61cb665c3b74520f6d2b85a0-76c021d9-d4e3-467f-b73f-e6e6a5736442',
    authType: AuthType.ApiKey,
  });


  export async function sendWatsAppReplyText(textResponse, from, to){
    let response = await infobip.channels.whatsapp.send({
        type: "text",
        from,
        to,
        content: {
          text: textResponse,
        },
      });
      
      console.log("sendWatsAppReplyText: ", response);
  }

  export async function markAsRead(from, messageId) {
    let response = await infobip.channels.whatsapp.markAsRead(from, messageId);
    console.log("markAsRead: ", response)
  }

  