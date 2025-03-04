// middleware/slackVerification.js
const crypto = require('crypto');
const config = require('../config');

/**
 * Middleware to capture the raw body for verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {function} next - Express next function
 */
function captureRawBody(req, res, next) {
  // For URL verification challenge, we need the raw body
  let data = '';
  
  req.on('data', chunk => {
    data += chunk.toString();
  });
  
  req.on('end', () => {
    req.rawBody = data;
    
    // If this is a Slack challenge request, we need to parse it here
    if (req.headers['content-type'] === 'application/json') {
      try {
        const jsonData = JSON.parse(data);
        if (jsonData && jsonData.type === 'url_verification') {
          req.body = jsonData;
        }
      } catch (error) {
        // Not JSON or failed to parse, that's okay
      }
    }
    
    next();
  });
}

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
    // Special case for Slack URL verification challenge
    if (req.body && req.body.type === 'url_verification') {
      console.log('Handling Slack URL verification challenge');
      return res.status(200).json({ challenge: req.body.challenge });
    }
    
    const slackSignature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    
    // If missing headers, fail verification
    if (!slackSignature || !timestamp) {
      console.error('Missing Slack verification headers');
      return res.status(400).send('Slack request verification failed: missing headers');
    }
    
    // Verify the request is not too old (helps prevent replay attacks)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 300) {
      return res.status(400).send('Slack request verification failed: timestamp too old');
    }
    
    // Create the signature base string
    const sigBaseString = `v0:${timestamp}:${req.rawBody}`;
    
    // Create the signature to compare
    const mySignature = 'v0=' + crypto
      .createHmac('sha256', config.slack.signingSecret)
      .update(sigBaseString)
      .digest('hex');
    
    // Compare the signatures
    // Use a safe-time constant comparison
    if (crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8')
    )) {
      return next();
    } else {
      console.error('Signatures do not match');
      console.error('My signature:', mySignature);
      console.error('Slack signature:', slackSignature);
      return res.status(400).send('Slack request verification failed: invalid signature');
    }
  } catch (error) {
    console.error('Slack verification error:', error);
    return res.status(400).send('Slack request verification failed: ' + error.message);
  }
}

module.exports = {
  verifySlackRequest,
  captureRawBody
};