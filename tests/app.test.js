const mongoose = require('mongoose');
const app = require('../src/app');
const { EventEmitter } = require('events');

jest.mock('../src/models/Article', () => {
  const mockArticles = [
    {
      title: 'Understanding PEP: The 72-Hour Window',
      slug: 'understanding-pep-72-hour-window',
      category: 'PEP',
      author: 'Dr. Sameer Joshi',
      summary: 'Summary details',
      content: '<p>Content details</p>',
      createdAt: new Date()
    }
  ];
  const mockQuery = {
    sort: function() { return this; },
    limit: function() { return Promise.resolve(mockArticles); },
    then: function(resolve) { return Promise.resolve(mockArticles).then(resolve); }
  };
  return {
    countDocuments: jest.fn().mockResolvedValue(1),
    find: jest.fn().mockReturnValue(mockQuery),
    findOne: jest.fn().mockImplementation(({ slug }) => {
      const art = mockArticles.find(a => a.slug === slug);
      return Promise.resolve(art || null);
    })
  };
});

// Mock User Model
jest.mock('../src/models/User', () => {
  return {
    countDocuments: jest.fn().mockResolvedValue(1),
    findOne: jest.fn().mockResolvedValue(null)
  };
});

// Mock mongoose connection
jest.spyOn(mongoose, 'connect').mockResolvedValue({
  connection: { host: 'mocked-mongodb' }
});

const { Readable, Writable } = require('stream');

// Helper to make in-memory Express requests
function makeRequest(method, url) {
  return new Promise((resolve) => {
    const req = new Readable({
      read() {}
    });
    req.method = method;
    req.url = url;
    req.headers = {
      'host': 'localhost'
    };
    req.socket = {
      destroy: () => {},
      _writableState: {}
    };
    req.session = {};
    req.flash = () => [];
    req.user = null; // Default unauthenticated state
    req.push(null); // EOF

    const res = new Writable({
      write(chunk, encoding, callback) {
        this.text = (this.text || '') + chunk.toString();
        callback();
      }
    });
    res.statusCode = 200;
    res.headers = {};
    res.text = '';
    res.locals = {
      currentUser: null,
      csrfToken: 'mock-csrf-token'
    };
    
    // Cross-references
    res.req = req;
    req.res = res;

    res.setHeader = function(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    };
    res.getHeader = function(name) {
      return this.headers[name.toLowerCase()];
    };
    res.removeHeader = function(name) {
      delete this.headers[name.toLowerCase()];
      return this;
    };
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
    res.send = function(body) {
      if (typeof body === 'object') {
        this.setHeader('Content-Type', 'application/json');
        this.write(JSON.stringify(body));
      } else {
        this.write(body);
      }
      this.end();
      return this;
    };
    res.redirect = function(targetUrl) {
      res.statusCode = 302;
      res.setHeader('Location', targetUrl);
      this.end();
      return this;
    };
    res.render = function(view, options, callback) {
      const mergedOptions = Object.assign({
        currentUser: req.user,
        csrfToken: 'mock-csrf-token'
      }, this.locals || {}, options || {});
      app.render(view, mergedOptions, (err, html) => {
        if (err) {
          this.statusCode = 500;
          this.write('Render error: ' + err.message);
          this.end();
        } else {
          this.write(html);
          this.end();
        }
      });
      return this;
    };
    
    res.on('finish', () => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        text: res.text
      });
    });

    app(req, res);
  });
}

describe('Sparsh Touch of Care - Public & Secure Route Integrations (In-Memory)', () => {
  
  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Static & Information Pages', () => {
    it('should load the home landing page successfully', async () => {
      const response = await makeRequest('GET', '/');
      console.log('TEXT IS:', response.text);
      expect(response.statusCode).toBe(200);
      expect(response.text).toContain('Sparsh');
      expect(response.text).toContain('Emergency Care');
    });

    it('should load the PEP & PrEP educational guides', async () => {
      const response = await makeRequest('GET', '/learn');
      expect(response.statusCode).toBe(200);
      expect(response.text).toContain('Post-Exposure Prophylaxis');
      expect(response.text).toContain('Pre-Exposure Prophylaxis');
    });

    it('should load the FAQ page', async () => {
      const response = await makeRequest('GET', '/faq');
      expect(response.statusCode).toBe(200);
      expect(response.text).toContain('Frequently Asked Questions');
      expect(response.text).toContain('anonymity');
    });

    it('should load the educational blog index page', async () => {
      const response = await makeRequest('GET', '/blog');
      expect(response.statusCode).toBe(200);
      expect(response.text).toContain('Resource & Medical Blog');
    });
  });

  describe('Route Security & Authorization Checks', () => {
    it('should block unauthenticated access to the patient dashboard and redirect to login', async () => {
      const response = await makeRequest('GET', '/patient/dashboard');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should block unauthenticated access to the doctor portal and redirect to login', async () => {
      const response = await makeRequest('GET', '/doctor/dashboard');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });

    it('should block unauthenticated access to the admin dashboard and redirect to login', async () => {
      const response = await makeRequest('GET', '/admin/dashboard');
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe('/auth/login');
    });
  });
});
