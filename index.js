// 1. require in Express
const express = require('express');
const cors = require('cors');  // cross origin resources sharing
require('dotenv').config();  // require in the dotenv module and run the config function in it
const jwt = require('jsonwebtoken');

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
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;
const TOKEN_SECRET = process.env.TOKEN_SECRET;

function generateAccessToken(id, email) {
    // use jwt.sign() to create a new token
    // first arg -- the data to store inside the token
    // second arg -- token secret (encryption key)
    // third arg -- options
    return jwt.sign({
        'id': id,
        'email': email
    }, TOKEN_SECRET, {
        'expiresIn': '1h'  // the token expires in one hour. You can specify days, weeks, years, hours, minutes
    })
}

// middleware function to check if a valid access token is inside the headers
function checkIfAuthenticatedJWT(req, res, next) {
    // req - request
    // res - response
    // next - the next function to call (if there is any remaining middleware to call, the next refers to the next mdidleware, otherwise it will be the route funtion)
    // if the authorization is set
    if (req.headers.authorization) {
        const headers = req.headers.authorization;
        const token = headers.split(" ")[1];

        // if the token exists, then we need to check whether it's valid
        jwt.verify(token, TOKEN_SECRET, function (err, tokenData) {
            // err => if is not null, it means there has been an error
            // tokenData => is the data inside the json web token
            if (err) {
                res.status(403);
                res.json({
                    'error': "Your access token is invalid"
                })
                return;
            }

            // if no error, then this means the user is legit
            // store the user in the request
            req.user = tokenData;

            // FROM THIS POINT ONWARD THE USER IS AUTHORIZED
            next();

        })

    } else {
        res.status(403);
        res.json({
            'error': "You must provide an access token to access this route"
        })
    }
}

