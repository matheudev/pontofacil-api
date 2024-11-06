const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Employee = require('../models/employee');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/login', async (req, res) => {
  logger.info('Login attempt', { email: req.body.email });
  const { email, password } = req.body;

  try {
    const employee = await Employee.findOne({ email });
    if (!employee) {
      logger.warn('Login failed - Invalid email', { email });
      return res.status(400).json({ message: 'Email ou senha inválidos' });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      logger.warn('Login failed - Invalid password', { email });
      return res.status(400).json({ message: 'Email ou senha inválidos' });
    }

    const token = jwt.sign({ id: employee._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    logger.info('Login successful', { email, employeeId: employee._id });
    
    // Send complete user information
    res.json({ 
      token, 
      employeeId: employee._id, 
      role: employee.role,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      position: employee.position
    });
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

module.exports = router;