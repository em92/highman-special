var fs = require('fs');
var extend = require('util')._extend;
var d2s = require('./d2s_qc.json');
var _ = require('lodash');

var NO_ERROR = 0;
var INVALID_GAMETYPE = 1;
var INVALID_PLAYER_COUNT = 2;
var INVALID_STEAM_ID = 3;
var STEAM_ID_ALREADY_SET = 4;
var STEAM_ID_NOT_SET = 5;
var GET_PLAYER_SUMMARIES_ERROR = 6;
var STEAM_ID_ALREADY_ASSIGNED = 7;
var ERROR_LIST = [
	'no error',
	'invalid gametype',
	'invalid player count (must be even)',
	'invalid steam id',
	'nick already set. use /force_map method',
	'undefined nick',
	'error in GetPlayerSummaries: ',
	'nick is already assigned to another discord user',
	null
];

var getDiscordIdByNick = function(steam_id) {
  var result = _.findKey(d2s, (item) => (item == steam_id));
  return (typeof(result) != "undefined") ? result : 0;
}

var getNicks = function(discordIds) {
  var failed = [];
  var result = [];
  discordIds.forEach( function( discordId ) {
    if ( d2s[discordId] ) {
      result.push({
        discord_id: discordId,
        nick: d2s[discordId]
      });
    } else {
      failed.push( discordId );
    }
  });
  return {
    result: result,
    failed: failed
  };
}


var getNick = function(discordId) {
  if (d2s[discordId]) {
    return {
      nick: d2s[discordId],
      ok: true
    };
  } else {
    return {
      error_code: STEAM_ID_NOT_SET,
      error_msg: ERROR_LIST[STEAM_ID_NOT_SET],
      ok: false
    }
  }
}


var setNick = function(discordId, nick, done) {
  d2s[discordId] = nick;
  fs.writeFile("./d2s_qc.json", JSON.stringify(d2s, null, 2), function(error) {
    if (error) {
      done({
        error_code: -1,
        error_msg: error.message,
        ok: false
      });
    } else {
      done({
        ok: true
      });
    }
  });
};


var setNickPrimary = function(discordId, nick, done) {
  if (typeof(d2s[discordId]) != 'undefined') {
    done({
      ok: false,
      error_code: STEAM_ID_ALREADY_SET,
      error_msg: ERROR_LIST[STEAM_ID_ALREADY_SET]
    });
  } else if (getDiscordIdByNick(nick) !== 0) {
    done({
      ok: false,
      error_code: STEAM_ID_ALREADY_ASSIGNED,
      error_msg: ERROR_LIST[STEAM_ID_ALREADY_ASSIGNED]
    });
  } else {
    setNick(discordId, nick, done);
  }
};

module.exports.setNick = setNick;
module.exports.setNickPrimary = setNickPrimary;
module.exports.getNicks = getNicks;
module.exports.getNick = getNick;
