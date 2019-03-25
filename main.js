'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TeamSpeakListener = TeamSpeakListener;
function TeamSpeakListener() {
  'use strict';

  var TeamSpeakClient = require("node-teamspeak"), util = require("util");;
  var TelegramBot = require('node-telegram-bot-api');
  var mongoose = require('mongoose');
  var fs = require('fs');

  var parsedJson = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

  const guideText = "Добро пожаловать в чат-бота сервера fuckdiscord.ru! Я помогу вам разобраться с тем, как тут всё работает\n\n1) Для начала выберите, каким образом будет работать список подписок на пользователей - вайтлист (/whitelist) или блэклист (/blacklist)\n2) Затем подпишитесь на нужных пользователей командой /sub <id или ник>. Ники и айди пользователей можно подсмотреть командой /users\n3) Укажите свой аккаунт таким же образом, командой /me <id или ник>, чтобы я не беспокоил вас уведомлениями, пока вы на сервере\n4) (необязательно) Подпишитесь на уведомления о количестве пользователей онлайн командой /notify <число>\n\nДополнительные команды:\n\/connect - подключиться к серверу\n\/who - посмотреть кто онлайн\n\/lastseen <id или ник> - когда пользователь был онлайн\n\/map - карта сервера\n\/subscriptions - посмотреть свои подписки\n\/showkeyboard или \/hidekeyboard - спрятать или показать клавиатуру команд\n\nНа этом всё! Будут вопросы или предложения - пиши @proxwian";
  const connectText = "[Подключиться к серверу](http://www.teamspeak.com/invite/teamsp3ak.ru/)";
  // just for lulz
  const f4ckdiscord = '```............\/´¯\/)...........(\\¯\`\\ \n...........\/...\/\/....СДОХНИ..\\\\...\\ \n........./...//.....ДИСКОРД..\\...\\ \n...../´¯/..../´¯\.ЕБАНЫй../¯` \....\¯`\ \n.././.../..../..../.|_......._|.\....\....\...\.\ \n(.(....(....(..../..)..)......(..(.\....)....)....).) \n.\................\/.../......\...\/................/ \n..\.................. /.........\................../.```';  

  var server = parsedJson.server;
  var port = parsedJson.port;
  var queryPort = parsedJson.queryPort;

  // массив для хранения данных о подключаемых пользователях
  // 
  var clients = [];
  var online = 0;

  var cl = new TeamSpeakClient(server, queryPort);
  setHandlers();

  function setHandlers() {
    cl.on("error", function (err) {
      cl = new TeamSpeakClient(server, queryPort);
      setHandlers();
      serverNotifyRegister();
      handleEvents();
    });

    cl.on("close", function () {
      cl = new TeamSpeakClient(server, queryPort);
      setHandlers();
      serverNotifyRegister();
      handleEvents();
    });
  }
  var bot = new TelegramBot(parsedJson.botApiKey, { polling: true });

  var subsSchema = new mongoose.Schema({
    "tgUserId": { type: String, index: true },
    "tsUserId": { type: Number, default: 0 },
    "notifyAll": { type: Boolean, default: false },
    "notifyAmount": { type: Number, default: 0 },
    "tsIds": [Number]
  });
  var Subscriptions = mongoose.model('Subscriptions', subsSchema);

  var clientsSchema = new mongoose.Schema({
    "dbid": { type: Number, index: true },
    "curid": { type: Number },
    "power": { type: Number },
    "channel": { type: Number },
    "name": { type: String },
    "online": { type: String },
    "country": { type: String },
    "awayMsg": { type: String }
  });
  var Clients = mongoose.model('bros', clientsSchema);

  const opts = {
    parse_mode: 'Markdown'
  }

  // настройки клавиатуры
  const kb_hide = {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      hide_keyboard: true
    })
  };

  const keyboard = {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      keyboard: [
        ['🔌 Подключиться'],
        ['❔ Туториал', '👽 Онлайн', '📜 Карта'],
        ['📍 Уведомления', '👥 Пользователи', '🧔 Мой аккаунт'],
        ['👍 Вайтлист', '🖍 Подписки', '👎 Блэклист']
      ]
    })
  };

  mongoose.connect(parsedJson.mongooseConnection);
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));

  db.once('open', function () {
    bot.onText(/^\/start/, function (msg) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { tgUserId: msg.from.id }, { upsert: true }, function (err, result) {
        if (result) {
          bot.sendMessage(msg.from.id, guideText, opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Ошибка регистрации Вашего аккаунта Telegram', opts);
        }
      });
    });

    //джаст фор лулз
    bot.onText(/.*/, function (msg) {
      if(getRandomInt(0,101) == 101) bot.sendMessage(msg.chat.id, f4ckdiscord, opts);
    });

    function getRandomInt(min, max)
    {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    bot.onText(/^\/stop$|^\/stahp$/, function (msg) {
      Subscriptions.remove({ tgUserId: msg.from.id }, function (err) {
        if (!err) {
          bot.sendMessage(msg.from.id, 'Ок, больше никаких сообщений от меня', opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Ошибка подключения к БД', opts);
        }
      });
    });

    bot.onText(/^\/help$|^\/guide$|^❔ Туториал$/, function (msg) {
      bot.sendMessage(msg.chat.id, guideText, opts);
    });

    bot.onText(/^\/connect$|^🔌 Подключиться$/, function (msg) {
      bot.sendMessage(msg.chat.id, connectText, opts);
    });

    bot.onText(/^\/who$|^\/list$|^👽 Онлайн$/, function (msg) {
      var strlist = '';
      Clients.find({ online: "true" }).exec(function (err, result) {
        if (err) {
          return;
        } if (result) {
          var count = 0;
          result.sort(function(a, b){ return a.dbid-b.dbid });
          result.forEach(function (element) {
            count++;
            strlist += "id" + element.dbid + ": *" + element.name + "* \\[" + element.power + "\]";
            if (count != result.length) strlist += "\n";
          });
          var str = '';
          switch(count) {
            case 2:
              str = ' человека';
              break;
            case 3:
              str = ' человека';
              break;
            case 4:
              str = ' человека';
              break;
            default:
              str = ' человек';
            }
          if (count > 0) {
            bot.sendMessage(msg.chat.id, "Сейчас на сервере *" + count + str +"*:\n\n" + strlist, opts);
          } else {
            bot.sendMessage(msg.chat.id, "В данный момент никого онлайн нет...", opts);
          }
        }
      });
    });

    bot.onText(/^\/whoall$|^\/listall$|^\/users$|^👥 Пользователи$/, function (msg) {
      var strlist = '';
      var i = 0;
      Clients.find().exec(function (err, result) {
          if (err) {
            bot.sendMessage(msg.chat.id, "Ошибка запроса к БД \*_\*", opts);
            return;
          } 
          if (result) {
            result.sort(function(a, b){ return a.dbid-b.dbid });
            result.forEach(function (element) {
              if (element.dbid == null) return;
              i++;
              strlist += "id" + element.dbid + ": *" + element.name + "* \\[" + element.power + "\]";
              switch (element.online) {
                case 'true':
                  strlist += " (Онлайн)";
                  break;
                default:
                  strlist += " (" + timeAgo(element.online) + ")";
              }
              if (i != result.length) strlist += "\n";
            });
            bot.sendMessage(msg.chat.id, "Пользователи (" + i + "): \n\n" + strlist, opts);
          }
        });
    });

    bot.onText(/^\/lastseen (.+)/, function (msg, args) {
      Clients.find({ name: args[1].valueOf() }).exec(function (err, result) {
          if (err) {
            bot.sendMessage(msg.chat.id, "Ошибка *_*", opts);
            return;
          } if (result) {
            result.forEach(function (element) {
              var str = 'Пользователь *' + element.name + '*(id' + element.dbid + ')';
              switch (element.online) {
                case 'true':
                  str += " сейчас онлайн";
                  break;
                default:
                  str += " был онлайн " + timeAgo(element.online);
              }
              bot.sendMessage(msg.chat.id, str, opts);
            });
            if (result.length < 1) {
              Clients.find({ dbid: args[1] }).exec(function (err, result) {
                if (err) {
                  bot.sendMessage(msg.chat.id, "Пользователь с таким никнеймом или id не найден :с", opts);
                  return;
                } if (result) {
                  result.forEach(function (element) {
                    var str = 'Пользователь *' + element.name + '*(id' + element.dbid + ')';
                    switch (element.online) {
                      case 'true':
                        str += " сейчас онлайн";
                        break;
                      default:
                        str += " был онлайн " + timeAgo(element.online);
                    }
                    bot.sendMessage(msg.chat.id, str, opts);
                  });
                  if (result.length < 1) bot.sendMessage(msg.chat.id, "Пользователь с таким никнеймом или id не найден :с", opts);
                }
              });
            }
          }
      });
    });

    bot.onText(/^\/tree$|^\/map$|^📜 Карта$/, function (msg) {
      updatePositions();

      var tree = '';
      cl.send("use", {sid: 1}, function(err, resp, rawResponse){
        cl.send("channellist", function(err, resp, rawResponse){
          Clients.find({ online: "true" }).exec(function (err, clientList) {
            if (err) {
              return;
            } if (clientList) {
              //clientList.sort(function(a, b){ return a.power-b.power });
  
              resp.forEach(function(element) {
                var count = 0;
                var stroke = '';
                var ch_clients = [];
    
                function getChClients(e) {
                  return e.channel == element.cid;
                }
    
                ch_clients = clientList.filter(getChClients);
                //ch_clients = clientList;

                if(!element.channel_name.includes("#") && element.channel_needed_subscribe_power < 999) {
                  stroke += "\\_\\_";
                }

                ch_clients.forEach(function(client) {
                  count++;
                });
    
                // скрываем ненужные каналы по фильтру
                if (element.total_clients < 0) {
                  if (element.channel_needed_subscribe_power < 999) {
                    if (element.channel_needed_subscribe_power < 80) {
                      stroke += "*" + element.channel_name + "* (?)\n";
                    } else {
                      stroke += "*" + element.channel_name + "*\n";
                    }
                  }
                } else {
                  stroke += "*" + element.channel_name + "*" + " (" + count + ")\n";
                }
                //

                ch_clients.forEach(function(client) {
                  stroke += "  [ ] _" + client.name + "_ \\[" + client.power + "\]\n";
                });
                tree += stroke;
              })

              bot.sendMessage(msg.chat.id, tree, opts);
            }
          });
        });
      });
    });

    bot.onText(/^\/whitelist$|^\/unsubscribeall$|^👍 Вайтлист$/, function (msg) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { notifyAll: false }, function (err, result) {
        if (result) {
          bot.sendMessage(msg.from.id, 'Включен режим *вайт-листа*. Уведомления будут приходить *только от пользователей, на которых Вы подписаны*', opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке изменить принцип работы уведомлений', opts);
        }
      });
    });

    bot.onText(/^\/blacklist$|^\/subscribeall$|^👎 Блэклист$/, function (msg) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { notifyAll: true }, function (err, result) {
        if (result) {
          bot.sendMessage(msg.from.id, 'Включен режим *черного списка*. Уведомления будут приходить от всех пользователей, *кроме тех, на которых Вы подписаны*', opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке подписаться', opts);
        }
      });
    });

    bot.onText(/^\/sub (.+)/, function (msg, args) {
      Clients.find({ name: args[1].valueOf() }).exec(function (e, r) {
        if (e) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке добавить пользователя', opts);
        }
        if (r) {
          var user;
            switch (r.length) {
              case 1:
                user = r[0];
                Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $addToSet: { tsIds: user.dbid } }, function (er, res) {
                  if (er) {
                    bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке добавить пользователя', opts);
                  }
                  if (res) {
                    bot.sendMessage(msg.from.id, 'Пользователь *' + user.name + '*(id' + user.dbid + ') добавлен в ваши подписки', opts);
                  }
                });
                break;
              default:
                Clients.find({ dbid: args[1].valueOf() }).exec(function (err, result) {
                  if (err) {
                    bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден...', opts);
                  }
                  if (result) {
                    if (result.length) {
                      if (result.length < 1) {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден :с', opts);
                      } else {
                        user = result[0];
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $addToSet: { tsIds: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке добавить пользователя', opts);
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Пользователь *' + user.name + '*(id' + user.dbid + ') добавлен в ваши подписки', opts);
                          }
                        });
                      }
                    } else {
                      user = result;
                      if (user.dbid != null && user.dbid != undefined) {
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $addToSet: { tsIds: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке добавить пользователя (aga)', opts);
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Пользователь *' + user.name + '*(id' + user.dbid + ') добавлен в ваши подписки', opts);
                          }
                        });
                      } else {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден :с', opts);
                      }
                    }
                  }
                });
            }
        }
      });
    });

    bot.onText(/^\/subscribe$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите имя для команды /subscribe', opts);
    });

    bot.onText(/^\/sub$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите имя для команды /sub', opts);
    });

    bot.onText(/^\/me$|^🧔 Мой аккаунт$/, function (msg) {
      Subscriptions.findOne({ tgUserId: msg.from.id }).exec(function (e, r) {
        if (e) {

        }
        if (r) {
          if (r.tsUserId == 0) {
            bot.sendMessage(msg.from.id, 'Вы пока ещё не указали личного аккаунта на сервере Teamspeak. Чтобы добавить аккаунт в качестве личного, введите /me <id>', opts);
            return;
          } else {
            Clients.findOne({ dbid: r.tsUserId }).exec(function (e, r) {
              if (e) {

              }
              if (r) {
                bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя *' + r.name + '*(id' + r.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн. Отвязать аккаунт можно командой */me off*', opts);
              }
            });
          }
        }
      });
    });

    bot.onText(/^\/me (.+)/, function (msg, args) {
      switch (args[1]) {
        case 'off':
          Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { tsUserId: 0 } }, function (er, res) {
            if (er) {
              bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке найти пользователя', opts);
            }
            if (res) {
              bot.sendMessage(msg.from.id, 'Вы успешно отвязали личный аккаунт. Чтобы привязать снова, введите */me <id или ник>*', opts);
            }
          });
          break;
        default:
          Clients.find({ name: args[1].valueOf() }).exec(function (e, r) {
            if (e) {
              bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке найти пользователя', opts);
            }
            if (r) {
              var user;
                switch (r.length) {
                  case 1:
                    user = r[0];
                    Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { tsUserId: user.dbid } }, function (er, res) {
                      if (er) {
                        bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке найти пользователя', opts);
                      }
                      if (res) {
                        bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя *' + user.name + '*(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн. Отвязать аккаунт можно командой */me off*', opts);
                      }
                    });
                    break;
                  default:
                    Clients.find({ dbid: args[1].valueOf() }).exec(function (err, result) {
                      if (err) {
                        bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя *' + user.name + '*(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн', opts);
                      }
                      if (result) {
                        if (result.length) {
                          if (result.length < 1) {
                            bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден :с', opts);
                          } else {
                            user = result[0];
                            Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { tsUserId: user.dbid } }, function (er, res) {
                              if (er) {
                                bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке найти пользователя', opts);
                              }
                              if (res) {
                                bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя *' + user.name + '*(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн', opts);
                              }
                            });
                          }
                        } else {
                          user = result;
                          if (user.dbid != null && user.dbid != undefined) {
                            Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { tsUserId: user.dbid } }, function (er, res) {
                              if (er) {
                                bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке найти пользователя (aga)', opts);
                              }
                              if (res) {
                                bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя *' + user.name + '*(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн', opts);
                              }
                            });
                          } else {
                            bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден :с', opts);
                          }
                        }
                      }
                    });
                }
            }
          });
      }
      
    });

    bot.onText(/^\/unsub (.+)/, function (msg, args) {
      Clients.find({ name: args[1].valueOf() }).exec(function (e, r) {
        if (e) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке отписаться от пользователя', opts);
        }
        if (r) {
          var user;
            switch (r.length) {
              case 1:
                user = r[0];
                Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $pull: { tsIds: user.dbid } }, function (er, res) {
                  if (er) {
                    bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке отписаться от пользователя', opts);
                  }
                  if (res) {
                    bot.sendMessage(msg.from.id, 'Пользователь *' + user.name + '*(id' + user.dbid + ') удалён из подписок', opts);
                  }
                });
                break;
              default:
                Clients.find({ dbid: args[1].valueOf() }).exec(function (err, result) {
                  if (err) {
                    bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден...', opts);
                  }
                  if (result) {
                    if (result.length) {
                      if (result.length < 1) {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден :с', opts);
                      } else {
                        user = result[0];
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $pull: { tsIds: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке отписаться от пользователя', opts);
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Пользователь *' + user.name + '*(id' + user.dbid + ') удалён из подписок', opts);
                          }
                        });
                      }
                    } else {
                      user = result;
                      if (user.dbid != null && user.dbid != undefined) {
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $pull: { tsIds: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке отписаться от пользователя (aga)', opts);
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Пользователь *' + user.name + '*(id' + user.dbid + ') удалён из подписок', opts);
                          }
                        });
                      } else {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id *' + args[1] + '* не найден :с', opts);
                      }
                    }
                  }
                });
            }
        }
      });
    });

    bot.onText(/^\/unsubscribe$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите id или ник для команды /unsubscribe', opts);
    });

    bot.onText(/^\/lastseen$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите id или ник для команды /lastseen', opts);
    });
  
    bot.onText(/^\/unsub$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите id или ник для команды /unsub', opts);
    });
  
    bot.onText(/^\/notify$|📍 Уведомления$/, function (msg) {
      Subscriptions.findOne({ tgUserId: msg.from.id }, function (error, result) {
        if (error) {
          bot.sendMessage(msg.from.id, 'Ошибка БД', opts);
        }
        if (result) {
          switch(result.notifyAmount) {
            case 0:
              bot.sendMessage(msg.from.id, 'Уведомления о количестве человек онлайн отключены. Введите */notify <число>*, чтобы включить', opts);
              break;
            default:
              bot.sendMessage(msg.from.id, 'Уведомления о количестве человек онлайн: *' + result.notifyAmount + '*\nВведите */notify off*, чтобы отключить', opts);
          }
          
        }
      });
    });
  
    bot.onText(/^\/notify (.+)/, function (msg, args) {
      switch (args[1]) {
        case 'off':
          Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { notifyAmount: 0 } }, function (error, result) {
            if (error) {
              bot.sendMessage(msg.from.id, 'Ошибка БД', opts);
            }
            if (result) {
              bot.sendMessage(msg.from.id, 'Уведомления о количестве человек онлайн отключены', opts);
            }
          });
          break;
        default:
          Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { notifyAmount: args[1] } }, function (error, result) {
            if (error) {
              bot.sendMessage(msg.from.id, 'Ошибка: необходимо указать число', opts);
            }
            if (result) {
              bot.sendMessage(msg.from.id, 'Хорошо, я буду уведомлять об онлайне, когда на сервере будет больше *' + args[1] + '* человек(а)', opts);
            }
          });
      }
    });

    bot.onText(/^\/showkeyboard$/, function (msg, args) {
      bot.sendMessage(msg.from.id, 'Клавиатура *включена*', keyboard);
    });

    bot.onText(/^\/hidekeyboard$/, function (msg, args) {
      bot.sendMessage(msg.chat.id, 'Клавиатура *отключена*', kb_hide);
    });
  
    bot.onText(/^\/mode$|^👁 Режим$/, function (msg) {
      Subscriptions.findOne({ tgUserId: msg.from.id }, function (err, result) {
        if (result) {
          (function () {
            if (result.notifyAll == true) {
              bot.sendMessage(msg.from.id, 'Сейчас активирован режим *черного списка*. Уведомления будут приходить от всех пользователей, *кроме тех, на которых Вы подписаны*', opts);
            } else {
              bot.sendMessage(msg.from.id, 'Сейчас активирован режим *вайт-листа*. Уведомления будут приходить *только от пользователей, на которых Вы подписаны*', opts);
            }
          })();
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при отправке запроса к БД', opts);
        }
      });
    });
  
    bot.onText(/^\/subscriptions$|^🖍 Подписки$/, function (msg) {
      Subscriptions.findOne({ tgUserId: msg.from.id }, function (err, result) {
        if (result) {
          Clients.find().exec(function (er, res) {
            if (er) {
  
            }
            if (res) {
              var subscriptions = "";
              var i = 1;
              result.tsIds.forEach(function (element) {
                var name = '';
                res.forEach(function (unit) {
                  if (unit.dbid == element) {
                    name = unit.name;
                  }
                });
                subscriptions = subscriptions + i + ") id" + element + ": *" + name + "*\n";
                i++;
              });
              var self = result.tsUserId;
              if (self > 0) self = 'id' + self; else self = 'Не указан';
              if (subscriptions) {
                if (result.notifyAll) {
                  bot.sendMessage(msg.from.id, 'Подписки (чёрный список):  \n' + subscriptions + '\nЛичный аккаунт: *' + self + '*', opts);
                } else {
                  bot.sendMessage(msg.from.id, 'Подписки (вайт-лист):  \n' + subscriptions + '\nЛичный аккаунт: *' + self + '*', opts);
                }
              } else {
                if (result.notifyAll) {
                  bot.sendMessage(msg.from.id, 'У вас нет активных подписок :с (чёрный список):  \n' + subscriptions + '\nЛичный аккаунт: *' + self + '*', opts);
                } else {
                  bot.sendMessage(msg.from.id, 'У вас нет активных подписок :с (вайт-лист):  \n' + subscriptions + '\nЛичный аккаунт: *' + self + '*', opts);
                }
              }
            }
          });
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при отправке запроса к БД', opts);
        }
      });
    });
  });

  serverNotifyRegister();
  handleEvents();
  resetOnlines();

  function serverNotifyRegister() {
    cl.send("use", { port: port || 9987 }, function () {
      cl.send("servernotifyregister", { event: "server" }, function () {});
      cl.send("servernotifyregister", { event: "textprivate" }, function () {});
      cl.send("servernotifyregister", { event: "clientmove" }, function () {});
      cl.send("servernotifyregister", { event: "clientmoved" }, function () {});
    });
  }

  function userJoin(resp) {
    Clients.findOneAndUpdate({ dbid: resp.client_database_id }, { $set: { curid: resp.clid, name: resp.client_nickname, online: 'true', country: resp.client_country, power: resp.client_talk_power, channel: resp.ctid, awayMsg: resp.client_away_message } }, { upsert: true }, function (err, result) {
      });
  }

  function userLoad(resp) {
    Clients.findOneAndUpdate({ dbid: resp.client_database_id }, { $set: { curid: resp.clid, name: resp.client_nickname, online: 'true' } }, { upsert: true }, function (err, result) {
      });
  }

  function userUpdate(resp) {
    Clients.findOneAndUpdate({ dbid: resp.client_database_id }, { $set: { channel: resp.cid } }, { upsert: true }, function (err, result) {
      });
  }

  function userLeft(resp) {
    Clients.findOneAndUpdate({ curid: resp.clid }, { $set: { online: new Date(), curid: null } }, function (err, result) {
      });
  }

  function getClientList() {
    clients = [];
    cl.send("use", {sid: 1}, function(err, resp, rawResponse){
      cl.send("clientlist", function(err, resp, rawResponse){
        if (Array.isArray(resp)) {
          resp.forEach(function(element) {
            if(element.client_type == 0) {
              userLoad(element);
            }
          });
        } else {
          if(resp.client_type == 0) {
            // // disable adding ServerQuery users
            // user(resp, false);
          }
        }
        });
    });
  }

  function updatePositions() {
    cl.send("use", {sid: 1}, function(err, resp, rawResponse){
      cl.send("clientlist", function(err, resp, rawResponse){
        if (Array.isArray(resp)) {
          resp.forEach(function(element) {
            //if(!element.client_nickname.includes("Unknown from")) {
            if(element.client_type == 0) {
              userUpdate(element);
            }
          });
        } else {
          if(resp.client_type == 0) {
            userUpdate(resp);
          }
        }
      });
    });
  }

  function resetOnlines() {
    Clients.find({ online: "true" }).exec(function (err, res) {
      if (err) {
        getClientList();
        return;
      } if (res) {
        if (res.length < 1) getClientList();
        res.forEach(function (element) {
          Clients.findOneAndUpdate({ dbid: element.dbid }, { $set: { online: new Date(), curid: null } }, function (err, result) {
            if (result) {
              if(res[res.length-1].dbid == element.dbid) getClientList();
            }
          });
        });
      }
    });
  }

  function handleEvents() {
    cl.on("cliententerview", function (resp) {
      Clients.find({ online: "true" }).exec(function (err, res) {
        if (err) {
          return;
        } if (res) {
          var count = res.length;
          online = count;
          Subscriptions.find().exec(function (err, result) {
            if (err) {
              return;
            }
            if (result) {
              var onlineids = [];
              res.forEach(function (element) {
                onlineids.push(element.dbid);
              });
                result.forEach(function (element) {
                  // корректировка значения
                  count++;
                  if (count >= element.notifyAmount && element.notifyAmount != 0) {
                    if(resp.client_database_id != element.tsUserId && onlineids.indexOf(element.tsUserId) == -1) {
                      bot.sendMessage(element.tgUserId, "🔔 *Онлайн*: на сервере " + (count-1) + " человек(а)", opts);
                    }
                  }
                });
                Subscriptions.find({ $or: [{ tsIds: resp.client_database_id }, { notifyAll: true }, { notifyAll: false }] }).exec(function (err, result) {
                  if (err) {
                    return;
                  } if (result) {
                    result.forEach(function (element) {
                      if (element.notifyAll == false) {
                          // отправляем уведомление всем, кто активировал режим белого списка
                          if (element.tsIds.indexOf(resp.client_database_id) != -1) {
                            if(resp.client_database_id != element.tsUserId && onlineids.indexOf(element.tsUserId) == -1) {
                              bot.sendMessage(element.tgUserId, "➕ " + resp.client_country + ": *" + resp.client_nickname + "* (" + resp.client_database_id + ") подключился", opts);
                            }
                          }
                      } else {
                        // отправляем уведомление всем, кто активировал режим чёрного списка
                        if (element.tsIds.indexOf(resp.client_database_id) == -1) {
                          if(resp.client_database_id != element.tsUserId && onlineids.indexOf(element.tsUserId) == -1) {
                            bot.sendMessage(element.tgUserId, "➕ " + resp.client_country + ": *" + resp.client_nickname + "* (id" + resp.client_database_id + ") подключился", opts);
                          }
                        }
                      }
                    });
                  }
                  userJoin(resp);
                });
            }
          });
        }
      });
    });

    cl.on("clientleftview", function (resp) {
      Clients.find({ online: "true" }).exec(function (err, res) {
        if (err) {
          return;
        } if (res) {
          var count = res.length;
          online = count;
          Subscriptions.find().exec(function (err, result) {
            if (err) {
              return;
            }
            if (result) {
              var onlineids = [];
              res.forEach(function (element) {
                onlineids.push(element.dbid);
              });
                Clients.find({ curid: resp.clid }).exec(function (err, reslt) {
                  if (err) {
                    return;
                  }
                  if (reslt) {
                    //
                    result.forEach(function (element) {
                      if(element.notifyAmount) {
                        if (count == element.notifyAmount && element.notifyAmount != 0) {
                          if(resp.client_database_id != element.tsUserId && onlineids.indexOf(element.tsUserId) == -1) {
                            // корректировка значения
                            bot.sendMessage(element.tgUserId, "🔕 *Онлайн*: на сервере меньше " + element.notifyAmount + " человек(а)", opts);
                          }
                        }
                      }
                    });
                    //
                    reslt.forEach(function (unit) {
                      Subscriptions.find({ $or: [{ tsIds: unit.dbid }, { notifyAll: true }, { notifyAll: false }] }).exec(function (error, result) {
                        if (error) {
                          aareturn;
                        }
                        if (result) {
                          result.forEach(function (element) {
                            if (element.notifyAll == false) {
                                // отправляем уведомление всем, кто активировал режим белого списка
                                if (element.tsIds.indexOf(unit.dbid) != -1) {
                                  if(resp.client_database_id != element.tsUserId && onlineids.indexOf(element.tsUserId) == -1) {
                                    switch (resp.reasonid) {
                                      case 3:
                                        bot.sendMessage(element.tgUserId, "✖️ *" + unit.name + "*(id" + unit.dbid + ") потерял соединение с сервером..", opts);
                                        break;
                                      case 5:
                                        if(resp.reasonmsg) {
                                          bot.sendMessage(element.tgUserId, "⚠️ *" + unit.name + "*(id" + unit.dbid + ") кикнут *" + resp.invokername + "*(id" + resp.invokerid + "), причина: _" + resp.reasonmsg + "_", opts);
                                        } else {
                                          bot.sendMessage(element.tgUserId, "⚠️ *" + unit.name + "*(id" + unit.dbid + ") кикнут *" + resp.invokername + "*(id" + resp.invokerid + ") без причины", opts);
                                        }
                                        break;
                                      case 6:
                                        if(resp.reasonmsg) {
                                          bot.sendMessage(element.tgUserId, "❗️ *" + unit.name + "*(id" + unit.dbid + ") забанен *" + resp.invokername + "*(id" + resp.invokerid + ") на " + resp.bantime + " сек, причина: _" + resp.reasonmsg + "_", opts);
                                        } else {
                                          bot.sendMessage(element.tgUserId, "❗️ *" + unit.name + "*(id" + unit.dbid + ") забанен *" + resp.invokername + "*(id" + resp.invokerid + ") на " + resp.bantime + " сек без причины", opts);
                                        }
                                        break;
                                      case 8:
                                        bot.sendMessage(element.tgUserId, "➖ *" + unit.name + "*(id" + unit.dbid + ") вышел :с", opts);
                                        break;
                                      case 11:
                                        bot.sendMessage(element.tgUserId, "✖️ *" + unit.name + "*(id" + unit.dbid + ") отключён от сервера", opts);
                                        break;
                                      default:
                                        bot.sendMessage(element.tgUserId, "➖ *" + unit.name + "*(id" + unit.dbid + ") вышел :с", opts);
                                    }
                                  }
                                }
                            } else {
                              // отправляем уведомление всем, кто активировал режим чёрного списка
                              
                              if (unit.name != '') {
                                if (element.tsIds.indexOf(unit.dbid) == -1) {
                                  if(resp.client_database_id != element.tsUserId && onlineids.indexOf(element.tsUserId) == -1) {
                                    switch (resp.reasonid) {
                                      case 3:
                                        bot.sendMessage(element.tgUserId, "✖️ *" + unit.name + "*(id" + unit.dbid + ") потерял соединение с сервером..", opts);
                                        break;
                                      case 5:
                                        if(resp.reasonmsg) {
                                          bot.sendMessage(element.tgUserId, "⚠️ *" + unit.name + "*(id" + unit.dbid + ") кикнут *" + resp.invokername + "*(id" + resp.invokerid + "), причина: _" + resp.reasonmsg + "_", opts);
                                        } else {
                                          bot.sendMessage(element.tgUserId, "⚠️ *" + unit.name + "*(id" + unit.dbid + ") кикнут *" + resp.invokername + "*(id" + resp.invokerid + ") без причины", opts);
                                        }
                                        break;
                                      case 6:
                                        if(resp.reasonmsg) {
                                          bot.sendMessage(element.tgUserId, "❗️ *" + unit.name + "*(id" + unit.dbid + ") забанен *" + resp.invokername + "*(id" + resp.invokerid + ") на " + resp.bantime + " сек, причина: _" + resp.reasonmsg + "_", opts);
                                        } else {
                                          bot.sendMessage(element.tgUserId, "❗️ *" + unit.name + "*(id" + unit.dbid + ") забанен *" + resp.invokername + "*(id" + resp.invokerid + ") на " + resp.bantime + " сек без причины", opts);
                                        }
                                        break;
                                      case 8:
                                        bot.sendMessage(element.tgUserId, "➖ *" + unit.name + "*(id" + unit.dbid + ") вышел :с", opts);
                                        break;
                                      case 11:
                                        bot.sendMessage(element.tgUserId, "✖️ *" + unit.name + "*(id" + unit.dbid + ") отключён от сервера", opts);
                                        break;
                                      default:
                                        bot.sendMessage(element.tgUserId, "➖ *" + unit.name + "*(id" + unit.dbid + ") вышел :с", opts);
                                    }
                                  }
                                }
                              } else {
                                bot.sendMessage(element.tgUserId, "➖ Кто-то вышел с сервера :с", opts);
                              }
                            }
                          });
                          if (result.length < 1) bot.sendMessage(element.tgUserId, "➖ Кто-то вышел с сервера :с", opts);
                        }
                        userLeft(resp);
                      });
                    });
                  }
                });
            }
          });
        }
      });
    });

  }

  const MONTH_NAMES = [
    'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
    'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'
  ];
  
  
  function getFormattedDate(date, prefomattedDate = false, hideYear = false) {
    const day = date.getDate();
    const month = MONTH_NAMES[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours();
    let minutes = date.getMinutes();
  
    if (minutes < 10) {
      // Adding leading zero to minutes
      minutes = `0${ minutes }`;
    }
  
    if (prefomattedDate) {
      // Today at 10:20
      // Yesterday at 10:20
      return `${ prefomattedDate } в ${ hours }:${ minutes }`;
    }
  
    if (hideYear) {
      // 10. January at 10:20
      return `${ day } ${ month } в ${ hours }:${ minutes }`;
    }
  
    // 10. January 2017. at 10:20
    return `${ day } ${ month } ${ year }. в ${ hours }:${ minutes }`;
  }
  // --- Main function
  function timeAgo(dateParam) {
    if (!dateParam) {
      return null;
    }
  
    const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
    const DAY_IN_MS = 86400000; // 24 * 60 * 60 * 1000
    const today = new Date();
    const yesterday = new Date(today - DAY_IN_MS);
    const seconds = Math.round((today - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const isToday = today.toDateString() === date.toDateString();
    const isYesterday = yesterday.toDateString() === date.toDateString();
    const isThisYear = today.getFullYear() === date.getFullYear();
  
  
    if (seconds < 5) {
      return `только что`;
    } else if (seconds < 60) {
      return `${ seconds } сек. назад`;
    } else if (seconds < 90) {
      return 'минуту назад';
    } else if (minutes < 60) {
      return `${ minutes } мин. назад`;
    } else if (hours < 2) {
      return `${ hours } час назад`;
    } else if (hours < 24) {
      return `${ hours } час. назад`;
    } else if (days < 2) {
      return `${ days } день назад`;
    } else if (days < 7) {
      return `${ days } дн. назад`;
    } else if (isThisYear) {
      return getFormattedDate(date, false, true); // 10. January at 10:20
    }
  
    return getFormattedDate(date); // 10. January 2017. at 10:20
  }
}

var listener = new TeamSpeakListener();

//# sourceMappingURL=main-compiled.js.map