import axios from 'axios';
import { extractTextFromDocument } from '../utils/readFileData.js';

export async function sendWatsAppReplyText(textResponse, to, message_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "text",
    "text": {
      "preview_url": false,
      "body": textResponse
    }
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://graph.facebook.com/v20.0/382211174979358/messages',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.WhatsApp_Token
    },
    data: data
  };

  axios.request(config)
    .then((response) => {
      console.log("send reply text", JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });
}

export async function markAsRead(message_id) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "status": "read",
    "message_id": message_id
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://graph.facebook.com/v20.0/382211174979358/messages',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.WhatsApp_Token
    },
    data: data
  };

  axios.request(config)
    .then((response) => {
      console.log("MarkAsRead", JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });
}

export async function getWAMediaURL(mediaId, phoneId) {
  try {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/v20.0/${mediaId}?phone_number_id=${phoneId}`,
      headers: {
        'Authorization': process.env.WhatsApp_Token
      }
    };

    const response = await axios.request(config)
    console.log("media", response.data)
    return response.data;
  } catch (error) {
    console.log(error);
  }

}

export async function downloadWAFile(mediaUrl) {
  try {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: mediaUrl,
      headers: {
        'Authorization': process.env.WhatsApp_Token
      }
    };

    const response = await axios.request(config)

    //console.log("downloaded file", JSON.stringify(response.data));
    return response;
  } catch (error) {
    console.log(error);
  }

}