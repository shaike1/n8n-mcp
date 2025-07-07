const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// For MVP: hardcoded user
const USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
];

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

module.exports = router; 