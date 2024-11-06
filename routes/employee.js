const express = require('express');
const bcrypt = require('bcrypt');
const Employee = require('../models/employee');
const Company = require('../models/company');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Register company and admin
router.post('/register-company', async (req, res) => {
  logger.info('Company registration attempt', { 
    companyName: req.body.companyName,
    adminEmail: req.body.email 
  });

  const { companyName, adminName, email, password } = req.body;

  try {
    let employee = await Employee.findOne({ email });
    if (employee) {
      logger.warn('Company registration failed - Email exists', { email });
      return res.status(400).json({ message: 'Employee already exists' });
    }

    const company = new Company({ name: companyName });

    employee = new Employee({
      name: adminName,
      email,
      password,
      position: 'Admin',
      department: 'Admin',
      role: 'admin',
      company: company._id
    });

    const salt = await bcrypt.genSalt(10);
    employee.password = await bcrypt.hash(password, salt);

    company.admin = employee._id;

    await company.save();
    await employee.save();

    logger.info('Company registration successful', { 
      companyId: company._id,
      adminId: employee._id 
    });

    res.status(201).json({ message: 'Company and admin registered successfully' });
  } catch (error) {
    logger.error('Company registration error', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Register RH or employee
router.post('/register', authMiddleware(['admin', 'rh']), async (req, res) => {
  logger.info('Employee registration attempt', { 
    createdBy: req.employee.id,
    newEmployeeEmail: req.body.email 
  });

  const { name, email, password, position, role, department } = req.body;

  if (role === 'rh' && req.employee.role !== 'admin') {
    logger.warn('Unauthorized RH creation attempt', { 
      attemptedBy: req.employee.id 
    });
    return res.status(403).json({ message: 'Only admin can create RH users' });
  }

  try {
    let employee = await Employee.findOne({ email });
    if (employee) {
      logger.warn('Employee registration failed - Email exists', { email });
      return res.status(400).json({ message: 'Employee already exists' });
    }

    employee = new Employee({
      name,
      email,
      password,
      position,
      department,
      role: role || 'employee',
      company: req.employee.company
    });

    const salt = await bcrypt.genSalt(10);
    employee.password = await bcrypt.hash(password, salt);

    await employee.save();

    logger.info('Employee registration successful', { 
      employeeId: employee._id,
      role: employee.role 
    });

    res.status(201).json({ message: 'Employee registered successfully' });
  } catch (error) {
    logger.error('Employee registration error', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all employees
router.get('/', authMiddleware(['admin', 'rh']), async (req, res) => {
  logger.info('Fetching employees', { requestedBy: req.employee.id });
  
  try {
    const employees = await Employee.find({ company: req.employee.company })
      .select('-password');
    
    logger.info('Employees fetched successfully', { 
      count: employees.length 
    });
    
    res.json(employees);
  } catch (error) {
    logger.error('Error fetching employees', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete employee
router.delete('/:id', authMiddleware(['admin', 'rh']), async (req, res) => {
  logger.info('Employee deletion attempt', { 
    deletedBy: req.employee.id,
    employeeToDelete: req.params.id 
  });

  try {
    // Check if trying to delete themselves
    if (req.employee.id === req.params.id) {
      logger.warn('Self-deletion attempt prevented', { employeeId: req.employee.id });
      return res.status(403).json({ message: 'You cannot delete your own account' });
    }

    // Check if employee exists and belongs to the same company
    const employeeToDelete = await Employee.findOne({ 
      _id: req.params.id,
      company: req.employee.company 
    });

    if (!employeeToDelete) {
      logger.warn('Employee deletion failed - Employee not found', { 
        employeeId: req.params.id 
      });
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Prevent RH from deleting admins
    if (req.employee.role === 'rh' && employeeToDelete.role === 'admin') {
      logger.warn('Unauthorized deletion attempt - RH trying to delete admin', {
        rhId: req.employee.id,
        adminId: employeeToDelete._id
      });
      return res.status(403).json({ message: 'HR cannot delete admin accounts' });
    }

    await Employee.findByIdAndDelete(req.params.id);

    logger.info('Employee deleted successfully', { 
      deletedEmployeeId: req.params.id,
      deletedBy: req.employee.id 
    });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    logger.error('Error deleting employee', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;