// server.js
const app = require('./app');
const config = require('./config');
const langflowService = require('./services/langflow');

// Start the server
const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

// Optional: Test Langflow connection on startup
if (process.env.TEST_LANGFLOW_ON_STARTUP === 'true') {
  langflowService.testLangflowConnection()
    .then(response => {
      console.log('✅ Langflow connection test successful');
    })
    .catch(error => {
      console.error('❌ Langflow connection test failed:', error.message);
    });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Prevent crash on unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the application, just log
});