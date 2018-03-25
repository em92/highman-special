var irc = require('irc');
var client = new irc.Client('irc.quakenet.org', 'eugene_irc_bot', {
  stripColors: true,
  channels: ['#tdmpickup']
});

var status = {
  "#tdmpickup": "n/a"
}

var bot_names = {
  "#tdmpickup": ["TDMBot"]
}

var w_status = {};

var w = function( pickup_name, done ) {
  var channel = "#" + pickup_name;
  if (!status[ channel ]) {
    done({
      error_code: -1,
      error_msg: "invalid pickup name",
      ok: false
    });
    return;
  }

  if ( typeof(w_status[ channel ]) == "string" ) {
    done({
      message: w_status[ channel ],
      ok: true
    });
    return;
  }

  w_status[ channel ] = {
    done: done,
    timer_id: setTimeout( () => {
      if ( w_status[ channel ] && w_status[ channel ].timer_id ) {
        done({
          error_code: -1,
          error_msg: "could not list players",
          ok: false
        });

        delete w_status[ channel ];
      }
    }, 5000)
  };

  client.say( channel, "!w" );
}

client.addListener('error', function(message) {
  console.error('error: ', message);
  Object.keys( status ).forEach( key => {
    status[key] = "n/a";
  });
});

client.addListener('topic', function (channel, topic, nick, message) {
  // [ tdm [0/8] 2v2 [0/4] skilled [0/8] ] [ http://www.esreality.com/post/2873410/hoq-tdm-spring-season-catchup-round-1/ ]
  // CTF: 4on4 [ 0 / 8 ] 5on5 [ 0 / 10 ] Skilled [ 0 / 8 ] -/-
  switch(channel) {
    case "#tdmpickup": topic = topic.startsWith("[ ") ? topic.split("[ ")[1].split(" ] ")[0] : topic; break;
    default: return;
  }
  status[ channel ] = topic;
  delete w_status[ channel ];
});


client.addListener('message#', function (nick, channel, text, message) {
  if (!status[ channel ]) return;
  if (bot_names[ channel ].indexOf( nick ) == -1) return;
  if (!w_status[ channel ]) return;
  if (!w_status[ channel ].timer_id) return;

  clearTimeout( w_status[ channel ].timer_id );

  var done = w_status[ channel ].done;
  w_status[ channel ] = text;

  done({
    message: text,
    ok: true
  });

});

Object.defineProperty(module.exports, "status", {
  get: function() {
    return {"ok": true, "irc_pickups": Object.keys( status ).map( ( key ) => {
      return {"pickup_name": key.substr(1), "topic": status[key]}
    }) };
  }
});

module.exports.w = w;
