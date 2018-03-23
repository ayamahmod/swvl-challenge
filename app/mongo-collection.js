/**
 * This is a mongo-collection module, which exports MongoCollection Class for
 * handling operations over MongoDB (insert, update, find,..) and sends the
 * result over http reponse.
 * @author Aya ElAttar <ayamahmoud1193@gmail.com>
 */

/* global require process*/
const mongo = require('mongodb').MongoClient;

const sendInternalError = function send500(httpRes) {
  httpRes.writeHead(500);
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

    mongo.connect(this.url).then((client) => {
      this.docs = client.db(process.env.DB_NAME).collection(collectionName);
    }).catch((err) => {
      throw err;
    });
  }

  /**
     * Inserts a document into the Mongo collection.
     * @param {object} doc - The document to be inserted.
     * @param {object} httpRes - The http response to write over.
     * @TODO - Verify the data before insertion into DB.
     */
  insert(doc, httpRes) {
    this.docs.insert(doc).then((result) => {
      httpRes.writeHead(200, {'Content-Type': 'application/json'});
      httpRes.end(JSON.stringify(result.ops[0]));
    }).catch((err) => {
      sendInternalError(httpRes);
      throw err;
    });
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
  find(query, project, httpRes) {
    return new Promise((resolve, reject) => {
      this.docs.find(query).project(project).toArray().then((result) => {
        resolve(result);
      }).catch((err) => {
        if (err) {
          sendInternalError(httpRes);
          reject(err);
        }
      });
    });
  }
  /**
     * Updates documents into the Mongo collection.
     * @param {object} query - The query object to be run over the collection.
     * @param {object} update - The update query to be applied.
     * @param {object} httpRes - The http response to write over.
     */
  update(query, update, httpRes) {
    this.docs.updateOne(query, update).then((result) => {
      if (result.result.n === 0) { // # Matched docs === 0
        sendNotFound(httpRes);
      } else {
        httpRes.writeHead(204);
        httpRes.end();
      }
    }).catch((err) => {
      if (err) {
        sendInternalError(httpRes);
        throw err;
      }
    });
  }
};
