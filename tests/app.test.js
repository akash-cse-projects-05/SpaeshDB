const request = require('supertest');
const mongoose = require('mongoose');

// Mock Article Model
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
  function MockUser(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  }
  MockUser.countDocuments = jest.fn().mockResolvedValue(1);
  MockUser.findOne = jest.fn().mockResolvedValue({ email: 'admin@sparsh.org', save: jest.fn().mockResolvedValue(true) });
  return MockUser;
});

// Mock mongoose connection
jest.spyOn(mongoose, 'connect').mockResolvedValue({
  connection: { host: 'mocked-mongodb' }
});

const app = require('../src/app');

describe('Sparsh Touch of Care - Public & Secure Route Integrations', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch (_) {}
  });

  describe('Static & Information Pages', () => {
    it('should load the home landing page successfully', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Sparsh');
      expect(res.text).toContain('Emergency Care');
    });

    it('should load the PEP & PrEP educational guides', async () => {
      const res = await request(app).get('/learn');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Post-Exposure Prophylaxis');
      expect(res.text).toContain('Pre-Exposure Prophylaxis');
    });

    it('should load the FAQ page', async () => {
      const res = await request(app).get('/faq');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Frequently Asked Questions');
      expect(res.text).toContain('anonymity');
    });

    it('should load the educational blog index page', async () => {
      const res = await request(app).get('/blog');
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('Resource &amp; Medical Blog');
    });
  });

  describe('Route Security & Authorization Checks', () => {
    it('should block unauthenticated access to the patient dashboard and redirect to login', async () => {
      const res = await request(app).get('/patient/dashboard');
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
    });

    it('should block unauthenticated access to the doctor portal and redirect to login', async () => {
      const res = await request(app).get('/doctor/dashboard');
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
    });

    it('should block unauthenticated access to the admin dashboard and redirect to login', async () => {
      const res = await request(app).get('/admin/dashboard');
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
    });
  });
});
