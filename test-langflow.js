const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config({ path: './variables.env' });

// Log environment variables for debugging
console.log('Environment variables loaded:');
console.log('LANGFLOW_URL:', process.env.LANGFLOW_URL);
console.log('LANGFLOW_FLOW_ID:', process.env.LANGFLOW_FLOW_ID ? 'Set (value hidden)' : 'Not set');
console.log('SLACK_SIGNING_SECRET:', process.env.SLACK_SIGNING_SECRET ? 'Set (value hidden)' : 'Not set');
console.log('SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'Set (value hidden)' : 'Not set');

const app = express();

// Middleware to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Simple route to verify the server is running
app.get('/', (req, res) => {
  res.send('Onboarding Buddy server is running!');
});

// Define port
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Function to query the Langflow API
async function queryLangflow(message) {
  try {
    const flowId = process.env.LANGFLOW_FLOW_ID;
    const apiToken = process.env.LANGFLOW_API_TOKEN;

    if (!flowId || !apiToken) {
      throw new Error('Missing Langflow configuration: Flow ID or API Token');
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
        }
      }
    );

    // Extract the nested message using multiple possible paths
    const extractionPaths = [
      () => response.data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text,
      () => response.data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message,
      () => response.data?.outputs?.[0]?.outputs?.[0]?.artifacts?.message,
      () => response.data?.outputs?.[0]?.outputs?.[0]?.outputs?.message?.message
    ];

    let extractedMessage = null;
    for (const path of extractionPaths) {
      extractedMessage = path();
      if (extractedMessage) {
        break;
      }
    }

    // Fallback if no message is found
    if (!extractedMessage) {
      console.error('Could not extract message from response');
      console.error('Response data:', JSON.stringify(response.data, null, 2));
      extractedMessage = "I couldn't generate a response.";
    }

    return extractedMessage;
  } catch (error) {
    console.error('Detailed Langflow Error:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
    
    throw error;
  }
}

// Handle Slack slash commands
app.post('/slack/commands', async (req, res) => {
  // Extract details from the Slack command
  const { command, text, user_id, channel_id } = req.body;
  
  console.log(`Received command: ${command} with text: ${text}`);
  
  // Process different commands
  if (command === '/askbuddy') {
    // Send immediate acknowledgment to Slack
    res.status(200).send({
      response_type: 'in_channel',
      text: 'Processing your question...'
    });
    
    try {
      // Get answer from Langflow
      const answer = await queryLangflow(text);
      
      // Send the response back to Slack
      await sendSlackMessage(channel_id, answer);
    } catch (error) {
      console.error('Error processing request:', error);
      await sendSlackMessage(channel_id, "Sorry, I encountered an error processing your request.");
    }
  } 
  else if (command === '/create-checklist') {
    // Send immediate acknowledgment
    res.status(200).send({
      response_type: 'in_channel',
      text: 'Creating your checklist...'
    });
    
    // Extract role from command text
    const role = text.trim().toLowerCase();
    
    try {
      // Get appropriate checklist
      const checklist = await getChecklist(role);
      
      // Send checklist to Slack
      await sendSlackMessage(channel_id, checklist);
    } catch (error) {
      console.error('Error creating checklist:', error);
      await sendSlackMessage(channel_id, "Sorry, I couldn't create that checklist. Please try again.");
    }
  }
  else {
    // Unknown command
    res.status(200).send({
      text: "I don't recognize that command. Try /askbuddy or /create-checklist."
    });
  }
});

// Handle Slack events (mentions and direct messages)
app.post('/slack/events', (req, res) => {
  // Verify Slack challenge for URL verification
  if (req.body.type === 'url_verification') {
    return res.send({ challenge: req.body.challenge });
  }
  
  // Extract the event
  const event = req.body.event;
  
  // Handle only message events
  if ((event && event.type === 'message' && event.channel_type === 'im') || 
      (event && event.type === 'app_mention')) {
    
    // Get message text (remove mentions if present)
    let text = event.text || '';
    text = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    const channelId = event.channel;
    
    // Process the message with Langflow
    queryLangflow(text)
      .then(answer => sendSlackMessage(channelId, answer))
      .catch(error => {
        console.error('Error processing message:', error);
        sendSlackMessage(channelId, "Sorry, I encountered an error processing your message.");
      });
  }
  
  // Acknowledge receipt of the event
  res.status(200).send();
});

// Function to get the appropriate checklist based on role
async function getChecklist(role) {
  // Define common roles
  const validRoles = ['software-engineer', 'product-manager', 'designer', 'marketing', 
                     'sales', 'customer-success', 'hr', 'finance'];
  
  // Normalize the role name (remove spaces, lowercase)
  const normalizedRole = role.toLowerCase().replace(/\s+/g, '-');
  
  if (validRoles.includes(normalizedRole)) {
    // Query Langflow with the role to get a dynamically generated checklist
    const query = `Get me the onboarding checklist for a ${role} role`;
    return await queryLangflow(query);
  } else {
    // For unknown roles, return the general checklist
    const query = `Get me the general onboarding checklist`;
    return await queryLangflow(query);
  }
}

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
    }
  } catch (error) {
    console.error('Error sending Slack message:', error.message);
  }
}

// Optional: Test Langflow connection
async function testLangflowQuery() {
  try {
    const testMessage = "Hello, how are you?";
    console.log(`Testing Langflow query with message: "${testMessage}"`);
    
    const response = await queryLangflow(testMessage);
    
    console.log('Extracted Test Response:');
    console.log(response);
    
    return response;
  } catch (error) {
    console.error('Langflow Query Test Failed:', error);
    throw error;
  }
}

// Uncomment to run test on startup if needed
// testLangflowQuery();