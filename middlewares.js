/**
 * @param {array} users
 */
function authRequired(users) {
    if (!Array.isArray(users)) {
        throw new Error("users must be array");
    }

    return function(req, res, next) {
        req.user = null;
        users.forEach( user => {
            var apiKey = process.env[user + '_API_KEY'];
            if(apiKey && req.query.apikey == apiKey) {
                req.user = user;
            }
        });

        if (req.user) {
            next();
            return;
        }

        /**
         * @todo Жду, когда Витя будет присылать apiKey
         * @todo После чего - удаляем проверку по белому списку адресов
         */
        var ipWhitelist = [
            "185.246.155.33",
            "89.189.128.114",
            "94.142.139.240"
        ];

        var ip4 = req.connection.remoteAddress.replace('::ffff:', '');
              
        if (ipWhitelist.indexOf(ip4) !== -1 && users.includes("VITYA")) {
            req.user = "VITYA";
            next();
            return;
        }

        res.json({
            "error_msg": "invalid api key",
            "error_code": -1,
            "ok": false
        });
    }
}

module.exports.authRequired = authRequired;
