# highman-special

Проект для пикап-бота HIGHMAN-а

### Перед установкой

- Берем Steam Web API key: https://steamcommunity.com/dev/apikey
- Придумываем себе API_KEY, чтобы методы map/force_map не ограничивались по-айпи клиента

### Установка и запуск

```sh
git clone https://github.com/em92/highman-special.git
cd ./highman-special
sudo apt-get install libicu-dev
npm install
export STEAM_WEB_API_KEY=DDD110059DBBBBBC0AAA0579F5D2B302
export API_KEY=1234 # тут устанвливаем ключ для методов force_map, map
node main.js
```

### Supervisor?

У меня примерно такие настройки:

```
[program:h]
command=/usr/bin/node /home/eugene/highman-special/main.js
environment=STEAM_WEB_API_KEY=<ТУТ_СВОЙ>,API_KEY=<АНАЛОГИЧНО>
directory=/home/eugene/highman-special/
autostart=true
autorestart=true
stderr_logfile=/var/log/h.err.log
stdout_logfile=/var/log/h.out.log
user=eugene
```
