//import {qjson}  from "../JSONs/allQustions.js"
import { getATMDataAsJson } from "./createATMQuestions.js"
import { getFAILED_TXNDataAsJson } from "./createFailedTxnQuestions.js";
import * as types from '../utils/types.js'
const getQuestionJson = async (req, res) => {
  switch (req.body.transaction) {
    case types.transaction.ATM:
      getATMDataAsJson()
        .then(jsonData => {
          console.log(JSON.stringify(jsonData, null, 2)); // Print the JSON data
          res.send(jsonData);
        })
        .catch(error => {
          console.error('Error fetching data:', error);
        });

      break;
    case types.transaction.FAILED_TRANASACTION:
      getFAILED_TXNDataAsJson()
        .then(jsonData => {
          console.log(JSON.stringify(jsonData, null, 2)); // Print the JSON data
          res.send(jsonData);
        })
        .catch(error => {
          console.error('Error fetching data:', error);
        });
      break;
  }
}
export { getQuestionJson };


