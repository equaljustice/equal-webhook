

const getStates = async (req, res) => {
    var headers = new Headers();
    headers.append("X-CSCAPI-KEY", process.env.countrystatecity);
    var requestOptions = {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
    };
console.log("env sta",headers);
    fetch("https://api.countrystatecity.in/v1/countries/IN/states", requestOptions)
        .then(response => response.text())
        .then(result => res.send(result))
        .catch(error => console.log('error', error));
}

const getCities = async (req, res) => {
    var headers = new Headers();
    headers.append("X-CSCAPI-KEY", process.env.countrystatecity);
    const stateCode = req.params.stateCode;
    var requestOptions = {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
    };

    fetch(`https://api.countrystatecity.in/v1/countries/IN/states/` + stateCode + `/cities`, requestOptions)
        .then(response => response.text())
        .then(result => res.send(result))
        .catch(error => console.log('error', error));
}
export { getStates, getCities };