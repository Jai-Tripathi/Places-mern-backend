const fs = require('fs');
const HttpError = require('../models/http-error');
const { validationResult } = require('express-validator');
const getCoordsForAddress = require('../util/location');
const mongoose = require('mongoose');

const Place = require('../models/place');
const User = require('../models/user');


const getPlaceById = async (req, res, next) => {
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId);

    } catch (err) {
        return next(new HttpError('Error retrieving place.', 500));
    }

    if (!place) {
        return next(new HttpError('Could not find a place for the provided id.', 404));
    }

    res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
    const userId = req.params.uid;

    let userWithPlaces;
    try {
        userWithPlaces = await User.findById(userId).populate('places');
    } catch (err) {
        return next(new HttpError('Error retrieving places.', 500));
    }

    if (!userWithPlaces || userWithPlaces.places.length === 0) {
        return next(new HttpError('Could not find places for the provided user id.', 404));
    }

    res.json({ places: userWithPlaces.places.map(place => place.toObject({ getters: true })) });
};

const createPlace = async (req, res, next) => {
    console.log('In createPlace');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs, please check your data.', 422));
    }

    const { title, description, address } = req.body;

    let coordinates;
    try {
        console.log('Before getting coordinates');
        coordinates = await getCoordsForAddress(address);
    } catch (err) {
        return next(err);
    };
    console.log('After getting coordinates');

    const createdPlace = new Place({
        title,
        description,
        location: coordinates,
        address,
        image: req.file.path,
        creator: req.userData.userId
    });

    console.log('After createdPlace is created');

    let user;

    try {
        console.log('Before finding user');
        user = await User.findById(req.userData.userId);
    } catch (err) {
        return next(new HttpError('Could not find the user for provided id.', 500));
    };

    if (!user) {
        return next(new HttpError('Could not find the user for provided id.', 404));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({ session: sess });
        user.places.push(createdPlace);
        await user.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        return next(new HttpError('Creating place failed, please try again.', 500));
    };

    res.status(201).json({ place: createdPlace })

};

const updatePlace = async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs, please check your data.', 422));
    }
    const { title, description } = req.body;
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        return next(new HttpError('Error updating place.', 500));
    }

    if (place.creator.toString() !== req.userData.userId) {
        return next(new HttpError('You are not allowed to update this place.', 401));
    }

    place.title = title;
    place.description = description;

    try {
        await place.save();
    } catch (err) {
        return next(new HttpError('Failed to update place.', 500));
    }


    res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId).populate('creator');
    } catch (err) {
        return next(new HttpError('Could not find a place for the provided id.', 500));
    };

    if (place.creator.id !== req.userData.userId) {
        return next(new HttpError('You are not allowed to delete this place.', 401));
    }

    const imagePath = place.image;

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await place.deleteOne({ session: sess });
        place.creator.places.pull(place);
        await place.creator.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        return next(new HttpError('Could not delete place.', 500));
    };

    fs.unlink(imagePath, (err) => {
        if (err) {
            console.log(err);
        }
    });

    res.status(200).json({ message: 'Place deleted successfully.' });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;