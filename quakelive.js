var fs = require('fs');
var extend = require('util')._extend;
var d2s = require('./d2s.json');
var rp = require('request-promise');
var Q = require('q');
var cfg = require('./cfg.json');

var steamApiKey = process.env['STEAM_WEB_API_KEY'];
if (typeof(steamApiKey) == "undefined") {
  console.error("warning: STEAM_WEB_API_KEY is not defined in environment vars");
  steamApiKey == false;
}
var ratingApiSource    = cfg.api_backend + '/elo/';
var playerInfoApi      = cfg.api_backend + '/deprecated/player/';
var topListApi         = cfg.api_backend + '/ratings/';
var mapratingApiSource = cfg.api_backend + '/elo_map/';

var HTTP_TIMEOUT = 5000;
var GAMETYPES_AVAILABLE = ['ctf', 'tdm', 'tdm2v2'];
var GAMETYPE_ALIASES = {
  'ctfs': 'ctf',
  'ctf5v5': 'ctf'
}
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
	'steam id already set. use /force_map method',
	'undefined steam id',
	'error in GetPlayerSummaries: ',
	'steam id is already assigned to another discord user',
	null
];

var getDiscordIdBySteamId = function(steam_id) {
  var result = Object.keys(d2s).find( item => d2s[item] == steam_id);
  return (typeof(result) != "undefined") ? result : 0;
}

var removeColorsFromQLNickname = function(name) {
	name = name.split("^0").join("");
	name = name.split("^1").join("");
	name = name.split("^2").join("");
	name = name.split("^3").join("");
	name = name.split("^4").join("");
	name = name.split("^5").join("");
	name = name.split("^6").join("");
	name = name.split("^7").join("");
	return name == "" ? "_" : name;
};

var GetPlayerSummaries = function(steamids, options) {
  options = Object.assign({
    on_fail_use_cache: false,
    use_cache: false
  }, options);

  if (!steamApiKey) options.use_cache = true;

  if (options.use_cache) {
    uri = cfg.api_backend + '/steam_api/GetPlayerSummaries/?steamids=' + steamids;
  } else {
    uri = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + steamApiKey + '&steamids=' + steamids;
  }

  if (steamids instanceof Array) steamids = steamids.join(",");

  return rp({
    uri: uri,
    timeout: HTTP_TIMEOUT,
    json: true
  })
  .catch( error => {
    if (options.on_fail_use_cache && !options.use_cache) {

      return GetPlayerSummaries(steamids, {use_cache: true});

    } else throw {
      error_code: GET_PLAYER_SUMMARIES_ERROR,
      error_msg: error.message
    };
  });
};


var getRatingsForSteamIds = function(steamids, gametype, mapname) {
	if (steamids instanceof Array) steamids = steamids.join("+");
	return rp({
		uri: typeof(mapname) == "undefined" ? ratingApiSource + steamids : mapratingApiSource + gametype + "/" + mapname + "/" + steamids,
		timeout: HTTP_TIMEOUT,
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
			console.trace(error);
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
	
	return GetPlayerSummaries(steamId, {on_fail_use_cache: true})
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
		uri: playerInfoApi + steamId + ".json",
		timeout: HTTP_TIMEOUT,
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
				result[gametype].rank = player[gametype].rank ? player[gametype].rank : 0;
				result[gametype].max_rank = player[gametype].max_rank ? player[gametype].max_rank : 0;
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
				result[gametype].rating = 0;
				result[gametype].games = 0;
				result[gametype].history = [];
				result[gametype].rank = 0;
				result[gametype].max_rank = 0;
			}
		});
		
		var played_at_least_one_game = false;

		var stats = GAMETYPES_AVAILABLE.map(gametype => {
			if (played_at_least_one_game == false) {
				played_at_least_one_game = result[gametype].games > 0;
			}

			return {
				type: gametype,
				rating: result[gametype].rating,
				games: result[gametype].games,
				history: result[gametype].history,
				rank: result[gametype].rank,
				max_rank: result[gametype].max_rank,
			};
		});

		if (played_at_least_one_game) {
			stats = stats.filter( item => item.games );
		}

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
		
		while( old_discord_id = getDiscordIdBySteamId( steamId ) ) {
			delete d2s[ old_discord_id ];
		}
		d2s[discordId] = steamId;
		// writeFile не возвращает промис, поэтому пишем так
		fs.writeFile("./d2s.json", JSON.stringify(d2s, null, 2), function(error) {
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
	if (typeof(d2s[discordId]) != 'undefined') {
		done({
			ok: false,
			error_code: STEAM_ID_ALREADY_SET,
			error_msg: ERROR_LIST[STEAM_ID_ALREADY_SET]
		});
	} else if (getDiscordIdBySteamId(steamId) !== 0) {
		done({
			ok: false,
			error_code: STEAM_ID_ALREADY_ASSIGNED,
			error_msg: ERROR_LIST[STEAM_ID_ALREADY_ASSIGNED]
		});
	} else {
		setSteamId(discordId, steamId, done);
	}
};


var topList = function(gametype, done) {
  var result = [];

  rp({
    uri: topListApi + gametype + "/0.json",
    timeout: HTTP_TIMEOUT,
    json: true
  })
  .then( item => {
    if (item.ok == false) throw new Error(item.message);
    
    result = item.response.map( player => {
      player.games = player.n;
      player.steam_id = player._id;
      player.name = removeColorsFromQLNickname(player.name);
      player.discord_id = getDiscordIdBySteamId(player._id);
      delete player.n;
      delete player._id;
      delete player.model;
      return player;
    }).slice(0, 10);

    return GetPlayerSummaries( result.map( player => {
      return player.steam_id;
    }), {on_fail_use_cache: true});

  })
  .then( data => {
    data.response.players.forEach( (player, i) => {
      result.forEach( (_, j) => {
        if (result[j].steam_id == player.steamid) {
          result[j].name = removeColorsFromQLNickname(player.personaname);
        }
      });
    });
    done({ok: true, response: result});
  })
  .catch( templateErrorCallback(done) );
};


var shuffle = function(gametype, playerList, mapname, done) {
	
	var teamsize = parseInt(Object.keys(playerList).length / 2);
	var playercount = Object.keys(playerList).length;
	var steamNames = {};
	
	Q()
	.then( () => {
		if ( GAMETYPE_ALIASES[ gametype ] ) gametype = GAMETYPE_ALIASES[ gametype ];
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
	.then( data => GetPlayerSummaries(data, {on_fail_use_cache: true}) )
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
			diff: parseFloat(bestDiff.toFixed(2)),
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
module.exports.getDiscordIdBySteamId = getDiscordIdBySteamId;
