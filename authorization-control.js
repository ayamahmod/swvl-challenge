var express = require('express')
var bodyparser = require('body-parser')
var mongo = require('mongodb').MongoClient
var ObjectID = require('mongodb').ObjectID
var dbUrl = 'mongodb://localhost:27017/swvldb'
var app = express()

app.use(bodyparser.json())
app.use(bodyparser.urlencoded({extended: false}))

function Database (url, collectionName) {
  this.url = url
  this.collectionName = collectionName
}

Database.prototype.insert = function (doc, httpRes) {
  mongo.connect(this.url, (err, client) => {
    if (err) {
      sendInternalError(httpRes)
      throw err
    }
    var docs = client.db('swvldb').collection(this.collectionName)
    docs.insert(doc, (err, result) => {
      if (err) {
        sendInternalError(httpRes)
        throw err
      } else {
        httpRes.writeHead(200, {'Content-Type': 'application/json'})
        httpRes.end(JSON.stringify(result['ops'][0]))
      }
      client.close()
    })
  })
}

Database.prototype.find = function (query, project, httpRes, callback) {
  mongo.connect(this.url, (err, client) => {
    if (err) {
      sendInternalError(httpRes)
      throw err
    }
    var docs = client.db('swvldb').collection(this.collectionName)
    docs.find(query).project(project).toArray((err, result) => {
      if (err) {
        sendInternalError(httpRes)
        throw err
      } else {
        callback(result, httpRes, arguments[4])
      }
      client.close()
    })
  })
}

Database.prototype.update = function (query, update, httpRes) {
  mongo.connect(this.url, (err, client) => {
    if (err) {
      sendInternalError(httpRes)
      throw err
    }
    var docs = client.db('swvldb').collection(this.collectionName)
    docs.updateOne(query, update, (err, result) => {
      if (err) {
        sendInternalError(httpRes)
        throw err
      } else {
        if (result['result']['n'] === 0) { // # Matched docs === 0
          sendNotFound(httpRes)
        } else {
          httpRes.writeHead(204)
          httpRes.end()
        }
      }
      client.close()
    })
  })
}

var resources = new Database(dbUrl, 'resources')
var groups = new Database(dbUrl, 'groups')

function sendOneObj (result, httpRes) {
  httpRes.writeHead(200, {'Content-Type': 'application/json'})
  httpRes.end(JSON.stringify(result[0]))
}

function sendAllObj (result, httpRes) {
  httpRes.writeHead(200, {'Content-Type': 'application/json'})
  httpRes.end(JSON.stringify({
    'count': result.length,
    'items': result
  }))
}

function sendUserIds (result, httpRes) {
  httpRes.writeHead(200, {'Content-Type': 'application/json'})
  httpRes.end(JSON.stringify({
    'count': result[0]['userIds'].length,
    'items': result[0]['userIds']
  }))
}

function getRsourceNames (result, httpRes) {
  var resourceIds = []
  result[0]['resourceIds'].forEach((obj) => {
    resourceIds.push(new ObjectID(obj.resourceId))
  })
  var query = { '_id': { $in: resourceIds } }
  resources.find(query, {}, httpRes, sendAllObj)
}

function isAuthorized (result, httpRes, userId) {
  if (result.length === 0) {
    sendNotFound(httpRes)
  } else {
    var query = { $and: [{ 'userIds': { $in: [{ 'userId': userId }] } },
      { 'resourceIds': { $in: [{ 'resourceId': result[0]['_id'].toString() }] } }] }
    var fields = {'_id': 1}
    groups.find(query, fields, httpRes, sendAuth)
  }
}

function sendAuth (result, httpRes) {
  if (result.length > 0) {
    httpRes.writeHead(200, {'Content-Type': 'application/json'})
    httpRes.end(JSON.stringify({ 'authorized': true }))
  } else {
    httpRes.writeHead(403, {'Content-Type': 'application/json'})
    httpRes.end(JSON.stringify({ 'authorized': false }))
  }
}

function sendInternalError (httpRes) {
  httpRes.writeHead(500)
  httpRes.end()
}

function sendNotFound (httpRes) {
  httpRes.writeHead(404)
  httpRes.end()
}

function sendBadReq (httpRes) {
  httpRes.sendStatus(400)
  httpRes.end()
}

// POST /resource
app.post('/resource', (req, res) => {
  if (req.body.hasOwnProperty('name')) {
    resources.insert({ name: req.body.name }, res)
  } else {
    sendBadReq(res)
  }
})

// GET /resource/:id
app.get('/resource/:id', (req, res) => {
  resources.find({ '_id': new ObjectID(req.params.id) }, {}, res, sendOneObj)
})

// GET /resource
app.get('/resource/', (req, res) => {
  resources.find({}, {}, res, sendAllObj)
})

// POST /group
app.post('/group', (req, res) => {
  if (req.body.hasOwnProperty('name')) {
    var group = { name: req.body.name }
    if (req.body.hasOwnProperty('description')) {
      group.description = req.body.description
    }
    groups.insert(group, res)
  } else {
    sendBadReq(res)
  }
})

// GET /group/:id
app.get('/group/:id', (req, res) => {
  var query = { '_id': new ObjectID(req.params.id) }
  var fields = {'name': 1, 'description': 1}
  groups.find(query, fields, res, sendOneObj)
})

// GET /group
app.get('/group/', (req, res) => {
  groups.find({}, {'name': 1, 'description': 1}, res, sendAllObj)
})

// POST /group/:id/user
app.post('/group/:id/user', (req, res) => {
  var query = { '_id': new ObjectID(req.params.id) }
  var update = { $addToSet: { userIds: { $each: req.body } } }
  groups.update(query, update, res)
})

// GET /group/:id/user
app.get('/group/:id/user', (req, res) => {
  var query = {'_id': new ObjectID(req.params.id)}
  var fields = {'userIds': 1, '_id': 0}
  groups.find(query, fields, res, sendUserIds)
})

// POST /group/:id/authorize
app.post('/group/:id/authorize', (req, res) => {
  var query = {'_id': new ObjectID(req.params.id)}
  var update = { $addToSet: { resourceIds: { $each: req.body } } }
  groups.update(query, update, res)
})

// GET /group/:id/resource
app.get('/group/:id/resource', (req, res) => {
  var query = {'_id': new ObjectID(req.params.id)}
  var fields = {'resourceIds': 1, '_id': 0}
  groups.find(query, fields, res, getRsourceNames)
})

// GET /authorized?userId=&resourceName=
app.get('/authorized', (req, res) => {
  if (req.query.hasOwnProperty('userId') &&
    req.query.hasOwnProperty('resourceName')) {
    resources.find({ 'name': req.query.resourceName }, {}, res, isAuthorized,
      req.query.userId)
  } else {
    sendBadReq(res)
  }
})

app.listen(process.argv[2])
