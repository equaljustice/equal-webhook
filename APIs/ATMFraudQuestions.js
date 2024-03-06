import qjson  from "../JSONs/allQustions.json" assert {type: "json"}; 
const getQuestionJson = async(req, res) => {
    res.send(qjson);
}
export {getQuestionJson};