async function main() {
    const db = await mongoUtil.connect(MONGO_URI, DB_NAME);

    // 3. define some routes
    app.get('/', function (req, res) {
        res.json({
            'message': 'I love candies and cupcakes'
        });
    })

    // to do a search, the client will the search criteria via the query strings
    app.get('/reviews', async function (req, res) {

        // create a try/catch block to handle exceptions (exceptions are errors that can crash nodejs)
        try {
            let criteria = {};  // empty criteria object means no criteria (ie. mean documents will be shortlisted)

            // if the query string contains the 'title' key, search for title (ie. if the client indicates for the search for title)
            if (req.query.title) {
                // if req.query.title contains any values besides null, undefined, "", 0 etc etc.
                // then we add it to the criteria
                criteria.title = {
                    '$regex': req.query.title,  // match by pattern
                    '$options': 'i'
                }
            }

            // if the query string contains the `min_rating` key, then only include reviews which food rating is greater than `min_rating` value
            // (i.e if the client provides a min_rating, then only shortlist food which rating is better than that)
            if (req.query.min_rating) {
                criteria.rating = {
                    '$gte': parseInt(req.query.min_rating) // must convert to int first because whatever is from query string is a string
                }
            }
            const reviews = await db.collection('reviews').find(criteria, {
                // exclude comments from the query because there could be a lot of comments
                'projection': {
                    '_id': 1,
                    'food': 1,
                    'title': 1,
                    'content': 1,
                    'rating': 1
                }
            }).toArray();
            res.json(reviews);  // res.json will automatically convert a JavaScript array or object into JSON
        } catch (e) {
            console.log(e);
            res.status(500); // HTTP code 500 => internal server error
            res.json({
                'error': "Internal server error"  // the variable e will contain the error message
            })
        }

    })

    // route to add a document to the database
    // we use the POST method because we are adding to the database
    // by the RESTFUL convention (i.e standards), when a route is
    // to add a new document to a database, we use the POST method
    app.post('/reviews', async function (req, res) {
        const results = await db.collection('reviews').insertOne({
            "title": req.body.title,
            "food": req.body.food,
            "content": req.body.content,
            "rating": req.body.rating
        })
        // send a JSON message 
        // we must send back a JSON message or else the web browser (i.e the client)
        // will be waiting for a response until it times out.
        res.json({
            'message': 'New review created successfully',
            'results': results
        })
    })

    // PUT means update by REPLACING a document with a new one.
    // BUT the new document has the same _id as the original one.
    app.put('/reviews/:reviewId', async function (req, res) {

        // fetch the original document first
        const review = await db.collection('reviews').findOne({
            '_id': ObjectId(req.params.reviewId)
        })

        const results = await db.collection('reviews').updateOne({
            '_id': ObjectId(req.params.reviewId)
        }, {
            "$set": {
                'title': req.body.title ? req.body.title : review.title,  // review is the original document
                'food': req.body.food ? req.body.food : review.food,
                'content': req.body.content ? req.body.content : review.content,
                'rating': req.body.rating ? req.body.rating : review.rating
            }
        })

        res.json({
            'message': 'Review udpated successfully',
            'results': results
        })

    })

    app.delete('/reviews/:reviewId', async function (req, res) {
        await db.collection('reviews').deleteOne({
            '_id': ObjectId(req.params.reviewId)
        })
        res.json({
            'message': "Review deleted successfully"
        })
    })

    // we use app.post() to add an embedded document because
    // we ultimately we creating something NEW (a new comment, in this instance)
    app.post('/reviews/:reviewId/comments', async function (req, res) {
        // we are going to assume that req.body contains the
        // two fields below:
        // - content => content of the comment
        // - nickname => the nickname of the commentor

        // to add in the new embedded document to the food review
        // we must UPDATE the food review
        const results = await db.collection('reviews').updateOne({
            _id: ObjectId(req.params.reviewId)
        }, {
            '$push': {
                'comments': {
                    '_id': ObjectId(),  // if we ObjectId() without any argument, Mongo will create one for us
                    'content': req.body.content,
                    'nickname': req.body.nickname
                }
            }
        })

        res.json({
            'message': 'Comment has been added successfully',
            'results': results
        })

    })

    // get the information for one review (including its comments)
    app.get('/reviews/:reviewId', async function (req, res) {
        const review = await db.collection('reviews').findOne({
            _id: ObjectId(req.params.reviewId)
        });
        res.json(review);
    })

    app.put('/comments/:commentId', async function (req, res) {
        // find the review which comments array have a comment with the
        // id specified in req.params.commentId
        const results = await db.collection('reviews').updateOne({
            'comments._id': ObjectId(req.params.commentId)
        }, {
            '$set': {
                'comments.$.content': req.body.content,
                'comments.$.nickname': req.body.nickname
            }
        })
        res.json({
            'message': 'Comment updated',
            'results': results
        })

    })

    app.delete("/comments/:commentId", async function (req, res) {
        const results = await db.collection('reviews').updateOne({
            'comments._id': ObjectId(req.params.commentId)
        }, {
            '$pull': {
                'comments': {
                    '_id': ObjectId(req.params.commentId)
                }
            }
        })
        res.json({
            'message': 'Comment deleted',
            'results': results
        })
    })

    // POST /users => since POST means create the URL gives the idea of creating a new user
    app.post('/users', async function (req, res) {
        // no need the create the `users` collection beforehand, as we try to insert a document into an
        // non-existent collection, Mongodb will create the collection for us
        const results = await db.collection('users').insertOne({
            "email": req.body.email,
            "password": req.body.password
        });

        res.json({
            'message': 'User has been created',
            'results': results
        })
    })

    app.post('/login', async function (req, res) {
        // we will assume that the client will send in a request that has req.body.email and req.body.password
        // check if the user with the given email and password combination exists 
        const user = await db.collection('users').findOne({
            'email': req.body.email,
            'password': req.body.password
        });
        // check if the user is found
        // because db.collection().findOne will return null if there is no results
        // so if the user variable is not null, it means there is a valid user found
        if (user) {
            // generate the access token
            let token = generateAccessToken(user._id, user.email);
            res.json({
                'accessToken': token
            })
        } else {
            res.status(401);
            res.json({
                'message': 'Invalid email or password'
            })
        }
    })

    // get the profile of the user
    app.get('/user/:userId', [checkIfAuthenticatedJWT], async function (req, res) {


        // FROM THIS POINT ONWARD THE USER IS AUTHORIZED
        res.json({
            'email': req.user.email,
            'id': req.user.id,
            'message': 'You are viewing your profile'
        })



    })
}

main();


// 4. start the server
app.listen(3000, function () {
    console.log("server has started")
})