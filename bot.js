const {Client, Intents, Interaction, Message, Channel} = require("discord.js");
const config = require("./config.json");
const client = new Client({ intents: 
    [Intents.FLAGS.GUILDS, 
    Intents.FLAGS.GUILD_MESSAGES, 
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
});

var sqlite3 = require("sqlite3").verbose();
var database = new sqlite3.Database("members.db");

const cmdPrefix = "$";


client.on("ready", ()=> {
    console.log("Bot is now running");
})

client.on('messageCreate', (msg) => {
    if(msg.author.bot) return;
    var msgData = msg.content;
    let sCommaFound = () => {
        containsSingleComma(str);
    }
    if(sCommaFound === true) { // do not process data, sql database will crash
        return;
    }
    const argv = msgData.split(" ");
    // Not using switch because no variable declarations
    if(argv[0] === "$balance") {
        let queriedUser;
        if(argv.length === 2) {
            queriedUser = argv[1];
            queriedUser = queriedUser.replace("<@!", "");
            queriedUser = queriedUser.replace(">", "");
        } else if (argv.length === 1) {
            queriedUser = msg.author.id;
        } else {
            msg.channel.send("Incorrect Syntax");
            return;
        }
        let userBal;
        getBalance(queriedUser).then(res => {
            if(res === undefined) {
                msg.channel.send("No Balance Data");
            } else {
                userBal = res.memberBalance;
                msg.channel.send("Player Balance: **$" + userBal.toString() + "**");
            }
        })
        // end of $balance
    } else if(argv[0] === "$coinflip") {
        let errMsg = "Correct command is: **$coinflip heads/tails wager** Example ```$coinflip heads 25```";
        let sideGuess = ""; // heads or tails
        if(argv.length === 3 && !containsDigit(argv[1])) {
            argv[1].toLowerCase();
            if(argv[1] === "heads" || argv[1] === "head") {
                sideGuess = 0;
            } else if(argv[1] === "tails" || "tail") {
                sideGuess = 1;
            } else {
                msg.channel.send(errMsg);
                return;
            }
            argv[2] = argv[2].replace("$", "");
            let wager = parseInt(argv[2]);
            if(wager === NaN || wager < 0) {
                msg.channel.send("Invalid Wager");
                return;
            }
            coinflip(msg.author.id, sideGuess, wager, msg);
        } else {
            msg.channel.send(errMsg);
        }
    } else if(argv[0] === "$setup") { // set up discord user if they haven't been added into the database
        const userID_new = msg.author.id;
        if(argv.length !== 2) {
            msg.reply("Setup by doing: \"$setup <YourName>\" ```$setup Joe```");
            return;
        }
        doesUserExist(userID_new).then(boolres => {
            if(boolres === true) {
                msg.reply("Your account is already in the system!");
            } else {
                let insertStmt = "INSERT INTO Members (memberID, memberName, memberBalance) " 
                                 + "VALUES (" + userID_new + ", " + argv[1] + ", 100);";
                database.run(insertStmt, function(err) {
                    if(err) {
                        console.log("Error adding new user");
                        throw err;
                    }
                })
            }
        })
    }

})

/* 
Promise completion main:
getBalance(userID).then(result => {
    // code goes here
})
*/
async function getBalance(userID) {
    let queryStmt = "SELECT memberBalance FROM Members where memberID = '" + userID + "'";
    return new Promise((resolve, reject) => {
        database.get(queryStmt, (err, rows) => {
            if(err) { 
            console.log("Error"); 
            throw err; 
        }
            resolve(rows);
        })
    })
}

function containsSingleComma(str) {
    for(let i = 0; i < str.length; i++) {
        if(str[i] === "'") {
            return true;
        }
    }
    return false;
}

function containsDigit(str) {
    for(let i = 0; i < str.length; i++) {
        if(str[i] < 'a' || str[i] > 'z') {
            return true;
        }
    }
    return false;
}

// Guess number == 0 (Heads) == 1 (Tails)
async function coinflip(userID, guessNumber, wager, clientMsg) {
    var userBalance;
    await getBalance(userID).then(result => {
        userBalance = result.memberBalance;
    })
    if(userBalance === undefined) {
        clientMsg.channel.send("No Balance Data");
        return;
    } else if(wager > userBalance) {
        clientMsg.channel.send("Not enough $$");
        return;
    } // function to check if the user has a valid balance
    let coinflipResult = await getRandomInt(0, 1);
    let boolWin = false;
    let winLossMsg = "You guessed wrong :(";
    if(guessNumber === coinflipResult) {
        boolWin = true;
        winLossMsg = "You guessed right!";
    } else {
        wager *= - 1;
    }
    if(coinflipResult === 0) {
        clientMsg.channel.send("Heads! " + winLossMsg);
    } else if(coinflipResult === 1) {
        clientMsg.channel.send("Tails! " + winLossMsg);
    } else {
        clientMsg.channel.send("Uh oh, something went wrong :/");
        return;
    }
    changeUserBalance(userID, wager);
}

// Min and Max are inclusive!!!
async function getRandomInt(min, max) {
    min = Math.floor(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * ((max + 1) - min)); // max+1 for max inclusivity
}

// string and then int
async function changeUserBalance(userID, balanceChange) {
    var prevBalance;
    await getBalance(userID).then(result => {
        if(result === undefined) {
            console.log("Error, could not find balance for", userID);
        } else {
            prevBalance = result.memberBalance;
        }
    })

    var updatedBalance = prevBalance + balanceChange;
    let queryStmt = "UPDATE Members SET memberBalance = " + updatedBalance.toString() + " WHERE memberID = " + userID; 
    database.run(queryStmt, function(err) {
        if(err) {
            throw(err);
        }
    })
}

/*
promise statement
doesUserExist(userID).then(result => {
    
})
*/
async function doesUserExist(userID) {
    let queryStmt = "SELECT memberID FROM Members where memberID = '" + userID + "'";
    return doesExist = new Promise((resolve, reject) => {
        database.get(queryStmt, (err, row) => {
            if(err) {
                console.log("Error in getting memberID");
                throw err;
            }
            if(row === undefined) {
                resolve(false);
            } else {
                resolve(true);
            }
        })
    })
}

/*db.run('INSERT INTO TemperatureData (location, year) VALUES ($location, $year)', {
  $location: newRow.location,
  $year: newRow.year
}, function(error) {
  // handle errors here!

  console.log(this.lastID);
}); */

// Returns an integer

client.login(config.BOT_TOKEN);
