var fs = require('fs');
var extend = require('util')._extend;
var d2s = require('./d2s.json');
var rp = require('request-promise');
var Q = require('q');

var steamApiKey = process.env['STEAM_WEB_API_KEY'];
var ratingApiSource = require('./cfg.json').ratingApiSource;
var playerInfoApi = require('./cfg.json').playerInfoApi;
var topListApi = require('./cfg.json').topListApi;
var mapratingApiSource = require('./cfg.json').mapratingApiSource;

var GAMETYPES_AVAILABLE = ['ctf', 'tdm'];
var NO_ERROR = 0;
var INVALID_GAMETYPE = 1;
var INVALID_PLAYER_COUNT = 2;
var INVALID_STEAM_ID = 3;
var STEAM_ID_ALREADY_SET = 4;
var STEAM_ID_NOT_SET = 5;
var GET_PLAYER_SUMMARIES_ERROR = 6;
var ERROR_LIST = [
	'no error',
	'invalid gametype',
	'invalid player count (must be even)',
	'invalid steam id',
	'steam id already set. use /force_map method',
	'undefined steam id',
	'error in GetPlayerSummaries: '
];

var removeColorsFromQLNickname = function(name) {
	name = name.split("^0").join("");
	name = name.split("^1").join("");
	name = name.split("^2").join("");
	name = name.split("^3").join("");
	name = name.split("^4").join("");
	name = name.split("^5").join("");
	name = name.split("^6").join("");
	name = name.split("^7").join("");
	return name;
};

var GetPlayerSummaries = function(steamids) {
	if (steamids instanceof Array) steamids = steamids.join(",");
	return rp({
		uri: 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + steamApiKey + '&steamids=' + steamids,
		timeout: 3000,
		json: true
	})
	.catch( error => {
		throw {
			error_code: GET_PLAYER_SUMMARIES_ERROR,
			error_msg: error.message
		};
	});
};


var getRatingsForSteamIds = function(steamids, gametype, mapname) {
	if (steamids instanceof Array) steamids = steamids.join("+");
	return rp({
		uri: typeof(mapname) == "undefined" ? ratingApiSource + steamids : mapratingApiSource + gametype + "/" + mapname + "/" + steamids,
		timeout: 3000,
		json: true
	})
	.then( data => {
		
		var result = {};
		steamids.split("+").forEach(steamid => {
			result[steamid] = {};
			GAMETYPES_AVAILABLE.forEach(gametype => {
				result[steamid][gametype] = {rating: 1, games: 0};
			});
		});
		
		data.players.forEach( player => {
			GAMETYPES_AVAILABLE.forEach( gametype => {
				if (typeof(player[gametype]) != 'undefined') {
					result[player.steamid][gametype].rating = player[gametype].elo;
					result[player.steamid][gametype].games = player[gametype].games;
				}
			});
		});
		
		// { "76561198002515349": { "ctf": { "games": 10, "rating": 20.10 }, "tdm": { "games": 20, "rating": 30.10 } }
		return result;
	});
};


var templateErrorCallback = function(done) {
	return function(error) {
		if (error.message) {
			done({
				ok: false,
				error_code: -1,
				error_msg: error.message
			});
		} else {
			done(extend({ok: false}, error));
		};
	};
};


var getSteamId = function(discordId, done) {
	if (typeof(d2s[discordId]) == 'undefined') {
		done({
			ok: false,
			error_code: STEAM_ID_NOT_SET,
			error_msg: ERROR_LIST[STEAM_ID_NOT_SET]
		});
		return;
	}
	
	var steamId = d2s[discordId];
	
	return GetPlayerSummaries(steamId)
	.then( data => {
		if (data.response.players.length == 0) throw {
			error_code: INVALID_STEAM_ID,
			error_msg: ERROR_LIST[INVALID_STEAM_ID]
		};
		done({
			ok: true,
			steamid: steamId,
			steamname_real: data.response.players[0].personaname,
			steamname: removeColorsFromQLNickname(data.response.players[0].personaname)
		});
	})
	.catch( templateErrorCallback(done) );
};


