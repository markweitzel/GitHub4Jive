/*
 * Copyright 2014 Jive Software
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
var gitHubFacade = require("github4jive/gitHubFacade");
var JiveContentBuilder = require("github4jive/JiveContentBuilder");
var helpers = require("github4jive/helpers");

var strategyBase = require("github4jive/strategies/EventStrategyBase");
var issueCommentStrategy = Object.create(strategyBase);
module.exports = issueCommentStrategy;

issueCommentStrategy.name = "Place_IssueComments";

function commentDidNotOriginateFromJive(gitComment) {
    return gitComment.indexOf("<!--Jive-->") != 0;
}

function formatGitComment(gitComment) {
    gitComment = "<!--GitHub-->" + gitComment;
}

function addCommentToDiscussion(jiveApi, gitData, gitAuth, discussion){
    if(discussion){
        return gitHubFacade.getUserDetails(gitData.comment.user.login, gitAuth).then(function (user) {
            var builder = new JiveContentBuilder();
            var gitComment = gitData.comment.body;
            formatGitComment(gitComment);
            var comment = builder.message()
                .body(gitComment)
                .onBehalfOf(user.email || "", user.login)
                .build();
            return jiveApi.replyToDiscussion(discussion.contentID , comment).then(function (response) {
                if (!response.success) {
                    jive.logger.error("Error creating comment on " + discussion.subject, response);
                }else{
                    jiveApi.attachPropsToReply(response.entity.id,{fromGitHub: true}).then(function (response) {
                        if (!response.success) {
                            jive.logger.error("Error attaching props to comment", response);
                        }
                    })
                }
            })
        });

    }
}

/*
 * This strategy modifies anything in a place that is not on a tile in response to a created issue comment.
 * It could be split into separate strategies for fine grain configuration with the builder. Client code
 * should never be calling this function directly. It should be called from the StrategySetBuilderBase.
 * Which is invoked from the StrategySet.setup function returned from builder.build().
 *
 * Override of EventStrategyBase.Setup
 * SetupOptions are provided by a placeController.
 *
 */
issueCommentStrategy.setup = function(setupOptions) {

    var jiveApi = setupOptions.jiveApi;
    var owner = setupOptions.owner;
    var repo = setupOptions.repo;
    var auth = gitHubFacade.createOauthObject( setupOptions.gitHubToken);

    return gitHubFacade.subscribeToRepoEvent(owner, repo, gitHubFacade.Events.IssueComment, auth, function (gitData) {
        //GitHub comment event handler
        var gitComment = gitData.comment.body;

        if(commentDidNotOriginateFromJive(gitComment)){
            helpers.getDiscussionForIssue(jiveApi,setupOptions.placeUrl, gitData.issue.id)
                .then(function (discussion) {
                    addCommentToDiscussion(jiveApi, gitData, auth, discussion);
                })
                .catch(function (error) {
                    jive.logger.error(error);
            });
        }
    });
};
