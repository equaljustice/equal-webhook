import {banks} from '../JSONs/banks.js'
const getBanks = async(req, res) => {
res.send(banks);
}
export {getBanks}