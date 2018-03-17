/**
 * This is an implementation for an authorization microservice
 */
/* global require */
const express = require('express');
const bodyparser = require('body-parser');
const mongo = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const dbUrl = 'mongodb://localhost:27017/swvldb';
const hasProp = Object.prototype.hasOwnProperty;
const app = express();

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended: false}));

/** Class representing a Mongo collection. */
class MongoCollection {
  /**
     * Creates a Mongo collection.
     * @param {string} url - The url of the Mongo database.
     * @param {string} collectionName - The name of the collection to work on.
     */
  constructor(url, collectionName) {
    /** @member {string} */
    this.url = url;

    /** @member {string} */
    this.collectionName = collectionName;
  }

  /**
     * Inserts a document into the Mongo collection.
     * @param {object} doc - The document to be inserted.
     * @param {object} httpRes - The http response to write over.
     */
  insert(doc, httpRes) {
    mongo.connect(this.url, ((err, client) => {
      if (err) {
        sendInternalError(httpRes);
        throw err;
      }
      let docs = client.db('swvldb').collection(this.collectionName);
      docs.insert(doc, ((err, result) => {
        if (err) {
          sendInternalError(httpRes);
          throw err;
        } else {
          httpRes.writeHead(200, {'Content-Type': 'application/json'});
          httpRes.end(JSON.stringify(result.ops[0]));
        }
        client.close();
      }));
    }));
  }

  /**
     * Finds documents into the Mongo collection.
     * @param {object} query - The query object to be run over the collection.
     * @param {object} project - The projection object to get specific fields.
     * @param {object} httpRes - The http response to write over.
     * @param {function} callback - The callback function to call with the find
      results, and any additional args.
     * @param {string} args - Additional argument to pass to the @param callback.
     */
  find(query, project, httpRes, callback, args = null) {
    mongo.connect(this.url, ((err, client) => {
      if (err) {
        sendInternalError(httpRes);
        throw err;
      }
      let docs = client.db('swvldb').collection(this.collectionName);
      docs.find(query).project(project).toArray((err, result) => {
        if (err) {
          sendInternalError(httpRes);
          throw err;
        } else {
          callback(result, httpRes, args);
        }
        client.close();
      });
    }));
  }

  /**
     * Updates documents into the Mongo collection.
     * @param {object} query - The query object to be run over the collection.
     * @param {object} update - The update query to be applied.
     * @param {object} httpRes - The http response to write over.
     */
  update(query, update, httpRes) {
    mongo.connect(this.url, ((err, client) => {
      if (err) {
        sendInternalError(httpRes);
        throw err;
      }
      let docs = client.db('swvldb').collection(this.collectionName);
      docs.updateOne(query, update, ((err, result) => {
        if (err) {
          sendInternalError(httpRes);
          throw err;
        } else {
          if (result.result.n === 0) { // # Matched docs === 0
            sendNotFound(httpRes);
          } else {
            httpRes.writeHead(204);
            httpRes.end();
          }
        }
        client.close();
      }));
    }));
  }
}

const resources = new MongoCollection(dbUrl, 'resources');
const groups = new MongoCollection(dbUrl, 'groups');

const sendOneObj = function writeOneObj(result, httpRes) {
  httpRes.writeHead(200, {'Content-Type': 'application/json'});
  httpRes.end(JSON.stringify(result[0]));
};

const sendAllObj = function writeAllObj(result, httpRes) {
  httpRes.writeHead(200, {'Content-Type': 'application/json'});
  httpRes.end(JSON.stringify({
    count: result.length,
    items: result
  }));
};

const sendUserIds = function writeUserIds(result, httpRes) {
  httpRes.writeHead(200, {'Content-Type': 'application/json'});
  httpRes.end(JSON.stringify({
    count: result[0].userIds.length,
    items: result[0].userIds
  }));
};

