require('dotenv').config()
var express = require('express');
var morgan = require('morgan');
var fs = require('fs');
var path = require('path');
var ql = require("./quakelive.js");
var middlewares = require("./middlewares.js");

var authRequired = middlewares.authRequired;
var httpd_port = parseInt(process.env.PORT) || 3331;
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

app.use(function(req, res, next) {
  res.set("Connection", "close");
  next();
});

app.get('/shuffle/:gametype/:discord_ids', function (req, res) {
	ql.shuffle(req.params.gametype.toLowerCase(), convertDiscordIdsToArray(req.params.discord_ids), function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/map/:discord_id/:steam_id', authRequired(["VITYA"]), function (req, res) {
	ql.setSteamIdPrimary(req.params.discord_id, req.params.steam_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/force_map/:discord_id/:steam_id', authRequired(["VITYA"]), function (req, res) {
	ql.setSteamId(req.params.discord_id, req.params.steam_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/whois/steam_id/:steam_id', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	res.setHeader("Connection", "close");
	res.send({
		ok: true,
		discord_id: ql.getDiscordIdBySteamId(req.params.steam_id)
	});
});

app.get('/whois/:discord_id', function (req, res) {
	ql.getSteamId(req.params.discord_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/ratings/:discord_id', function (req, res) {
	ql.getRatingsForDiscordId(req.params.discord_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/top/:gametype', function (req, res) {
	ql.topList(req.params.gametype.toLowerCase(), function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/scoreboard/:match_id', function(req, res) {
  ql.getScoreboard( req.params.match_id, function( result ) {
    res.json( result );
  });
});

app.listen(httpd_port, function () {
	console.log("privet, pupsik :3");
});
