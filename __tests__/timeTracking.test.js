const request = require('supertest');
const express = require('express');

// Mock dependencies before importing the routes
jest.mock('../models/timeEntry');
jest.mock('../middleware/authMiddleware');

const TimeEntry = require('../models/timeEntry');
const authMiddleware = require('../middleware/authMiddleware');
const timeTrackingRoutes = require('../routes/timeTracking');

const app = express();
app.use(express.json());
app.use('/time-tracking', timeTrackingRoutes);

describe('Time Tracking Routes', () => {
  beforeEach(() => {
    authMiddleware.mockImplementation(() => (req, res, next) => next());
  });

  it('should create a time entry successfully', async () => {
    TimeEntry.prototype.save.mockResolvedValue();

    const response = await request(app)
      .post('/time-tracking')
      .send({
        type: 'in',
        timestamp: new Date()
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('message', 'Time entry recorded successfully');
  });

  it('should get time entries', async () => {
    authMiddleware.mockImplementation((roles) => (req, res, next) => {
      req.employee = { id: 'employee123', company: 'company123', role: 'employee' };
      next();
    });

    const mockTimeEntries = [
      { type: 'in', timestamp: new Date() },
      { type: 'out', timestamp: new Date() }
    ];

    TimeEntry.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue(mockTimeEntries)
    });

    const response = await request(app).get('/time-tracking');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(mockTimeEntries);
  });
});