const getRsourceNames = function qResourceNames(result, httpRes) {
  const resourceIds = result[0].resourceIds.map(
    obj => new ObjectID(obj.resourceId));
  let query = { _id: { $in: resourceIds } };
  resources.find(query, {}, httpRes, sendAllObj);
};

const isAuthorized = function qAuthorization(result, httpRes, qUserId) {
  if (result.length === 0) {
    sendNotFound(httpRes);
  } else {
    let query = { $and: [{ userIds: { $in: [{ userId: qUserId }] } },
      { resourceIds: { $in: [{ resourceId: result[0]['_id'].toString() }] } }] };
    let fields = {_id: 1};
    groups.find(query, fields, httpRes, sendAuth);
  }
};

const sendAuth = function writeAuth(result, httpRes) {
  if (result.length > 0) {
    httpRes.writeHead(200, {'Content-Type': 'application/json'});
    httpRes.end(JSON.stringify({ authorized: true }));
  } else {
    httpRes.writeHead(403, {'Content-Type': 'application/json'});
    httpRes.end(JSON.stringify({ authorized: false }));
  }
};

const sendInternalError = function send500(httpRes) {
  httpRes.writeHead(500);
  httpRes.end();
};

const sendNotFound = function send404(httpRes) {
  httpRes.writeHead(404);
  httpRes.end();
};

const sendBadReq = function send400(httpRes) {
  httpRes.sendStatus(400);
  httpRes.end();
};

// POST /resource
app.post('/resource', ((req, res) => {
  if (hasProp.call(req.body, 'name')) {
    resources.insert({ name: req.body.name }, res);
  } else {
    sendBadReq(res);
  }
}));

// GET /resource/:id
app.get('/resource/:id', ((req, res) => {
  resources.find({ _id: new ObjectID(req.params.id) }, {}, res, sendOneObj);
}));

// GET /resource
app.get('/resource/', ((req, res) => {
  resources.find({}, {}, res, sendAllObj);
}));

// POST /group
app.post('/group', ((req, res) => {
  if (hasProp.call(req.body, 'name')) {
    var group = { name: req.body.name };
    if (hasProp.call(req.body, 'description')) {
      group.description = req.body.description;
    }
    groups.insert(group, res);
  } else {
    sendBadReq(res);
  }
}));

// GET /group/:id
app.get('/group/:id', ((req, res) => {
  let query = { _id: new ObjectID(req.params.id) };
  let fields = { name: 1, description: 1 };
  groups.find(query, fields, res, sendOneObj);
}));

// GET /group
app.get('/group/', ((req, res) => {
  groups.find({}, { name: 1, description: 1 }, res, sendAllObj);
}));

// POST /group/:id/user
app.post('/group/:id/user', ((req, res) => {
  let query = { _id: new ObjectID(req.params.id) };
  let update = { $addToSet: { userIds: { $each: req.body } } };
  groups.update(query, update, res);
}));

// GET /group/:id/user
app.get('/group/:id/user', ((req, res) => {
  let query = { _id: new ObjectID(req.params.id) };
  let fields = { userIds: 1, _id: 0 };
  groups.find(query, fields, res, sendUserIds);
}));

// POST /group/:id/authorize
app.post('/group/:id/authorize', ((req, res) => {
  let query = { _id: new ObjectID(req.params.id)};
  let update = { $addToSet: { resourceIds: { $each: req.body } } };
  groups.update(query, update, res);
}));

// GET /group/:id/resource
app.get('/group/:id/resource', ((req, res) => {
  let query = { _id: new ObjectID(req.params.id) };
  let fields = { resourceIds: 1, _id: 0 };
  groups.find(query, fields, res, getRsourceNames);
}));

// GET /authorized?userId=&resourceName=
app.get('/authorized', ((req, res) => {
  if (hasProp.call(req.query, 'userId') &&
    hasProp.call(req.query, 'resourceName')) {
    resources.find({ name: req.query.resourceName }, {}, res, isAuthorized,
      req.query.userId);
  } else {
    sendBadReq(res);
  }
}));

/* global process */
app.listen(process.argv[2]);
