var http = require('http');
var fs = require('fs');
var extend = require('util')._extend;
var d2s = require('./d2s.json');
var steamApiKey = require('./cfg.json').steamApiKey;

var NO_ERROR = 0;
var INVALID_GAMETYPE = 1;
var INVALID_PLAYER_COUNT = 2;
var INVALID_STEAM_ID = 3;
var STEAM_ID_ALREADY_SET = 4;
var ERROR_LIST = [
	'no error',
	'invalid gametype',
	'invalid player count (must be even)',
	'invalid steam id',
	'steam id already set. use /force_map method'
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

var GetPlayerSummaries = function(steamids, done, fuck) {
	var params = {
		host: "api.steampowered.com",
		port: 80,
		path: '/ISteamUser/GetPlayerSummaries/v0002/?key=' + steamApiKey + '&steamids=' + steamids
	};
	
	http.get(params, function(response) {
		var data = "";
		response.on("data", function(chunk) {
			data += chunk;
		});
		response.on("end", function() {
			try {
				data = JSON.parse(data);
				done(data);
			} catch(yourself) {
				fuck(yourself);
			}
		});
	}).on('error', fuck);
};

var setSteamId = function(discordId, steamId, done) {
	// если что-то пойдет не так
	var fuck = function(err) {
		done({
			"ok": false,
			"error_code": -1,
			"error_msg": err.toString()
		});
	};
	
	// сначала проверяем валидности steamId
	// и определяем ник в стиме
	GetPlayerSummaries(steamId, function(data) {
		if (data.response.players.length == 0) {
			done({
				"ok": false,
				"error_code": INVALID_STEAM_ID,
				"error_msg": ERROR_LIST[INVALID_STEAM_ID]
			});
		} else {
			d2s[discordId] = steamId;
			fs.writeFile("./d2s.json", JSON.stringify(d2s), function(err) {
				if (err) fuck(err);
				done({
					ok: true,
					steamname: removeColorsFromQLNickname(data.response.players[0].personaname)
				});
			});
		}
	}, fuck);
};


var setSteamIdPrimary = function(discordId, steamId, done) {
	if (typeof(d2s[discordId]) == 'undefined') {
		setSteamId(discordId, steamId, done);
	} else {
		done({
			"ok": false,
			"error_code": STEAM_ID_ALREADY_SET,
			"error_msg": ERROR_LIST[STEAM_ID_ALREADY_SET]
		});
	}
};


var shuffle = function(gametype, playerList, done) {
	
	var teamsize = parseInt(Object.keys(playerList).length / 2);
	var playercount = Object.keys(playerList).length;
	var steamNames = {};
	
	// метод получения рейтинга
	var getRatings = function(done, fuck) {
		var path = '/elo_b/' + playerList.reduce(function(sum, current) {
			return sum + (sum != '' ? '+': '') + current.steamid;
		}, '');
		http.get({host: 'qlstats.net', port: 8080, path: path}, function(response) {
			var data = "";
			response.on("data", function(chunk) {
				data += chunk;
			});
			response.on("end", function() {
				data = JSON.parse(data);
				playerList.forEach(function(item, i, a) {
					a[i].elo = 0;
					a[i].steamname = "noname";
					data.players.forEach(function(jtem) {
						if (jtem.steamid == item.steamid) {
							if (typeof(jtem[gametype]) != 'undefined') {
								a[i].elo = jtem[gametype].elo;
								a[i].steamname = steamNames[item.steamid];
							}
						}
					});
				});
				done();

			});
		}).on('error', function(yourself) {
			fuck(yourself);
		});
	};

	// метод разделения команд
	var makeTeams = function() {
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
						{name: "blue",		team_elo: 0,	players: []},
						{name: "red",		team_elo: 0,	players: []},
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
		bestCombo[0].team_elo = parseInt(bestCombo[0].team_elo/teamsize);
		bestCombo[1].players.sort(sortByEloCallback);
		bestCombo[1].team_elo = parseInt(bestCombo[1].team_elo/teamsize);
		
		done({
			"ok": true,
			"teams": bestCombo
		});
	};
	
	// основной метод
	
	// принимаем четное количество игроков
	if (playercount%2 != 0) {
		done({
			"ok": false,
			"error_code": INVALID_PLAYER_COUNT,
			"error_msg": ERROR_LIST[INVALID_PLAYER_COUNT]
		});
		return;
	}
	
	if ( (gametype == 'tdm') || (gametype == 'ctf') ) {
		
		// для каждого определим steamId
		playerList = playerList.map(function(player) {
			if (typeof(d2s[player.discordid]) == 'undefined') {
				player.steamid = '0';
			} else {
				player.steamid = d2s[player.discordid];
				steamNames[player.steamid] = "noname";
			}
			return player;
		});
		
		// для получения ников со стима
		var GetPlayerSummariesCallback = function(data) {
			
			data.response.players.forEach(function(player) {
				steamNames[player.steamid] = removeColorsFromQLNickname(player.personaname);
			});
			
			// если не получится получить рейтинги
			var onGetRatingsError = function(error) {
				console.error('http error in getRatings: ' + error.message);
				getRatings(makeTeams, onGetRatingsError);
			}
			
			getRatings(makeTeams, onGetRatingsError);
		};
		
		var onGetPlayerSummariesError = function(error) {
			console.error("error in GetPlayerSummaries: " + error.message);
			GetPlayerSummaries(Object.keys(steamNames), GetPlayerSummariesCallback, onGetPlayerSummariesError);
		};
		
		// поехали
		GetPlayerSummaries(Object.keys(steamNames), GetPlayerSummariesCallback, onGetPlayerSummariesError);
		
	} else {
		done({
			"ok": false,
			"error_code": INVALID_GAMETYPE,
			"error_msg": ERROR_LIST[INVALID_GAMETYPE] + ": " + gametype
		});
		return;
	}

};


module.exports.shuffle = shuffle;
module.exports.setSteamId = setSteamId;
module.exports.setSteamIdPrimary = setSteamIdPrimary;
