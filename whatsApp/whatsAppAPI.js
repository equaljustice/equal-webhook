import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logging.js';
import { trimString } from './DFchipsToButtons.js';
import { checkFileAvailability } from '../CloudStorage/checkFileReadyness.js';

async function callWhatsAppAPI(data, phone_number_id) {
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `https://graph.facebook.com/v20.0/${phone_number_id}/messages`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.WhatsApp_Token
    },
    data: data
  };

  axios.request(config)
    .then((response) => {
      logger.info(`sent WA reply: ${data}`);
    })
    .catch((error) => {
      logger.error(error);
    });
}

export async function sendWatsAppReplyText(textResponse, to, phone_number_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "text",
    "text": {
      "preview_url": false,
      "body": trimString(textResponse, 4096)
    }
  });

  callWhatsAppAPI(data, phone_number_id);
}

export async function sendWatsAppVideo(to, phone_number_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "video",
    "video": {
      "id": "495841383370609", /* Only if using uploaded media */
      "caption": "Introduction to EqualJustice.ai"
    }
  });

  callWhatsAppAPI(data, phone_number_id);
}

export async function markAsRead(message_id, phone_number_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "status": "read",
    "message_id": message_id
  });

  callWhatsAppAPI(data, phone_number_id);
}

export async function getWAMediaURL(mediaId, phone_number_id) {
  try {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/v20.0/${mediaId}?phone_number_id=${phone_number_id}`,
      headers: {
        'Authorization': process.env.WhatsApp_Token
      }
    };

    const response = await axios.request(config)
    //console.log("media", response.data)
    return response.data;
  } catch (error) {
    logger.error(error);
  }

}

export async function downloadWAFile(mediaUrl, filename) {
  return new Promise((resolve, reject) => {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: mediaUrl,
        headers: {
          'Authorization': process.env.WhatsApp_Token,
        },
        responseType: 'stream',
      };

      axios
        .request(config)
        .then((response) => {
          const mediaPath = path.resolve(
            './CloudStorage',
            filename
          ); // Add appropriate file extension like .pdf or .jpg

          const writer = fs.createWriteStream(mediaPath);

          response.data.pipe(writer);

          writer.on('finish', () => {
            resolve(mediaPath); // Resolve the promise with the file path
          });

          writer.on('error', (err) => {
            logger.error(err);
            reject(err); // Reject the promise if there's an error
          });
        })
        .catch((error) => {
          logger.error(error);
          reject(error); // Reject the promise if download fails
        });
    } catch (error) {
      reject(error); // Catch any other errors and reject the promise
    }
  });
}

export async function sendWatsAppWithButtons(textResponse, buttons, footer = '', to, phone_number_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": {
        "text": trimString(textResponse, 1024)
      },
      "footer": {
        "text": trimString(footer, 60)
      },
      "action": {
        buttons
      }
    }
  });

  callWhatsAppAPI(data, phone_number_id);
}


export async function sendWatsAppWithList(textResponse, sections, header = '', footer = '', to, phone_number_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "interactive",
    "interactive": {
      "type": "list",
      "header": {
        "type": "text",
        "text": trimString(header, 60)
      },
      "body": {
        "text": trimString(textResponse, 4096)
      },
      "footer": {
        "text": trimString(footer, 60)
      },
      "action": sections
    }
  });

  callWhatsAppAPI(data, phone_number_id);
}

export async function sendWatsAppWithRedirectButton(textResponse, file, header = '', footer = '', to, phone_number_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "interactive",
    "interactive": {
      "type": "cta_url",
      "header": {
        "type": "text",
        "text": header
      },
      "body": {
        "text": textResponse
      },
      "footer": {
        "text": footer
      },
      "action": file
    }
  });

  callWhatsAppAPI(data, phone_number_id);
}

export async function sendWhatsAppFileLink(textResponse, file, header = '', footer = '', to, phone_number_id) {
  let fileAvailable = false;
  let counter = 0;
  while (!fileAvailable && counter < 6) {
    fileAvailable = await checkFileAvailability(file.parameters.url);
    if(fileAvailable)
      sendWatsAppWithRedirectButton(textResponse, file, header, footer, to, phone_number_id);
    // Adjust the delay (in milliseconds) based on your requirements
    await new Promise(resolve => setTimeout(resolve, 15000));  // 10 seconds delay
    counter = counter+1;
  }
  }