var getRatingsForDiscordId = function(discordId, done) {
	if (typeof(d2s[discordId]) == 'undefined') {
		done({
			ok: false,
			error_code: STEAM_ID_NOT_SET,
			error_msg: ERROR_LIST[STEAM_ID_NOT_SET]
		});
		return;
	}
	
	var steamId = d2s[discordId];
	
	return rp({
		uri: playerInfoApi + steamId,
		timeout: 3000,
		json: true
	})
	.then( data => {
		var player = data.player;
		var result = {};
		GAMETYPES_AVAILABLE.forEach( gametype => {
			result[gametype] = {};
			if (typeof(player[gametype]) != 'undefined') {
				result[gametype].rating = player[gametype].rating;
				result[gametype].games = player[gametype].n;
				if (typeof(player[gametype].history) == "undefined") {
					result[gametype].history = [];
				} else {
					var history = player[gametype].history.slice(-4);
					result[gametype].history = history.map( (item, i) => {
						if ( !(item.rank) || (item.rank==null) ) {
							item.rank = 0;
						}
						if (i == 0) {
							item.change = 0;
						} else if (history[i-1].rating < history[i].rating) {
							item.change = 1;
						} else {
							item.change = -1;
						}
						
						if (i == 0) {
							item.rank_change = 0;
						} else if (history[i-1].rank < history[i].rank) {
							item.rank_change = 1;
						} else if (history[i-1].rank > history[i].rank) {
							item.rank_change = -1;
						} else {
							item.rank_change = 0;
						}
						return item;
					}).slice(-3).reverse();
				}
			} else {
				result[gametype].rating = 1;
				result[gametype].games = 0;
				result[gametype].history = [];
			}
		});
		
		var stats = GAMETYPES_AVAILABLE.map(gametype => {
			return {
				type: gametype,
				rating: result[gametype].rating,
				games: result[gametype].games,
				history: result[gametype].history,
			};
		});
		done( { ok: true, stats: stats } );
	})
	.catch( templateErrorCallback(done) );
};


var setSteamId = function(discordId, steamId, done) {
	// сначала проверяем валидности steamId
	// и определяем ник в стиме
	GetPlayerSummaries(steamId)
	.then( data => {
		if (data.response.players.length == 0)
			throw {
				error_code: INVALID_STEAM_ID,
				error_msg: ERROR_LIST[INVALID_STEAM_ID]
			};
		
		d2s[discordId] = steamId;
		// writeFile не возвращает промис, поэтому пишем так
		fs.writeFile("./d2s.json", JSON.stringify(d2s), function(error) {
			if (error) throw error;
			done({
				ok: true,
				steamname: removeColorsFromQLNickname(data.response.players[0].personaname)
			});
		});
	})
	.catch( templateErrorCallback(done) );
};


var setSteamIdPrimary = function(discordId, steamId, done) {
	if (typeof(d2s[discordId]) == 'undefined') {
		setSteamId(discordId, steamId, done);
	} else {
		done({
			ok: false,
			error_code: STEAM_ID_ALREADY_SET,
			error_msg: ERROR_LIST[STEAM_ID_ALREADY_SET]
		});
	}
};


var topList = function(gametype, done) {
  rp({
    uri: topListApi + gametype + "/0",
    timeout: 3000,
    json: true
  })
  .then( item => {
    if (item.ok == false) throw new Error(item.message);
    
    item = item.response.map( player => {
      player.games = player.n;
      player.steam_id = player._id;
      player.name = removeColorsFromQLNickname(player.name);
      delete player.n;
      delete player._id;
      return player;
    }).slice(0, 10);
    
    done({ok: true, response: item});
    
  })
  .catch( templateErrorCallback(done) );
};


