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
  var helpText = "made by @proxwian";

  var connectText = "[Подключиться к серверу](http://www.teamspeak.com/invite/teamsp3ak.ru/)";

  var server = parsedJson.server;
  var port = parsedJson.port;
  var queryPort = parsedJson.queryPort;

  // массив для хранения данных о подключаемых пользователях
  // 
  var clients = [];

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
    "tsUserId": { type: Number },
    "notifyAll": { type: Boolean, default: false },
    "notifyAmount": { type: Number },
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
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      keyboard: [
        ['🔌 Подключиться', '👽 Онлайн', '📜 Карта'],
        ['🖍 Подписки', '📍 Уведомления', '👥 Пользователи'],
        ['👁 Режим', '👎 Блэклист', '👍 Вайтлист']
      ]
    })
  };

  mongoose.connect(parsedJson.mongooseConnection);
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));

  db.once('open', function () {
    bot.onText(/\/start/, function (msg) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { tgUserId: msg.from.id }, { upsert: true }, function (err, result) {
        if (result) {
          bot.sendMessage(msg.from.id, helpText, opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Ошибка регистрации Вашего аккаунта Telegram', opts);
        }
      });
    });

    bot.onText(/\/stop|\/stahp/, function (msg) {
      Subscriptions.remove({ tgUserId: msg.from.id }, function (err) {
        if (!err) {
          bot.sendMessage(msg.from.id, 'Ок, больше никаких сообщений от меня)', opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Ошибка подключения к БД', opts);
        }
      });
    });

    bot.on('callback_query', function onCallbackQuery(callbackQuery) {
      const action = callbackQuery.data;
      const msg = callbackQuery.message;
      const opts = {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
        };
      let text;
      if (action === 'edit') {
          text = 'Edited Text';
        }
      bot.editMessageText(text, opts);
    });

    bot.onText(/\/help/, function (msg) {
      bot.sendMessage(msg.chat.id, helpText, opts);
    });

    bot.onText(/\/connect|🔌 Подключиться$/, function (msg) {
      bot.sendMessage(msg.chat.id, connectText, opts);
    });

    bot.onText(/\/who$|\/list$|👽 Онлайн/, function (msg) {
      var strlist = '';
      Clients.find({ online: "true" }).exec(function (err, result) {
        if (err) {
          return;
        } if (result) {
          var count = 0;
          result.sort(function(a, b){ return a.dbid-b.dbid });
          result.forEach(function (element) {
            count++;
            strlist += "id" + element.dbid + ": " + element.name + " \\[" + element.power + "\]";
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
            bot.sendMessage(msg.chat.id, "Сейчас на сервере " + count + str +":\n\n" + strlist, opts);
          } else {
            bot.sendMessage(msg.chat.id, "В данный момент никого онлайн нет...", opts);
          }
        }
      });
    });

    bot.onText(/\/whoall|\/listall|👥 Пользователи/, function (msg) {
      var strlist = '';
      var i = 0;
      Clients.find().exec(function (err, result) {
          if (err) {
            bot.sendMessage(msg.chat.id, "Ошибка запроса к БД *_*");
            return;
          } if (result) {
            result.sort(function(a, b){ return a.dbid-b.dbid });
            result.forEach(function (element) {
              if (element.dbid == null) return;
              i++;
              strlist += "id" + element.dbid + ": " + element.name + " \\[" + element.power + "\]";
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

    bot.onText(/\/info (.+)|\/online (.+)/, function (msg, args) {
      Clients.find({ name: args[1].valueOf() }).exec(function (err, result) {
          if (err) {
            bot.sendMessage(msg.chat.id, "Ошибка *_*", opts);
            return;
          } if (result) {
            result.forEach(function (element) {
              var str = 'Пользователь ' + element.name + '(id' + element.dbid + ')';
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
                    var str = 'Пользователь ' + element.name + '(id' + element.dbid + ')';
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

    bot.onText(/\/tree$|\/map$|📜 Карта$/, function (msg) {
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

    bot.onText(/\/whitelist|\/unsubscribeall|👍 Вайтлист/, function (msg) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { notifyAll: false }, function (err, result) {
        if (result) {
          bot.sendMessage(msg.from.id, 'Включен режим вайт-листа. Уведомления будут приходить только от пользователей, на которых Вы подписаны', opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке изменить принцип работы уведомлений', opts);
        }
      });
    });

    bot.onText(/\/blacklist|\/subscribeall|👎 Блэклист/, function (msg) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { notifyAll: true }, function (err, result) {
        if (result) {
          bot.sendMessage(msg.from.id, 'Включен режим черного списка. Уведомления будут приходить от всех пользователей, кроме тех, на которых Вы подписаны', opts);
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке подписаться', opts);
        }
      });
    });

    bot.onText(/\/sub (.+)/, function (msg, args) {
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
                    bot.sendMessage(msg.from.id, 'Пользователь ' + user.name + '(id' + user.dbid + ') добавлен в ваши подписки', opts);
                  }
                });
                break;
              default:
                Clients.find({ dbid: args[1].valueOf() }).exec(function (err, result) {
                  if (err) {
                    bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден...', opts);
                  }
                  if (result) {
                    if (result.length) {
                      if (result.length < 1) {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден :с', opts);
                      } else {
                        user = result[0];
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $addToSet: { tsIds: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке добавить пользователя', opts);
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Пользователь ' + user.name + '(id' + user.dbid + ') добавлен в ваши подписки', opts);
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
                            bot.sendMessage(msg.from.id, 'Пользователь ' + user.name + '(id' + user.dbid + ') добавлен в ваши подписки', opts);
                          }
                        });
                      } else {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден :с', opts);
                      }
                    }
                  }
                });
            }
        }
      });
    });

    bot.onText(/\/subscribe$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите имя для команды /subscribe', opts);
    });

    bot.onText(/\/sub$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите имя для команды /sub', opts);
    });

    bot.onText(/\/me (.+)/, function (msg, args) {
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
                    bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя ' + user.name + '(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн', opts);
                  }
                });
                break;
              default:
                Clients.find({ dbid: args[1].valueOf() }).exec(function (err, result) {
                  if (err) {
                    bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя ' + user.name + '(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн');
                  }
                  if (result) {
                    if (result.length) {
                      if (result.length < 1) {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден :с');
                      } else {
                        user = result[0];
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { tsUserId: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке найти пользователя');
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя ' + user.name + '(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн');
                          }
                        });
                      }
                    } else {
                      user = result;
                      if (user.dbid != null && user.dbid != undefined) {
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { tsUserId: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке найти пользователя (aga)');
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Вы указали аккаунт пользователя ' + user.name + '(id' + user.dbid + ') как личный. Вам не будут приходить уведомления, пока этот аккаунт онлайн');
                          }
                        });
                      } else {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден :с');
                      }
                    }
                  }
                });
            }
        }
      });
    });

    bot.onText(/\/unsub (.+)/, function (msg, args) {
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
                    bot.sendMessage(msg.from.id, 'Пользователь ' + user.name + '(id' + user.dbid + ') удалён из подписок', opts);
                  }
                });
                break;
              default:
                Clients.find({ dbid: args[1].valueOf() }).exec(function (err, result) {
                  if (err) {
                    bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден...', opts);
                  }
                  if (result) {
                    if (result.length) {
                      if (result.length < 1) {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден :с', opts);
                      } else {
                        user = result[0];
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $pull: { tsIds: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке отписаться от пользователя');
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Пользователь ' + user.name + '(id' + user.dbid + ') удалён из подписок');
                          }
                        });
                      }
                    } else {
                      user = result;
                      if (user.dbid != null && user.dbid != undefined) {
                        Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $pull: { tsIds: user.dbid } }, function (er, res) {
                          if (er) {
                            bot.sendMessage(msg.from.id, 'Возникла ошибка при попытке отписаться от пользователя (aga)');
                          }
                          if (res) {
                            bot.sendMessage(msg.from.id, 'Пользователь ' + user.name + '(id' + user.dbid + ') удалён из подписок');
                          }
                        });
                      } else {
                        bot.sendMessage(msg.from.id, 'Пользователь с ником или id ' + args[1] + ' не найден :с');
                      }
                    }
                  }
                });
            }
        }
      });
    });

    bot.onText(/\/unsubscribe$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите id для команды /unsubscribe', opts);
    });
  
    bot.onText(/\/unsub$/, function (msg) {
      bot.sendMessage(msg.from.id, 'Введите id для команды /unsub', opts);
    });
  
    bot.onText(/\/notify$|📍 Уведомления/, function (msg) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { notifyAmount: 0 } }, function (error, result) {
        if (error) {
          bot.sendMessage(msg.from.id, 'Ошибка БД', opts);
        }
        if (result) {
          bot.sendMessage(msg.from.id, 'Уведомления о количестве человек отключены', opts);
        }
      });
    });
  
    bot.onText(/\/notify (.+)/, function (msg, args) {
      Subscriptions.findOneAndUpdate({ tgUserId: msg.from.id }, { $set: { notifyAmount: args[1] } }, function (error, result) {
        if (error) {
          bot.sendMessage(msg.from.id, 'Ошибка: необходимо указать число', opts);
        }
        if (result) {
          bot.sendMessage(msg.from.id, 'Хорошо, я буду уведомлять об онлайне, когда на сервере будет больше ' + args[1] + ' человек(а)', opts);
        }
      });
    });
  
    bot.onText(/\/mode$|👁 Режим/, function (msg) {
      Subscriptions.findOne({ tgUserId: msg.from.id }, function (err, result) {
        if (result) {
          (function () {
            if (result.notifyAll == true) {
              bot.sendMessage(msg.from.id, 'Сейчас активирован режим черного списка. Уведомления будут приходить от всех пользователей, кроме тех, на которых Вы подписаны', opts);
            } else {
              bot.sendMessage(msg.from.id, 'Сейчас активирован режим вайт-листа. Уведомления будут приходить только от пользователей, на которых Вы подписаны', opts);
            }
          })();
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при отправке запроса к БД', opts);
        }
      });
    });
  
    bot.onText(/\/subscriptions*|🖍 Подписки/, function (msg) {
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
                subscriptions = subscriptions + i + ") id" + element + ": " + name + "\n";
                i++;
              });
              if (subscriptions) {
                if (result.notifyAll) {
                  bot.sendMessage(msg.from.id, 'Подписки (чёрный список):  \n' + subscriptions, opts);
                } else {
                  bot.sendMessage(msg.from.id, 'Подписки (вайт-лист):  \n' + subscriptions, opts);
                }
              } else {
                bot.sendMessage(msg.from.id, 'У вас нет активных подписок :с', opts);
              }
            }
          });
        }
        if (err) {
          bot.sendMessage(msg.from.id, 'Возникла ошибка при отправке запроса к БД');
        }
      });
    });
  });

  serverNotifyRegister();
  handleEvents();
  getClientList();

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

  function handleEvents() {
    cl.on("cliententerview", function (resp) {
      //noinspection JSUnresolvedVariable
      Subscriptions.find({ $or: [{ tsIds: resp.client_database_id }, { notifyAll: true }, { notifyAll: false }] }).exec(function (err, result) {
        if (err) {
          return;
        } if (result) {
          result.forEach(function (element) {
            if (element.notifyAll == false) {
                // отправляем уведомление всем, кто активировал режим белого списка
                if (element.tsIds.indexOf(resp.client_database_id) != -1) {
                  bot.sendMessage(element.tgUserId, resp.client_country + ": " + resp.client_nickname + " [" + resp.client_talk_power + "] подключился", opts);
                }
            } else {
              // отправляем уведомление всем, кто активировал режим чёрного списка
              if (element.tsIds.indexOf(resp.client_database_id) == -1) {
                bot.sendMessage(element.tgUserId, resp.client_country + ": " + resp.client_nickname + " [" + resp.client_talk_power + "] подключился", opts);
              }
            }
          });
        }
        userJoin(resp);
      });
      Clients.find({ online: "true" }).exec(function (err, res) {
        if (err) {
          return;
        } if (res) {
          var count = res.length;
          Subscriptions.find().exec(function (err, result) {
            if (err) {
              return;
            }
            if (result) {
              res.forEach(function (element) {
                result.forEach(function (e) {
                  if (element.tsUserId == e.tsUserId) {
                    return;
                  }
                });
              });
              result.forEach(function (element) {
                if (count >= element.notifyAmount && element.notifyAmount != 0) {
                  // корректировка значения
                  count++;
                  bot.sendMessage(element.tgUserId, "Онлайн: на сервере " + count + " человек(а)", opts);
                }
              });
            }
          });
        }
      });
    });

    cl.on("textmessage", function (resp) {
      if(resp.targetmode == 1) {
        Subscriptions.find({ $and: [{ tsIds: "chat" }, { tsIds: "server" }] }).exec(function (err, result) {
          if (err) {
            return;
          }if (result) {
            result.forEach(function (element) {
              bot.sendMessage(element.tgUserId, resp.msg, opts);
            });
          }
        });
      }
    });

    cl.on("clientmoved", function (resp) {
      Subscriptions.find({ $and: [{ tsIds: "chat" }, { tsIds: "server" }] }).exec(function (err, result) {
        if (err) {
          return;
        }if (result) {
          result.forEach(function (element) {
            bot.sendMessage(element.tgUserId, "clientmoved");
          });
        }
      });
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].id == resp.clid) {
            clients[i].channel = resp.ctidf;
        }
      }
    });

    cl.on("clientleftview", function (resp) {
      //noinspection JSUnresolvedVariable
      Clients.find({ curid: resp.clid }).exec(function (err, res) {
        if (err) {
          return;
        }
        if (res) {
          res.forEach(function (unit) {
            Subscriptions.find({ $or: [{ tsIds: unit.dbid }, { notifyAll: true }, { notifyAll: false }] }).exec(function (error, result) {
              if (error) {
                return;
              }
              if (result) {
                result.forEach(function (element) {
                  if (element.notifyAll == false) {
                      // отправляем уведомление всем, кто активировал режим белого списка
                      if (element.tsIds.indexOf(unit.dbid) != -1) {
                        bot.sendMessage(element.tgUserId, unit.name + " вышел :с", opts);
                      }
                  } else {
                    // отправляем уведомление всем, кто активировал режим чёрного списка
                    
                    if (unit.name != '') {
                      if (element.tsIds.indexOf(unit.dbid) == -1) {
                        bot.sendMessage(element.tgUserId, unit.name + " вышел :с", opts);
                      }
                    } else {
                      bot.sendMessage(element.tgUserId, "Кто-то вышел с сервера :с", opts);
                    }
                  }
                });
                if (result.length < 1) bot.sendMessage(element.tgUserId, "Кто-то вышел с сервера :с", opts);
              }
              userLeft(resp);
            });
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
      return `${ day }. ${ month } в ${ hours }:${ minutes }`;
    }
  
    // 10. January 2017. at 10:20
    return `${ day }. ${ month } ${ year }. в ${ hours }:${ minutes }`;
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

  function dbid(id) {
    if (id == 14) {
      return 1;
    } else {
      return id;
    }
  }
}

var listener = new TeamSpeakListener();

//# sourceMappingURL=main-compiled.js.map