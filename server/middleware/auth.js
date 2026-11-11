const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in to continue.' });

  let id;
  try {
    id = jwt.verify(token, process.env.JWT_SECRET).id;
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please log in again.' });
  }
  const user = await User.findById(id).select('name');
  if (!user) return res.status(401).json({ message: 'Account not found.' });
  req.user = { id: String(user._id), name: user.name };
  next();
};
