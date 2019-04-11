# highman-special

Проект для пикап-бота HIGHMAN-а

### Перед установкой

- Берем Steam Web API key: https://steamcommunity.com/dev/apikey
- Придумываем VITYA_API_KEY, чтобы методы map/force_map работали и можно было записывать статусы пикапа
- Придумываем DRAYAN_API_KEY, чтобы тот смог записывать статусы пикапа
- Убеждаемся, что VITYA_API_KEY и DRAYAN_API_KEY разные!
- Записываем все это в `.env` файл. Для примера - `.env.example`

### Установка и запуск

```sh
git clone https://github.com/em92/highman-special.git
cd ./highman-special
sudo apt-get install libicu-dev
npm install
node main.js
```

### Supervisor?

У меня примерно такие настройки:

```
[program:h]
command=/usr/bin/node /home/eugene/highman-special/main.js
directory=/home/eugene/highman-special/
autostart=true
autorestart=true
stderr_logfile=/var/log/h.err.log
stdout_logfile=/var/log/h.out.log
user=eugene
```
