'use strict';

const Quest = require('../models/quest');
const HttpStatus = require('http-status');
const urls = require('../utils/url-generator');

const SORTING_FIELDS = ['creationDate', 'likesCount'];

function extractFieldName(sortBy) {
    if (sortBy.startsWith('-')) {
        return sortBy.substring(1);
    }
    return sortBy;
}

exports.list = (req, res, next) => Quest.find({})
    .sort(req.query.sortBy && ~SORTING_FIELDS.indexOf(extractFieldName(req.query.sortBy))
        ? req.query.sortBy
        : '-creationDate')
    .populate('photos author')
    .then(quests =>
        quests.filter(quest =>
            quest.published || quest.isAccessibleToUser(req.user)
        )
    )
    .then(quests => res.render('main', {quests}))
    .catch(next);

exports.show = (req, res, next) =>
    Quest.findById(req.params.id)
        .populate('photos author comments.author')
        .then(quest => {
            if (!quest) {
                const err = new Error(`There is no quest with id ${req.params.id}`);
                err.status = HttpStatus.NOT_FOUND;
                throw err;
            }
            const clientIsAllowedToSeeQuest = quest.published || quest.isAccessibleToUser(req.user);
            if (!clientIsAllowedToSeeQuest) {
                const err = new Error('You are not allowed to see this quest right now');
                err.status = HttpStatus.FORBIDDEN;
                throw err;
            }
            res.render('quest', {quest});
        })
        .catch(next);

exports.publish = (req, res, next) =>
    Quest.findById(req.params.id)
        .then(quest => {
            if (!quest.isAccessibleToUser(req.user)) {
                const err = new Error('You are not allowed to modify this quest');
                err.status = HttpStatus.FORBIDDEN;
                throw err;
            }

            quest.published = true;
            return quest.save();
        })
        .then(quest => res.redirect(urls.quests.specific(quest.id)))
        .catch(next);

exports.create = (req, res, next) => {
    if (req.method === 'POST') {
        return new Quest({
            name: req.body.name,
            description: req.body.description,
            author: req.user
        })
            .save()
            .then(quest => res.redirect(urls.quests.specific(quest.id)))
            .catch(next);
    }
    res.render('createQuest', {recaptcha: req.recaptcha});
};

exports.createComment = (req, res, next) =>
    Quest.findById(req.params.id)
        .then(quest => {
            if (!quest) {
                const err = new Error(`There is no quest with id ${req.params.id}`);
                err.status = HttpStatus.NOT_FOUND;
                throw err;
            }

            if (!quest.published) {
                const err = new Error(`Quest with id: ${req.body.questId} is not published yet. Commenting is disabled`);
                err.status = HttpStatus.FORBIDDEN;
                throw err;
            }

            quest.comments.push({text: req.body.text, author: req.user});
            return quest.save();
        })
        .then(quest => res.redirect(urls.quests.specific(quest.id)))
        .catch(next);

