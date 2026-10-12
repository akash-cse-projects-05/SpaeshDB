const app = require('../src/app');
const { EventEmitter } = require('events');

function makeRequest(method, url) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = {
      'host': 'localhost'
    };
    req.socket = {
      destroy: () => {}
    };
    req.session = {}; // mock session

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.text = '';

    res.setHeader = function(name, value) {
      this.headers[name.toLowerCase()] = value;
    };
    res.getHeader = function(name) {
      return this.headers[name.toLowerCase()];
    };
    res.write = function(chunk) {
      if (chunk) this.text += chunk.toString();
      return true;
    };
    res.end = function(chunk) {
      if (chunk) this.text += chunk.toString();
      resolve({
        statusCode: this.statusCode,
        headers: this.headers,
        text: this.text
      });
    };
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
    res.on('error', (err) => {
      console.error('Response error:', err);
    });

    app(req, res);
  });
}

async function run() {
  console.log('Fetching Home Page...');
  try {
    const res = await makeRequest('GET', '/');
    console.log('Status:', res.statusCode);
    console.log('Contains Sparsh:', res.text.includes('Sparsh'));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
