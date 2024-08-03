const axios = require('axios');

const HttpError = require('../models/http-error');

const getCoordsForAddress = async (address) => {
    const response = await axios.get(
        `https://nominatim.openstreetmap.org/?addressdetails=1&q=${encodeURIComponent(
            address
        )}&format=json&limit=1`
    );
    const data = response.data;

    if (!data) {
        const error = new HttpError("Could not find location for this address", 422);
        throw error;
    };

    const coordinates = {
        lat: data[0].lat,
        lng: data[0].lon,
    };

    return coordinates;
};

module.exports = getCoordsForAddress;