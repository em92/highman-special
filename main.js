var express = require('express');
var morgan = require('morgan');
var fs = require('fs');
var path = require('path');
var ql = require("./quakelive.js");
var irc = require("./irc.js");

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

app.use(function(req, res, next) {
  res.set("Connection", "close");
  next();
});

app.get('/shuffle/:gametype/:discord_ids', function (req, res) {
	ql.shuffle(req.params.gametype.toLowerCase(), convertDiscordIdsToArray(req.params.discord_ids), undefined, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/shuffle_map/:map/:gametype/:discord_ids', function (req, res) {
	ql.shuffle(req.params.gametype.toLowerCase(), convertDiscordIdsToArray(req.params.discord_ids), req.params.map.toLowerCase(), function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/map/:discord_id/:steam_id', function (req, res) {
	ql.setSteamIdPrimary(req.params.discord_id, req.params.steam_id, function(result) {
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Connection", "close");
		res.send(result);
	});
});

app.get('/force_map/:discord_id/:steam_id', function (req, res) {
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
		discord_id: ql.getDiscordIdBySteamId(req.params.steam_id).toString()
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

app.get('/irc_pickup_status', function(req, res) {
  res.json( irc.status );
});

app.get('/irc_pickup_status/:pickup_name', function(req, res) {
  irc.w( req.params.pickup_name.toLowerCase(), function( result ) {
    res.json( result );
  });
});

app.listen(httpd_port, function () {
	console.log("privet, pupsik :3");
});
