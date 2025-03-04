// middleware/slackVerification.js
const crypto = require('crypto');
const config = require('../config');

/**
 * Verify that requests are coming from Slack
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
function verifySlackRequest(req, res, next) {
  // Skip verification in development if needed
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_SLACK_VERIFICATION === 'true') {
    return next();
  }
  
  try {
    const slackSignature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    
    // Verify the request is not too old (helps prevent replay attacks)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 300) {
      return res.status(400).send('Slack request verification failed: timestamp too old');
    }
    
    // Create the signature base string
    const sigBaseString = `v0:${timestamp}:${req.rawBody || ''}`;
    
    // Create the signature to compare
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', config.slack.signingSecret)
      .update(sigBaseString)
      .digest('hex');
    
    // Compare the signatures
    if (crypto.timingSafeEqual(
      Buffer.from(mySignature),
      Buffer.from(slackSignature)
    )) {
      return next();
    } else {
      return res.status(400).send('Slack request verification failed');
    }
  } catch (error) {
    console.error('Slack verification error:', error);
    return res.status(400).send('Slack request verification failed');
  }
}

// Middleware to capture the raw body for verification
function captureRawBody(req, res, next) {
  req.rawBody = '';
  
  req.on('data', chunk => {
    req.rawBody += chunk.toString();
  });
  
  req.on('end', () => {
    next();
  });
}

module.exports = {
  verifySlackRequest,
  captureRawBody
};