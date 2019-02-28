# Ts3TgBot
This is a fork of notification bot "TSOBot" for TeamSpeak 3 servers. It can send various notifications, when users join/leave based on subscription type, have some commands for view client list (online/full) and server channel tree

## Installation
1. Before installing bot, make sure to set the right *b_virtualserver_notify_register* for guests on you TS3 server.

2. Create a new Telegram bot by sending a message to @Botfather in Telegram. He'll send you your Bot API key and gives you all information you need to run your bot. You'll find further information concerning bots at [Telegram].

3. Ts3TgBot utilizes MongoDB to store active subscriptions and . Therefore a running MongoDB instance is mandatory. Download and install it from [here].

4. Go ahead and install Ts3TgBot via npm:

    ```
    npm install ts3tgbot
    ```

5. Navigate to the folder of the newly installed Ts3TgBot module. Create a new ```settings.json``` file by copying the existing ```settingsExample.json``` and fill it with your personal settings:

  * **botApiKey**: You'll receive this from Telegrams @Botfather.
  * **mongooseConnection**: Connection string for your MongoDB database.
  * **server**: IP or hostname of your TS3 server.
  * **port**: TS3 server port. If empty, default port will be used (9987).
  * **queryPort**: TS3 ServerQuery port. If empty, default port will be used (10011).

6. Run ```npm start``` in context of your node_modules/tsobot folder to start the bot.

[Telegram]: https://core.telegram.org/bots
[here]: https://www.mongodb.org/


## Usage
These commmands are supported:

  * **/connect** - Show connect url link (can be configured)
  * **/start** - Initial command to start conversation with the bot (creates user in db)
  * **/stop or /stahp** - Omit this command and you'll never hear anything again from the bot. All your subscriptions will be deleted.
  * **/who or /list** - Displays user list currently online
  * **/tree or /map** - Displays server channel tree (map) with users in current channels
  * **/whitelist** - Switch notification mode to whitelist (notify about all users, except users in subscribes list) - default
  * **/blacklist** - Switch notification mode to blacklist (notify only about users in subscribes list)
  * **/mode** - Displays the current notification mode
  * **/listall or /whoall** - Displays all clients in the database with ids and last online status
  * **/subscribe or /sub** *username*/*id from database* - Add *username* to your subscribe list.
  * **/unsubscribe or /unsub** *username*/*id from database* - Remove *username* from your subscribe list.
  * **/subscriptions** - Show all active subscriptions.

## Development
TSOBot was developed on node.js with ES2015.
Ts3TgBot was developed based on TSOBot in VSCode ;)

It works thanks to these node packages:

  * node-teamspeak
  * node-telegram-bot-api
  * mongoose
  * and, of course, TSOBot plugin