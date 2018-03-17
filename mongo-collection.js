/**
 * This is a mongo-collection module, which exports MongoCollection Class for
 * handling operations over MongoDB (insert, update, find,..) and sends the
 * result over http reponse.
 * @author Aya ElAttar <ayamahmoud1193@gmail.com>
 */

/* global require */
const mongo = require('mongodb').MongoClient;

const sendInternalError = function send500(httpRes) {
  httpRes.writeHead(500);
  httpRes.end();
};

const sendNotFound = function send404(httpRes) {
  httpRes.writeHead(404);
  httpRes.end();
};

/** Class representing a Mongo collection. */
/* global module */
module.exports = class MongoCollection {
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
        } else if (result.length === 0) {
          sendNotFound(httpRes);
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
};
