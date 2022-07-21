const MongoClient = require('mongodb').MongoClient;

async function connect(mongoUri, databaseName) {
    // connect to the server using the MongoClient
    const client = await MongoClient.connect(mongoUri,{
        useUnifiedTopology: true
    })

    // client.db is used to change the current active database
    const db = client.db(databaseName);
    return db;
}

// export out the connect function so other JS files can use
module.exports = {connect};