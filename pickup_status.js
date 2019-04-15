var bodyParser = require('body-parser');
var middlewares = require("./middlewares.js");

var authOptional = middlewares.authOptional;
var authRequired = middlewares.authRequired;
var pickupStatus = {};

function t(value) {
    switch(value) {
        case 'DRAYAN': return "HoQ";
        case 'VITYA': return "RU";
        default: return value;
    }
}

function convertPickupStatusToPairs(status) {
    result = [];
    Object.keys(status).forEach(pickupServer => {
        var line = Object.keys(status[pickupServer]).reduce((sum, pickup) => {
            return sum + " " + pickup + "[" + status[pickupServer][pickup] + "]";
        }, "");
        result.push({
            "pickup_name": pickupServer,
            "topic": line.trim(),
        });
    });
    return result;
}

module.exports = function(app) {
    app.get('/irc_pickup_status', function(req, res) {
        var status = Object.assign({}, pickupStatus);
        delete status[t("VITYA")];
        var result = convertPickupStatusToPairs(status);
        res.json({
            'ok': true,
            'irc_pickups': result,
        });
    });

    app.get('/pickup_status', authOptional(["VITYA", "DRAYAN"]), function(req, res) {
        var status = Object.assign({}, pickupStatus);
        delete status[t(req.user)];
        var result = convertPickupStatusToPairs(status);
        res.json({
            'ok': true,
            'pickups': result,
        });
    });
    
    app.post('/update_pickup_status', authRequired(["VITYA", "DRAYAN"]), bodyParser.json(), function(req, res) {
        var data = {};
        Object.keys(req.body).forEach( key => {
            if (typeof(req.body[key]) == "string") {
                data[key] = req.body[key];
            }
        });
    
        /** @todo Это результат копипасты */
        var pickupServer = t(req.user);
        pickupStatus[pickupServer] = data;
        var line = Object.keys(data).reduce((sum, pickup) => {
            return sum + " " + pickup + "[" + data[pickup] + "]";
        }, "");
    
        res.json({'ok': true, 'pickup': {
            "pickup_name": pickupServer,
            "topic": line.trim(),
        }});
    });
}
