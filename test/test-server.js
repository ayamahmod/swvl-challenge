/* global require describe it beforeEach process afterEach*/
/* eslint-disable no-console */
require('../config');
const chai = require('chai');
const chaiHttp = require('chai-http');
const mongo = require('mongodb').MongoClient;
const server = require('../app/authorization-control');
const should = chai.should();
const dbUrl = `mongodb://localhost:${process.env.MONGO_PORT}/${process.env.DB_NAME}`;

chai.use(chaiHttp);

describe('Authorization control microservice', () => {
  let postedRsrc, postedGroup;

  beforeEach((done) => { //Before each test we empty the database
    mongo.connect(dbUrl).then((client) => {
      const dbObj = client.db(process.env.DB_NAME);
      dbObj.collection('resources').remove({});
      dbObj.collection('groups').remove({});
      done();
    }).catch((err) => { done(err); });
  });

  beforeEach((done) => { //Before each test we insert a resource
    mongo.connect(dbUrl).then((client) => {
      const dbObj = client.db(process.env.DB_NAME);
      dbObj.collection('resources')
        .insert({ name: 'rsrc1' }).then((result) => {
          postedRsrc = result.ops[0];
          done();
        }).catch((err) => { done(err); });
    }).catch((err) => { done(err); });
  });

  beforeEach((done) => { //Before each test we insert a group
    mongo.connect(dbUrl).then((client) => {
      const dbObj = client.db(process.env.DB_NAME);
      dbObj.collection('groups')
        .insert({ name: 'group1',
          description: 'This is my first group',
          userIds: [{ userId: '000000000000000000000000' },
            { userId: '111111111111111111111111' }],
          resourceIds: [{ resourceId: String(postedRsrc['_id']) }]
        }).then((result) => {
          postedGroup = result.ops[0];
          done();
        }).catch((err) => { done(err); });
    }).catch((err) => { done(err); });
  });

  it('should add a SINGLE resource on /resource POST', (done) => {
    let resource = {
      name: 'rsrc2'
    };
    chai.request(server)
      .post('/resource')
      .send(resource)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('name').eql(resource.name);
        res.body.should.have.property('_id');
        done();
      });
  });

  it('should return a bad request status on /resource POST', (done) => {
    let resource = {};
    chai.request(server)
      .post('/resource')
      .send(resource)
      .end((err, res) => {
        res.should.have.status(400);
        done();
      });
  });

  it('should get a SINGLE resource on /resource/:id GET', (done) => {
    chai.request(server)
      .get(`/resource/${postedRsrc['_id']}`)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('name').eql(postedRsrc.name);
        res.body.should.have.property('_id').eql(String(postedRsrc['_id']));
        done();
      });
  });

  it('should list ALL resources on /resource GET', (done) => {
    chai.request(server)
      .get('/resource')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('count').eql(1);
        res.body.should.have.property('items');
        res.body.items.should.be.a('array');
        res.body.items.length.should.eql(1);
        done();
      });
  });

  it('should add a SINGLE group with description on /group POST', (done) => {
    let group = {
      name: 'group2',
      description: 'This is the second group'
    };
    chai.request(server)
      .post('/group')
      .send(group)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('name').eql(group.name);
        res.body.should.have.property('description').eql(group.description);
        res.body.should.have.property('_id');
        done();
      });
  });

  it('should add a SINGLE group without description on /group POST', (done) => {
    let group = {
      name: 'group2'
    };
    chai.request(server)
      .post('/group')
      .send(group)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('name').eql(group.name);
        res.body.should.have.property('_id');
        done();
      });
  });

  it('should return a bad request status on /group POST', (done) => {
    let group = { description: 'This is a bad request'};
    chai.request(server)
      .post('/group')
      .send(group)
      .end((err, res) => {
        res.should.have.status(400);
        done();
      });
  });

  it('should get a SINGLE group on /group/:id GET', (done) => {
    chai.request(server)
      .get(`/group/${postedGroup['_id']}`)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('name').eql(postedGroup.name);
        res.body.should.have.property('description').eql(postedGroup.description);
        res.body.should.have.property('_id').eql(String(postedGroup['_id']));
        done();
      });
  });

  it('should return NOT FOUND on /group/:id GET', (done) => {
    chai.request(server)
      .get('/group/000000000000000000000000')
      .end((err, res) => {
        res.should.have.status(404);
        done();
      });
  });

  it('should list ALL groups on /group GET', (done) => {
    chai.request(server)
      .get('/group')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('count').eql(1);
        res.body.should.have.property('items');
        res.body.items.should.be.a('array');
        res.body.items.length.should.eql(1);
        done();
      });
  });

  it('should attach a list of user IDs to a group on /group/:id/user POST', (done) => {
    chai.request(server)
      .post(`/group/${postedGroup['_id']}/user`)
      .send([{ userId: '222222222222222222222222' },
        { userId: '333333333333333333333333' }])
      .end((err, res) => {
        res.should.have.status(204);
        done();
      });
  });

  it('shouldn\'t attach invalid user IDs to a group on /group/:id/user POST', (done) => {
    chai.request(server)
      .post(`/group/${postedGroup['_id']}/user`)
      .send([{ userId: '12345' },
        { userId: '*&90)(%$#@)' }])
      .end((err, res) => {
        res.should.have.status(400);
        done();
      });
  });

  it('should list ALL users on a group on /group/:id/user GET', (done) => {
    chai.request(server)
      .get(`/group/${postedGroup['_id']}/user`)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('count').eql(2);
        res.body.should.have.property('items');
        res.body.items.should.be.a('array');
        res.body.items.length.should.eql(2);
        done();
      });
  });

  it('should attach a SINGLE resource to a group on /group/:id/authorize POST', (done) => {
    chai.request(server)
      .post(`/group/${postedGroup['_id']}/authorize`)
      .send([{ resourceId: postedRsrc['_id'] }])
      .end((err, res) => {
        res.should.have.status(204);
        done();
      });
  });

  it('should list ALL resources on a group on /group/:id/resource GET', (done) => {
    chai.request(server)
      .get(`/group/${postedGroup['_id']}/resource`)
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('count').eql(1);
        res.body.should.have.property('items');
        res.body.items.should.be.a('array');
        res.body.items.length.should.eql(1);
        done();
      });
  });

  it('should lists that a user has access to a resource on /authorized?userId=&resourceName= GET', (done) => {
    chai.request(server)
      .get('/authorized?userId=000000000000000000000000&resourceName=rsrc1')
      .end((err, res) => {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('authorized').eql(true);
        done();
      });
  });

  it('should lists that a user not having access to a resource on /authorized?userId=&resourceName= GET', (done) => {
    chai.request(server)
      .get('/authorized?userId=000000000000000000000000&resourceName=rsrc2')
      .end((err, res) => {
        res.should.have.status(403);
        res.should.be.json;
        res.body.should.be.a('object');
        res.body.should.have.property('authorized').eql(false);
        done();
      });
  });
});
