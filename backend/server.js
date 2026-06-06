const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const houseRoutes = require('./routes/houses');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('错误堆栈:', err.stack);
  console.error('错误详情:', err);
  res.status(500).json({ error: '服务器内部错误', message: err.message, stack: err.stack });
});

async function startServer() {
  await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`城市更新居民签约系统后端服务已启动: http://localhost:${PORT}`);
    console.log(`默认账号: resident1/evaluator1/handler1/legal1, 密码: 123456`);
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
