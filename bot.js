const { Client, Intents, Interaction, Message, Channel, MessageComponentInteraction, DataResolver } = require("discord.js");
const config = require("./config.json");
const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS
    ]
});

var sqlite3 = require("sqlite3").verbose(); //
var database = new sqlite3.Database("members.db"); // open the database

const cmdPrefix = "!";

var usersCollected = new Map(); // userID and the time the user can next collect

client.on("ready", () => {
    console.log("Bot is now running");
})

client.on('messageCreate', (msg) => {
    if (msg.author.bot) return;
    let msgData = msg.content;
    if (msgData[0] == cmdPrefix) {
        processCommand(msg, msgData);
    }
});

// event discordMsg, string messageContent
async function processCommand(discordMsg, messageContent) {
    messageContent.toLowerCase();
    const argv = messageContent.split(" "); // split the message
    const argc = argv.length; // arg count
    let userID;
    let errMsg;
    switch (argv[0]) {
        case ("!balance"):
            if (argc == 2) {
                userID = argv[1];
                // remove the non-numeric characters
                userID = await parseUserID(userID);
            } else if (argc == 1) {
                userID = discordMsg.author.id;
            } else {
                errMsg = `Incorrect syntax. Example below:
                \`\`\`!balance @player \nor\n
                !balance\`\`\``
                unknownCmd(discordMsg, errMsg);
                return;
            }
            displayBalance(discordMsg, userID);
            break;
        case ("!register"):
            if (argc != 2) {
                errMsg = `Incorrect syntax. Example below:
                \`\`\`!register Joe\`\`\``;
                unknownCmd(discordMsg, errMsg);
                return;
            }
            initMember(discordMsg, argv[1]);
            break;
        case ("!name"): // name change command
            userID = discordMsg.author.id;
            userID = await parseUserID(userID);
            if(argc == 1) {
                unknownCmd(discordMsg, "Enter your name after !name")
                return;
            }
            changeName(userID, argv[1]);
            break;
        case ("!claim"):
            break;
        case ("!coinflip"):
            // check size first so we don't get segmentation error or access invalid index
            if(argc != 3) {
                errMsg = `Incorrect syntax. Example below:
                \`\`\`!coinflip heads 50\`\`\``;
                unknownCmd(discordMsg, err);
                return;
            }
            argv[1].toLowerCase();
            if(argv[1] != "heads" || argv[1] != "tails" || parseInt(argv[2]) === NaN) {
                errMsg = `Incorrect syntax. Example below:
                \`\`\`!coinflip heads 50\`\`\``;
                unknownCmd(discordMsg, err);
                return;
            }
            coinflip(discordMsg, userID, argv[1].toLowerCase, parseInt(argv[2]));
            break;
        case("!craft"): // feature for mineraft, enter the minecraft id or the name of the item, and you will be shown the crafting recipe
            break; 
    }
}

// Purpuse: display error message
function unknownCmd(discordMsg, errMsg) {
    discordMsg.channel.send(errMsg);
}

async function parseUserID(usrID) {
    usrID = usrID.replace("<@!", "");
    usrID = usrID.replace(">", "");
    return usrID;
}

// clientMsg, userID
async function displayBalance(discordMsg, userID) {
    userID = await parseUserID(userID); // safety measure
    let userBalance;
    await getBalance(userID).then(result => {
        userBalance = result;
    }).catch(err => { console.log("Error"); });
    console.log(userBalance);
    if (userBalance === undefined) {
        discordMsg.channel.send("You don't have an existing balance");
        return;
    }
    discordMsg.channel.send(`Balance for ${discordMsg.author.username}: $${userBalance}`);
}

async function getBalance(userID) {
    if (containsQuote(userID) === true) return undefined;
    let queryStmt = `SELECT memberBalance FROM Members WHERE memberID = '${userID}';`;
    let userExistence;
    doesUserExist(userID).then(result => {
        userExistence = result;
    }).catch(err => {
        return undefined;
    });
    return new Promise((resolve, reject) => {
        database.get(queryStmt, (err, rows) => {
            if (err) {
                console.log("Error in getBalance");
                reject(err);
            }
            resolve(rows.memberBalance);
        });
    });
}

async function initMember(discordMsg, name) {
    let userID = discordMsg.author.id;
    let userExistence; //
    await doesUserExist(userID).then(result => {
        userExistence = result;
    }).catch(err => {
        return;
    });
    if (userExistence === true) {
        discordMsg.channel.send("You already have an account!");
        return;
    }
    let queryStmt = `INSERT INTO Members(memberID, memberBalance, ID) VALUES (${userID}, ${name}, 100);`
    if (containsQuote(queryStmt) === true) {
        discordMsg.channel.send("Invalid Name");
        return;
    }
    try {
        // inserting new user into the database
        database.run(queryStmt, (err) => {
            if (err) throw err;
        });
    } catch (err) {
        console.log("There was an error initializing a user");
    }
}



async function coinflip(discordMsg, userID, guess, wager) {
    let userBalance = await getBalance(userID);
    if (wager > userBalance || wager < 0) {
        discordMsg.channel.send("Invalid wager");
        return;
    }
    let userExistence;
    await doesUserExist(userID).then(result => {
        userExistence = result;
    }).catch(err => {
        return;
    });
    if (userExistence === false) return;
    let coinflipRes;
    if (await getRandomInt(0, 1) === 0) coinflipRes = "heads";
    else coinflipRes = "tails";
    if (guess === coinflipRes) {
        discordMsg.channel.send(`You won +${wager}!`);
        updateUserBalance(userID, wager);
    } else {
        wager *= -1;
        discordMsg.channel.send(`You lost -${wager}!`);
        updateUserBalance(userID, wager);
    }
}

async function updateUserBalance(userID, amount) {
    let queryStmt = `UPDATE Members SET memberBalance = memberBalance + ${amount} WHERE memberID = ${userID}`;
    try {
        database.run(queryStmt, (err) => {
            if (err) throw (err);
        });
    } catch (err) {
        console.log("Error");
        return;
    }
}

// This function is inclusive of min and max
async function getRandomInt(min, max) {
    min = Math.floor(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * ((max + 1) - min));
}

async function doesUserExist(userID) {
    let queryStmt = `SELECT memberID FROM Members WHERE memberID = '${userID}'`;
    return new Promise((resolve, reject) => {
        database.get(queryStmt, (err, rows) => {
            if (err) {
                console.log("Error checking user existence");
                reject(err);
            }
            if (userID == rows.memberID) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

// check if there's a single quote so query won't crash
async function containsQuote(str) {
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\'' || str[i] === '"') {
            console.log(str[i]);
            return true;
        }
    }
    return false;
}

async function changeName(userID, name) {
    if(await containsQuote(userID)) {
        console.log("User ID Contains quotes. In changeName function");
        return;
    } 
    if(await containsQuote(name)) {
        console.log("New player name contains quotes");
        return;
    }
    let queryStmt = `UPDATE Members SET memberName = '${name}' WHERE memberID = ${userID}`;
    try {
        database.run(queryStmt, (err)=> {
            if(err) throw err;
        })
    } catch(err) {
        console.log("There was an error changing member name");
        return;
    }
}

client.login(config.BOT_TOKEN); // <--- create your config.json file with your token