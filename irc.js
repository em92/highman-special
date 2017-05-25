var irc = require('irc');
var client = new irc.Client('irc.quakenet.org', 'eugene_irc_bot', {
  stripColors: true,
  channels: ['#tdmpickup', '#ctfpickup']
});

var status = {
  "#ctfpickup": "n/a",
  "#tdmpickup": "n/a"
}

client.addListener('error', function(message) {
  console.error('error: ', message);
});

client.addListener('topic', function (channel, topic, nick, message) {
  // [ tdm [0/8] 2v2 [0/4] skilled [0/8] ] [ http://www.esreality.com/post/2873410/hoq-tdm-spring-season-catchup-round-1/ ]
  // CTF: 4on4 [ 0 / 8 ] 5on5 [ 0 / 10 ] Skilled [ 0 / 8 ] -/-
  switch(channel) {
    case "#ctfpickup": topic = topic.split(" -/-")[0]; break;
    case "#tdmpickup": topic = topic.startsWith("[ ") ? topic.split("[ ")[1].split(" ] ")[0] : topic; break;
    default: return;
  }
  status[ channel ] = topic;
});

Object.defineProperty(module.exports, "status", {
  get: function() {
    return {"ok": true, "irc_pickups": Object.keys( status ).map( ( key ) => {
      return {"pickup_name": key.substr(1), "topic": status[key]}
    }) };
  }
});

