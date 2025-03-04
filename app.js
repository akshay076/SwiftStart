// app.js
const express = require('express');
const bodyParser = require('body-parser');
const slackRoutes = require('./routes/slack');
const slackVerification = require('./middleware/slackVerification');

// Create Express app
const app = express();

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', Object.keys(req.headers).join(', '));
  
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`Sending response with status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Middleware to parse request bodies
// IMPORTANT: Configure these before any verification middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ 
  extended: true,
  verify: (req, res, buf) => {
    // Store raw body for verification
    req.rawBody = buf.toString();
  }
}));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root route to verify the server is running
app.get('/', (req, res) => {
  res.send('Onboarding Buddy server is running!');
});

// CRITICAL CHANGE: Skip Slack verification for now to eliminate it as a source of problems
// We'll add it back once the basic functionality is working
console.log('WARNING: Slack verification is DISABLED for troubleshooting');

// Mount Slack routes directly without verification
app.use('/slack', slackRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: process.env.NODE_ENV === 'production' ? undefined : err.message 
  });
});

module.exports = app;