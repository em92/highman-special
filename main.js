var express = require('express');
var morgan = require('morgan');
var fs = require('fs');
var path = require('path');
var ql = require("./quakelive.js");

var httpd_port = require("./cfg.json").httpd_port;
var app = express();

var convertDiscordIdsToArray = function(s) {
	var data = s.split('+').map(function(e) {
		return {"discordid": e};
	});
	return data;
};

app.use(morgan('combined', {
	skip: function (req, res) { return (
		(
			(req.connection.remoteAddress == '::ffff:127.0.0.1') || 
			(req.connection.remoteAddress == '::1')
		) && (req.headers['x-forwarded-for']) 
	); },
	stream: fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})
}));

app.get('/shuffle/:gametype/:discord_ids', function (req, res) {
	ql.shuffle(req.params.gametype.toLowerCase(), convertDiscordIdsToArray(req.params.discord_ids), function(result) {
		res.setHeader("Content-Type", "application/json");
		res.send(result);
	});
});

app.get('/map/:discord_id/:steam_id', function (req, res) {
	ql.setSteamIdPrimary(req.params.discord_id, req.params.steam_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.send(result);
	});
});

app.get('/force_map/:discord_id/:steam_id', function (req, res) {
	ql.setSteamId(req.params.discord_id, req.params.steam_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.send(result);
	});
});

app.get('/whois/:discord_id', function (req, res) {
	ql.getSteamId(req.params.discord_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.send(result);
	});
});

app.get('/ratings/:discord_id', function (req, res) {
	ql.getRatingsForDiscordId(req.params.discord_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.send(result);
	});
});


app.listen(httpd_port, function () {
	console.log("privet, pupsik :3");
});
