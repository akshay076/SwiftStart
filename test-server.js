/*
// minimal-server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config({ path: './variables.env' });

const app = express();

// Log configuration settings
console.log('Configuration loaded:');
console.log('LANGFLOW_URL:', process.env.LANGFLOW_URL || 'Not set');
console.log('LANGFLOW_FLOW_ID:', process.env.LANGFLOW_FLOW_ID ? 'Set (value hidden)' : 'Not set');
console.log('SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'Set (value hidden)' : 'Not set');
console.log('SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? 'Set (value hidden)' : 'Not set');

// Middleware to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', Object.keys(req.headers).join(', '));
  next();
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root route to verify the server is running
app.get('/', (req, res) => {
  res.send('Minimal Onboarding Buddy server is running!');
});

// Handle Slack slash commands - copied directly from your working code
app.post('/slack/commands', async (req, res) => {
  // Log what we received
  console.log('Command received:', JSON.stringify(req.body));
  
  // Extract details from the Slack command
  const { command, text, user_id, channel_id } = req.body;
  
  console.log(`Received command: ${command} with text: ${text}`);
  
  // Process different commands
  if (command === '/askbuddy') {
    console.log('Processing /askbuddy command');
    
    // Send immediate acknowledgment to Slack
    res.status(200).send({
      response_type: 'in_channel',
      text: 'Processing your question...'
    });
    
    try {
      console.log('Sending async message to channel...');
      // Send a direct message via the Slack API (async)
      await sendSlackMessage(channel_id, "I'm working on your question. This might take a moment...");
      
      console.log('Done');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  } 
  else {
    // Unknown command
    console.log('Unknown command, sending simple response');
    res.status(200).send({
      text: "I don't recognize that command. Try /askbuddy."
    });
  }
});

// Function to send a message back to Slack
async function sendSlackMessage(channelId, message) {
  try {
    console.log(`Sending message to Slack channel ${channelId}`);
    
    const response = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channelId,
      text: message
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      console.error('Slack API error:', response.data.error);
    } else {
      console.log('Message sent successfully');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error sending Slack message:', error.message);
    throw error;
  }
}

// Handle Slack events
app.post('/slack/events', (req, res) => {
  console.log('Event received:', req.body);
  
  // Verify Slack challenge for URL verification
  if (req.body.type === 'url_verification') {
    console.log('Handling URL verification challenge');
    return res.status(200).json({ challenge: req.body.challenge });
  }
  
  // Respond immediately to acknowledge receipt of the event
  res.status(200).send();
});

// Define port
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
  console.log(`Minimal server is running on port ${port}`);
  console.log(`Access health check at: http://localhost:${port}/health`);
}); 

// simplified-server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config({ path: './variables.env' });

const app = express();

// Middleware to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', Object.keys(req.headers).join(', '));
  next();
});

// Root route to verify the server is running
app.get('/', (req, res) => {
  res.send('Simplified Onboarding Buddy server is running!');
});

// Handle Slack slash commands - focusing just on /askbuddy
app.post('/slack/commands', async (req, res) => {
  try {
    // Extract details from the Slack command
    const { command, text, user_id, channel_id } = req.body;
    
    console.log(`Received command: ${command} with text: ${text}`);
    
    // Process the askbuddy command
    if (command === '/askbuddy') {
      console.log('Processing /askbuddy command');
      
      // THIS IS CRITICAL: Send immediate acknowledgment to Slack with a visible message
      res.status(200).send({
        response_type: 'in_channel',
        text: `I'm looking up the answer to your question, <@${user_id}>. This might take a moment...`
      });
      
      // Process the query asynchronously
      processAskBuddyCommand(text, channel_id, user_id);
    } else {
      // Unknown command
      res.status(200).send({
        text: "I don't recognize that command. Try /askbuddy."
      });
    }
  } catch (error) {
    console.error('Error handling command:', error);
    res.status(200).send({
      text: "Sorry, I encountered an error processing your command."
    });
  }
});

// Process the askbuddy command asynchronously
async function processAskBuddyCommand(text, channelId, userId) {
  try {
    console.log(`Starting to process askbuddy command: "${text}"`);
    
    // Send a message via the Slack API that we're working on it
    await sendSlackMessage(channelId, `Working on your question...`);
    
    // Get answer from Langflow
    const answer = await queryLangflow(text);
    
    // Send the final response back to Slack
    await sendSlackMessage(channelId, answer);
    
    console.log('Command processing completed successfully');
  } catch (error) {
    console.error('Error processing askbuddy command:', error);
    await sendSlackMessage(channelId, "Sorry, I encountered an error processing your request.");
  }
}

// Query the Langflow API
async function queryLangflow(message) {
  try {
    console.log(`Querying Langflow with: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    const flowId = process.env.LANGFLOW_FLOW_ID;
    const apiToken = process.env.LANGFLOW_API_TOKEN;
    
    if (!flowId || !apiToken) {
      throw new Error('Missing Langflow configuration');
    }
    
    const url = `https://api.langflow.astra.datastax.com/lf/ca17e67e-e893-437b-b9d6-8a58f6b0eda4/api/v1/run/${flowId}?stream=false`;
    
    const response = await axios.post(url, 
      {
        input_value: message,
        output_type: "chat",
        input_type: "chat",
        tweaks: {
          "ChatInput-TgJla": {},
          "GoogleGenerativeAIModel-mj24V": {},
          "ChatOutput-XPCO0": {}
        }
      }, 
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        timeout: 25000 // 25 second timeout
      }
    );
    
    console.log('Langflow response received');
    
    // Try to extract the message using multiple possible paths
    const extractionPaths = [
      () => response.data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text,
      () => response.data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message,
      () => response.data?.outputs?.[0]?.outputs?.[0]?.artifacts?.message,
      () => response.data?.outputs?.[0]?.outputs?.[0]?.outputs?.message?.message
    ];
    
    let extractedMessage = null;
    for (const path of extractionPaths) {
      try {
        extractedMessage = path();
        if (extractedMessage) {
          console.log('Successfully extracted message');
          break;
        }
      } catch (err) {
        // Path failed, try the next one
      }
    }
    
    if (!extractedMessage) {
      console.error('Could not extract message from response');
      return "I couldn't generate a response. There was an issue with the AI service. Please try again in a moment.";
    }
    
    return extractedMessage;
  } catch (error) {
    console.error('Error querying Langflow:', error.message);
    return "I'm having trouble connecting to my knowledge base right now. Please try again in a few minutes.";
  }
}

// Send a message to Slack
async function sendSlackMessage(channelId, message) {
  try {
    console.log(`Sending message to Slack channel ${channelId}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    const response = await axios.post('https://slack.com/api/chat.postMessage', {
      channel: channelId,
      text: message
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      console.error('Slack API error:', response.data.error);
    } else {
      console.log('Message sent successfully to Slack');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error sending Slack message:', error.message);
    throw error;
  }
}

// Handle Slack events (URL verification)
app.post('/slack/events', (req, res) => {
  // Verify Slack challenge for URL verification
  if (req.body.type === 'url_verification') {
    console.log('Handling URL verification challenge');
    return res.status(200).json({ challenge: req.body.challenge });
  }
  
  // Respond to other events
  res.status(200).send();
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Simplified server is running on port ${port}`);
  console.log(`Try: http://localhost:${port}/`);
}); */