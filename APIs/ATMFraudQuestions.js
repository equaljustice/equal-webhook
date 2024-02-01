import qjson  from "../JSONs/section-group-format.json" assert {type: "json"}; 
const getQuestionJson = async(req, res) => {
    res.send(qjson);
}
export {getQuestionJson};