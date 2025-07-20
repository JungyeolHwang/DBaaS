const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const instanceRoutes = require('./routes/instances');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(helmet());
app.use(cors());
app.use(express.json());

// 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 라우트 설정
app.use('/instances', instanceRoutes);
app.use('/ha-clusters', require('./routes/ha-clusters'));

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 루트 엔드포인트
app.get('/', (req, res) => {
  res.json({
    message: 'Mini DBaaS API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      instances: '/instances',
      haClusters: '/ha-clusters'
    }
  });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Mini DBaaS API Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
}); 