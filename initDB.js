var sqlite3 = require('sqlite3').verbose();
var database = new sqlite3.Database("members.db");

// initialize the database

database.serialize(() => {
    database.run("CREATE TABLE Members(memberID TEXT PRIMARY KEY, memberName TEXT, memberBalance INT);");
})

database.close();