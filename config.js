/* global require */
const dotenv = require('dotenv');
/* global process */
if(process.env.NODE_ENV === 'test')
  dotenv.config({path: './.env.test'});
dotenv.load();
