// 1. require in Express
const express = require('express');
const cors = require('cors');

// require in our MongoUtil file
const mongoUtil = require('./MongoUtil');

// 2. create an expres application
const app = express();

// 2a. inform Express that we are going to use json for requests and responses
app.use(express.json())
app.use(cors()); // allow cross origin resources sharing (why do we need this? by default, an API can be only be consumed by HTML files on the same domain)

// the reason why those two variables are in ALL CAPS is to remind
// the programmer that are global and have special meaning
const MONGO_URI = "mongodb+srv://root:rotiprata123@cluster0.s3fdn.mongodb.net/?retryWrites=true&w=majority";
const DB_NAME = "dwad_e_food_reviews";

async function main() {
    const db = await mongoUtil.connect(MONGO_URI, DB_NAME);

    // 3. define some routes
    app.get('/', function (req, res) {
        res.json({
            'message': 'I love candies and cupcakes'
        });
    })

    // route to add a document to the database
    // we use the POST method because we are adding to the database
    // by the RESTFUL convention (i.e standards), when a route is
    // to add a new document to a database, we use the POST method
    app.post('/reviews', async function(req,res){
        await db.collection('reviews').insertOne({
            "title":"Good steak at the SteakOut Resturant",
            "food":"Ribeye Steak",
            "content":"The steak was perfectly prepared",
            "rating": 9
        })
        // send a JSON message 
        // we must send back a JSON message or else the web browser (i.e the client)
        // will be waiting for a response until it times out.
        res.json({
            'message':'ok'
        })
    })
}

main();


// 4. start the server
app.listen(3000, function () {
    console.log("server has started")
})