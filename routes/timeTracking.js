const express = require('express');
const TimeEntry = require('../models/timeEntry');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', authMiddleware(['admin', 'rh', 'employee']), async (req, res) => {
  const { type, timestamp } = req.body;
  
  try {
    // Get employee ID from the JWT token
    const userId = req.employee?._id || req.employee?.id;

    // Input validation
    if (!type || !['in', 'out'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type. Must be "in" or "out"' });
    }

    if (!timestamp || isNaN(new Date(timestamp).getTime())) {
      return res.status(400).json({ message: 'Invalid timestamp' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in token' });
    }

    // Create and save time entry using userId instead of employee
    const timeEntry = new TimeEntry({
      userId: userId,
      type,
      timestamp: new Date(timestamp)
    });

    const savedEntry = await timeEntry.save();
    
    logger.info('Time entry created successfully', {
      entryId: savedEntry._id,
      userId: userId,
      type: savedEntry.type,
      timestamp: savedEntry.timestamp
    });
    
    return res.status(201).json({ 
      message: 'Time entry recorded successfully',
      entry: savedEntry
    });

  } catch (error) {
    logger.error('Error creating time entry', {
      error: error,
      stack: error.stack,
      employeeId: req.employee?._id || req.employee?.id,
      requestBody: req.body
    });

    return res.status(500).json({ 
      message: 'Error creating time entry: ' + error.message
    });
  }
});

router.get('/', authMiddleware(['admin', 'rh', 'employee']), async (req, res) => {
  const { month, year, userId } = req.query;
  
  logger.info('Fetching time entries', {
    requestedBy: req.employee?._id || req.employee?.id,
    filters: { month, year, userId }
  });

  try {
    let query = {};

    // Use userId from authenticated user if they're an employee
    if (req.employee.role === 'employee') {
      query.userId = req.employee?._id || req.employee?.id;
    } else if (userId) {
      query.userId = userId;
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.timestamp = { $gte: startDate, $lte: endDate };
    }

    const timeEntries = await TimeEntry.find(query)
      .sort({ timestamp: -1 })
      .populate('userId', 'name email');

    logger.info('Time entries fetched successfully', {
      count: timeEntries.length
    });

    res.json(timeEntries);
  } catch (error) {
    logger.error('Error fetching time entries', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;