var shuffle = function(gametype, playerList, mapname, done) {
	
	var teamsize = parseInt(Object.keys(playerList).length / 2);
	var playercount = Object.keys(playerList).length;
	var steamNames = {};
	
	Q()
	.then( () => {
		if ( GAMETYPES_AVAILABLE.some( item => { return gametype == item } ) == false )
			throw {
				error_code: INVALID_GAMETYPE,
				error_msg: ERROR_LIST[INVALID_GAMETYPE] + ": " + gametype
			};
		
		// принимаем четное количество игроков
		if ( playercount%2 != 0 )
			throw {
				error_code: INVALID_PLAYER_COUNT,
				error_msg: ERROR_LIST[INVALID_PLAYER_COUNT]
			};
		
		// для каждого определим steamId
		playerList = playerList.map( player => {
			if (typeof(d2s[player.discordid]) == 'undefined') {
				player.steamid = '0';
			} else {
				player.steamid = d2s[player.discordid];
				steamNames[player.steamid] = "";
			}
			return player;
		});
		
		return Object.keys(steamNames);
	})
	// сначала определяем ники
	.then( GetPlayerSummaries )
	.then( data => {
		data.response.players.forEach(function(player) {
			steamNames[player.steamid] = removeColorsFromQLNickname(player.personaname);
		});
		return getRatingsForSteamIds(Object.keys(steamNames), gametype, mapname);
	})
	.then( data => {
		playerList = playerList.map( player => {
			if (player.steamid != '0') {
				player.elo = data[player.steamid][gametype].rating;
				player.games = data[player.steamid][gametype].games;
				player.steamname = steamNames[player.steamid];
			} else {
				player.elo = 0;
				player.games = 0;
				player.steamname = "";
			}
			return player;
		});
		
		// собственно разделяем команды
		
		var bestCombo;
		var bestDiff = Number.MAX_VALUE;
		
		// процедура получения сочетаний без повторнеия
		// n = playercount
		// k = teamsize
		var f = function(i, indices, start_j) {
			if (typeof(i) == 'undefined') {
				i = 0;
				indices = [0];
				start_j = 0;
			}
			
			if (start_j >= playercount) {
				return;
			}
			
			indices[i] = start_j;
			
			if ( (i != teamsize - 1) && (indices[i] == playercount - 1) ) {
				return;
			}
			
			if (i == teamsize - 1) {
				//console.log(indices);
				var result = playerList.reduce(function(sum, current, m) {
					if (indices.some(function(indice) {
						return indice == m;
					})) {
						sum[0].players.push(current);
						sum[0].team_elo += current.elo;
					} else {
						sum[1].players.push(current);
						sum[1].team_elo += current.elo;
					}
					return sum;
				}, [
						{name: "red",		team_elo: 0,	players: []},
						{name: "blue",		team_elo: 0,	players: []},
						{name: "unrated",	team_elo: 0,	players: []}
					]
				);
				
				if (Math.abs(result[1].team_elo - result[0].team_elo) < bestDiff) {
					bestCombo = result.slice();
					bestDiff = Math.abs(result[1].team_elo - result[0].team_elo);
				}
				f(i, indices, start_j+1);
			} else {
				for(var j=start_j; j<playercount; j++) {
					indices[i] = j;
					f(i+1, indices, j+1);
				}
			}
		};
		f();
		
		// записываем тех, что без рейтинга
		bestCombo[2].players = playerList.reduce(function(sum, current) {
			if (current.steamid == '0') {
				sum.push(current);
			}
			return sum;
		}, []);
		
		// косметика
		var sortByEloCallback = function(a, b) {
			return b.elo - a.elo;
		};
		bestCombo[0].players.sort(sortByEloCallback);
		bestCombo[0].team_elo = parseFloat((bestCombo[0].team_elo/teamsize).toFixed(2));
		bestCombo[1].players.sort(sortByEloCallback);
		bestCombo[1].team_elo = parseFloat((bestCombo[1].team_elo/teamsize).toFixed(2));
		
		done({
			ok: true,
			teams: bestCombo
		});
	})
	.catch( templateErrorCallback(done) );
};


module.exports.shuffle = shuffle;
module.exports.setSteamId = setSteamId;
module.exports.setSteamIdPrimary = setSteamIdPrimary;
module.exports.getSteamId = getSteamId;
module.exports.getRatingsForDiscordId = getRatingsForDiscordId;
module.exports.topList = topList;
