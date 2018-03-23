/**
 * This is an implementation for an authorization microservice
 */
/* global require */
const express = require('express');
const bodyparser = require('body-parser');
const ObjectID = require('mongodb').ObjectID;
const MongoCollection = require('./mongo-collection');
const dbUrl = `mongodb://localhost:${process.env.MONGO_PORT}/${process.env.DB_NAME}`;
const hasProp = Object.prototype.hasOwnProperty;
const app = express();

const resources = new MongoCollection(dbUrl, 'resources');
const groups = new MongoCollection(dbUrl, 'groups');

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended: false}));
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
app.use((err, req, res, next) => { //for error handling
  console.log(req);
  console.log(err.stack);
  res.status(500).end('Something broke!');
});
/* eslint-enable no-console */
/* eslint-enable no-unused-vars */

const sendBadReq = function send400(httpRes) {
  httpRes.sendStatus(400);
  httpRes.end();
};

const sendNotFound = function send404(httpRes) {
  httpRes.writeHead(404);
  httpRes.end();
};

const sendOneObj = function writeOneObj(result, httpRes) {
  if(result && result.length !== 0) {
    httpRes.writeHead(200, {'Content-Type': 'application/json'});
    httpRes.end(JSON.stringify(result[0]));
  } else {
    sendNotFound(httpRes);
  }
};

const sendAllObj = function writeAllObj(result, httpRes) {
  if(result) {
    httpRes.writeHead(200, {'Content-Type': 'application/json'});
    httpRes.end(JSON.stringify({
      count: result.length,
      items: result
    }));
  } else {
    sendNotFound(httpRes);
  }
};

const sendUserIds = function writeUserIds(result, httpRes) {
  if(result && result.length !== 0) {
    httpRes.writeHead(200, {'Content-Type': 'application/json'});
    httpRes.end(JSON.stringify({
      count: result[0].userIds.length,
      items: result[0].userIds
    }));
  } else if(result.length === 0) {
    sendAllObj(result, httpRes);
  } else {
    sendNotFound(httpRes);
  }
};

const getRsourceNames = function qResourceNames(result, httpRes) {
  if(result && result.length !== 0) {
    const resourceIds = result[0].resourceIds.map(
      obj => new ObjectID(obj.resourceId));
    let query = { _id: { $in: resourceIds } };
    resources.find(query, {}, httpRes).then((result) => {
      sendAllObj(result, httpRes);});
  } else if(result.length === 0) {
    sendAllObj(result, httpRes);
  } else {
    sendNotFound(httpRes);
  }
};

const isAuthorized = function qAuthorization(result, httpRes, qUserId) {
  if (result.length > 0) {
    let query = { $and: [{ userIds: { $in: [{ userId: qUserId }] } },
      { resourceIds: { $in: [{ resourceId: result[0]['_id'].toString() }] } }] };
    let fields = {_id: 1};
    groups.find(query, fields, httpRes).then((result) => {
      sendAuth(result, httpRes);
    });
  } else {
    sendAuth(result, httpRes);
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
  if(ObjectID.isValid(req.params.id)) {
    resources.find({ _id: new ObjectID(req.params.id) }, {}, res).then((result) => {
      sendOneObj(result, res);
    });
  } else {
    sendBadReq(res);
  }
}));

// GET /resource
app.get('/resource/', ((req, res) => {
  resources.find({}, {}, res).then((result) => {
    sendAllObj(result, res);});
}));

// POST /group
app.post('/group', ((req, res) => {
  if (hasProp.call(req.body, 'name')) {
    let group = { name: req.body.name };
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
  if(ObjectID.isValid(req.params.id)){
    let query = { _id: new ObjectID(req.params.id) };
    let fields = { name: 1, description: 1 };
    groups.find(query, fields, res).then((result) => {
      sendOneObj(result, res);});
  } else {
    sendBadReq(res);
  }
}));

// GET /group
app.get('/group/', ((req, res) => {
  groups.find({}, { name: 1, description: 1 }, res).then((result) => {
    sendAllObj(result, res);});
}));

// POST /group/:id/user
app.post('/group/:id/user', ((req, res) => {
  if(ObjectID.isValid(req.params.id)) {
    let query = { _id: new ObjectID(req.params.id) };
    let validUserIds = [];
    req.body.forEach(function(userObj) {
      if(ObjectID.isValid(userObj.userId))
        validUserIds.push(userObj);
    });
    if(validUserIds.length == 0) {
      sendBadReq(res);
    } else {
      let update = { $addToSet: { userIds: { $each: validUserIds } } };
      groups.update(query, update, res);
    }
  } else {
    sendBadReq(res);
  }
}));

// GET /group/:id/user
app.get('/group/:id/user', ((req, res) => {
  if(ObjectID.isValid(req.params.id)) {
    let query = { _id: new ObjectID(req.params.id) };
    let fields = { userIds: 1, _id: 0 };
    groups.find(query, fields, res).then((result) => {
      sendUserIds(result, res);});
  } else {
    sendBadReq(res);
  }
}));

// POST /group/:id/authorize
app.post('/group/:id/authorize', ((req, res) => {
  if(ObjectID.isValid(req.params.id)) {
    let query = { _id: new ObjectID(req.params.id)};
    let update = { $addToSet: { resourceIds: { $each: req.body } } };
    groups.update(query, update, res);
  } else {
    sendBadReq(res);
  }
}));

// GET /group/:id/resource
app.get('/group/:id/resource', ((req, res) => {
  if(ObjectID.isValid(req.params.id)) {
    let query = { _id: new ObjectID(req.params.id) };
    let fields = { resourceIds: 1, _id: 0 };
    groups.find(query, fields, res).then((result) => {
      getRsourceNames(result, res);});
  } else {
    sendBadReq(res);
  }
}));

// GET /authorized?userId=&resourceName=
app.get('/authorized', ((req, res) => {
  if (hasProp.call(req.query, 'userId') &&
    hasProp.call(req.query, 'resourceName') &&
    ObjectID.isValid(req.query.userId)) {
    resources.find({ name: req.query.resourceName }, {}, res).then((result) => {
      isAuthorized(result, res, req.query.userId);
    });
  } else {
    sendBadReq(res);
  }
}));

/* global process */
app.listen(process.env.NODE_PORT);

/* global module */
module.exports = app;
