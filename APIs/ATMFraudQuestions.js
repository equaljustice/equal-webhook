import {qjson}  from "../JSONs/allQustions.js"
const getQuestionJson = async(req, res) => {
    res.send(qjson);
}
export {getQuestionJson};