import banks from '../JSONs/banks.json' assert {type: "json"}; 
const getBanks = async(req, res) => {
res.send(banks);
}
export {getBanks}