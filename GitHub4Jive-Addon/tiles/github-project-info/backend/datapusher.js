/*
 * Copyright 2013 Jive Software
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

var jive = require("jive-sdk");
var q = require('q');

var placeStore = require("github4jive/placeStore");
var gitFacade = require("github4jive/gitHubFacade");
var tileFormatter = require("github4jive/tileFormatter");

var GITHUB_PROJECT_INFO_TILE = 'github-project-info';

/**
 * Handles actually pushing data to the tile instance
 * @param instance
 */
var processTileInstance = function(instance) {
    if ( instance.name === GITHUB_PROJECT_INFO_TILE ) {
        var place = instance.config.parent;
        return placeStore.getPlaceByUrl(place).then(function (linked) {
            var auth = gitFacade.createOauthObject(linked.github.token.access_token);
            return gitFacade.getRepository(linked.github.repoOwner, linked.github.repo, auth).then(function (repo) {
                var dataToPush = tileFormatter.formatTableData(repo.full_name, [
                    {name: "Last Updated", value: new Date(repo.pushed_at).toDateString()},
                    {name: "Open Issues", value: repo.open_issues_count.toString()},
                    {name: "Subscribers", value: repo.subscribers_count.toString()},
                    {name: "Forks", value: repo.forks_count.toString()}

                ]);
                dataToPush.action = {"url":repo.html_url , "text": "Go To Repository"};
                jive.tiles.pushData(instance, {"data": dataToPush});
            });
        })
    }


};

/**
 * Iterates through the tile instances registered in the service, and pushes an update to it
 */
var pushData = function() {
    var deferred = q.defer();
    jive.tiles.findByDefinitionName(GITHUB_PROJECT_INFO_TILE).then(function(instances) {
        if (instances) {
            q.all(instances.map(processTileInstance)).then(function() {
                deferred.resolve(); //success
            }, function() {
                deferred.reject(); //failure
            });
        } else {
            jive.logger.debug("No jive instances to push to");
            deferred.resolve();
        }
    });
    return deferred.promise;
};

/**
 * Schedules the tile update task to automatically fire every 10 seconds
 */
exports.task = [
    {
        'interval' : 600000,//ten minutes
        'handler' : pushData
    }
];

/**
 * Defines event handlers for the tile life cycle events
 */
exports.eventHandlers = [

    // process tile instance whenever a new one is registered with the service
    {
        'event' : jive.constants.globalEventNames.NEW_INSTANCE,
        'handler' : processTileInstance
    },

    // process tile instance whenever an existing tile instance is updated
    {
        'event' : jive.constants.globalEventNames.INSTANCE_UPDATED,
        'handler' : processTileInstance
    }
];


