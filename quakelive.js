var http = require('http');
var fs = require('fs');
var extend = require('util')._extend;
var d2s = require('./d2s.json');

var NO_ERROR = 0;
var INVALID_GAMETYPE = 1;
var INVALID_PLAYER_COUNT = 2;
var ERROR_LIST = [
	'no error',
	'invalid gametype',
	'invalid player count (must be even)'
];

var setSteamId = function(discordId, steamId) {
	d2s[discordId] = steamId;
	fs.writeFile("./d2s.json", JSON.stringify(d2s));
};

var shuffle = function(gametype, playerList, done) {
	
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
					a[i].elo = 1500;
					data.players.forEach(function(jtem) {
						if (jtem.steamid == item.steamid) {
							if (typeof(jtem[gametype]) != 'undefined') {
								a[i].elo = jtem[gametype].elo;
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
		// n = Object.keys(playerList).length
		// k = parseInt(Object.keys(playerList).length/2)
		var f = function(i, indices, start_j) {
			if (typeof(i) == 'undefined') {
				i = 0;
				indices = [0];
				start_j = 0;
			}
			
			if (start_j >= Object.keys(playerList).length) {
				return;
			}
			
			indices[i] = start_j;
			
			if ( (i != parseInt(Object.keys(playerList).length/2) - 1) && (indices[i] == Object.keys(playerList).length - 1) ) {
				return;
			}
			
			if (i == parseInt(Object.keys(playerList).length/2) - 1) {
				//console.log(indices);
				var result = playerList.reduce(function(sum, current, m) {
					if (indices.some(function(indice) {
						return indice == m;
					})) {
						sum.blue.push(current);
						sum.blue_elo += current.elo;
					} else {
						sum.red.push(current);
						sum.red_elo += current.elo;
					}
					return sum;
				}, {red: [], blue: [], red_elo: 0, blue_elo: 0});
				
				if (Math.abs(result.red_elo - result.blue_elo) < bestDiff) {
					bestCombo = extend({}, result);
					bestDiff = Math.abs(result.red_elo - result.blue_elo);
				}
				f(i, indices, start_j+1);
			} else {
				for(var j=start_j; j<Object.keys(playerList).length; j++) {
					indices[i] = j;
					f(i+1, indices, j+1);
				}
			}
		};
		f();
		
		// записываем тех, что без рейтинга
		bestCombo.unrated = playerList.reduce(function(sum, current) {
			if (current.steamid == '0') {
				sum.unrated.push(current.discordid);
			}
			return sum;
		}, []);
		
		// косметика
		var sortByEloCallback = function(a, b) {
			return b.elo - a.elo;
		};
		bestCombo.red.sort(sortByEloCallback);
		bestCombo.red_elo = parseInt(bestCombo.red_elo/4);
		bestCombo.blue.sort(sortByEloCallback);
		bestCombo.blue_elo = parseInt(bestCombo.blue_elo/4);
		
		done({
			"ok": true,
			"data": bestCombo
		});
	};
	
	// основной метод
	
	// принимаем четное количество игроков
	if (Object.keys(playerList).length%2 != 0) {
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
			}
			return player;
		});
		
		// если не получится получить рейтинги
		var onGetRatingsError = function(error) {
			console.error('http error in getRatings: ' + error.message);
			getRatings(makeTeams, onGetRatingsError);
		}
		
		// поехали
		getRatings(makeTeams, onGetRatingsError);

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
module.exports.d2s = d2s;
