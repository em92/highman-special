var express = require('express');
var ql = require("./quakelive.js");

var app = express();

var convertDiscordIdsToArray = function(s) {
	var data = s.split('+').map(function(e) {
		return {"discordid": e};
	});
	return data;
};

app.get('/:gametype/:discord_ids', function (req, res) {
	ql.shuffle(req.params.gametype, convertDiscordIdsToArray(req.params.discord_ids), function(result) {
		res.setHeader("Content-Type", "application/json");
		res.send(result);
	});
});

app.get('/map/:discord_id/:steam_id', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	if (typeof(ql.d2s[req.params.discord_id]) == 'undefined') {
		ql.setSteamId(req.params.discord_id, req.params.steam_id);
		res.send({ok: true});
	} else {
		res.send({ok: false, message: 'idi na hui'});
	}
});

app.get('/force_map/:discord_id/:steam_id', function (req, res) {
	ql.setSteamId(req.params.discord_id, req.params.steam_id);
	res.setHeader("Content-Type", "application/json");
	res.send({ok: true});
});

app.listen(3330, function () {
	console.log("privet, pupsik :3");
});
