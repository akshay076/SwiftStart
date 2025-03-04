// app.js
const express = require('express');
const bodyParser = require('body-parser');
const slackRoutes = require('./routes/slack');

// Create Express app
const app = express();

// Middleware to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root route to verify the server is running
app.get('/', (req, res) => {
  res.send('Onboarding Buddy server is running!');
});

// Mount Slack routes
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