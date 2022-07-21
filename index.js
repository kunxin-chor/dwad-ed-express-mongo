// 1. require in Express
const express = require('express');
const cors = require('cors');

// require in our MongoUtil file
const mongoUtil = require('./MongoUtil');
const { ObjectId } = require('mongodb');  // allows the use of the ObjectId function

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

    // to do a search, the client will the search criteria via the query strings
    app.get('/reviews', async function(req,res){
       

        let criteria = {};  // empty criteria object means no criteria (ie. mean documents will be shortlisted)

        // if the query string contains the 'title' key, search for title (ie. if the client indicates for the search for title)
        if (req.query.title) {
            // if req.query.title contains any values besides null, undefined, "", 0 etc etc.
            // then we add it to the criteria
            criteria.title = {
                '$regex': req.query.title,  // match by pattern
                '$options':'i'
            }
        }

        // if the query string contains the `min_rating` key, then only include reviews which food rating is greater than `min_rating` value
        // (i.e if the client provides a min_rating, then only shortlist food which rating is better than that)
        if (req.query.min_rating) {
            criteria.rating = {
                '$gte': parseInt(req.query.min_rating) // must convert to int first because whatever is from query string is a string
            }
        }
        const reviews = await db.collection('reviews').find(criteria).toArray();
        res.json(reviews);  // res.json will automatically convert a JavaScript array or object into JSON
    })

    // route to add a document to the database
    // we use the POST method because we are adding to the database
    // by the RESTFUL convention (i.e standards), when a route is
    // to add a new document to a database, we use the POST method
    app.post('/reviews', async function(req,res){
        const results = await db.collection('reviews').insertOne({
            "title": req.body.title,
            "food": req.body.food,
            "content":req.body.content,
            "rating": req.body.rating
        })
        // send a JSON message 
        // we must send back a JSON message or else the web browser (i.e the client)
        // will be waiting for a response until it times out.
        res.json({
            'message':'New review created successfully',
            'results': results
        })
    })

    // PUT means update by REPLACING a document with a new one.
    // BUT the new document has the same _id as the original one.
    app.put('/reviews/:reviewId', async function(req,res){
        
        // fetch the original document first
        const review = await db.collection('reviews').findOne({
            '_id':ObjectId(req.params.reviewId)
        })

        const results = await db.collection('reviews').updateOne({
            '_id': ObjectId(req.params.reviewId)
        },{
            "$set": {
                'title': req.body.title ? req.body.title : review.title,  // review is the original document
                'food': req.body.food ? req.body.food : review.food,
                'content': req.body.content ? req.body.content : review.content,
                'rating': req.body.rating ? req.body.rating : review.rating
            }
        })

        res.json({
            'message':'Review udpated successfully',
            'results': results
        })

    })

    app.delete('/reviews/:reviewId', async function(req,res){
        await db.collection('reviews').deleteOne({
            '_id': ObjectId(req.params.reviewId)
        })
        res.json({
            'message':"Review deleted successfully"
        })
    })
}

main();


// 4. start the server
app.listen(3000, function () {
    console.log("server has started")
})