const jwt = require('jsonwebtoken');
const Employee = require('../models/employee');

module.exports = function(requiredRoles) {
  return async function(req, res, next) {
    const token = req.header('x-auth-token');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const employee = await Employee.findById(decoded.id);

      if (!employee) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      if (requiredRoles && !requiredRoles.includes(employee.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      req.employee = employee;
      next();
    } catch (err) {
      res.status(401).json({ message: 'Token is not valid' });
    }
  };
};