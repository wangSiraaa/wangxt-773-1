const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne } = require('../database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
  
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken(user);
  
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    }
  });
});

router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }

  const jwt = require('jsonwebtoken');
  const { SECRET_KEY } = require('../middleware/auth');
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = queryOne('SELECT id, username, role, name FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: '令牌无效' });
  }
});

module.exports = router;
