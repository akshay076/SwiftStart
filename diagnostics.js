// diagnostics.js
// Run this script to test your Langflow configuration
const axios = require('axios');
require('dotenv').config({ path: './variables.env' });

async function testLangflowConnection() {
  try {
    console.log('=== Langflow Configuration Test ===');
    
    // Check required environment variables
    console.log('Checking environment variables...');
    
    const flowId = process.env.LANGFLOW_FLOW_ID;
    const apiToken = process.env.LANGFLOW_API_TOKEN;
    const langflowUrl = process.env.LANGFLOW_URL || 'https://api.langflow.astra.datastax.com/lf/ca17e67e-e893-437b-b9d6-8a58f6b0eda4';
    
    if (!flowId) {
      console.error('❌ LANGFLOW_FLOW_ID is not set');
      return;
    } else {
      console.log('✅ LANGFLOW_FLOW_ID is set');
    }
    
    if (!apiToken) {
      console.error('❌ LANGFLOW_API_TOKEN is not set');
      return;
    } else {
      console.log('✅ LANGFLOW_API_TOKEN is set');
    }
    
    // Test Langflow connection
    console.log('\nTesting Langflow connection...');
    
    const fullEndpoint = `${langflowUrl}/api/v1/run/`;
    const url = `${fullEndpoint}${flowId}?stream=false`;
    
    console.log(`Making request to: ${fullEndpoint}${flowId.substring(0, 5)}...`);
    
    const testMessage = "Hello, what can you help me with?";
    
    console.time('Langflow Response Time');
    const response = await axios.post(url, 
      {
        input_value: testMessage,
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
        timeout: 30000 // 30 second timeout
      }
    );
    console.timeEnd('Langflow Response Time');
    
    console.log('Response status:', response.status);
    console.log('Response structure:', Object.keys(response.data));
    
    // Try to extract the response message
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
          console.log(`✅ Successfully extracted message using path ${extractionPaths.indexOf(path)}`);
          break;
        }
      } catch (err) {
        // Path failed, try the next one
      }
    }
    
    if (extractedMessage) {
      console.log('\n=== Extracted Message ===');
      console.log(extractedMessage);
      console.log('=========================');
      console.log('\n✅ Langflow test successful!');
    } else {
      console.error('❌ Could not extract message from response');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Langflow test failed:');
    
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out after 30 seconds');
    } else if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Test Slack API connection
async function testSlackConnection() {
  try {
    console.log('\n=== Slack API Configuration Test ===');
    
    // Check required environment variables
    console.log('Checking environment variables...');
    
    const botToken = process.env.SLACK_BOT_TOKEN;
    
    if (!botToken) {
      console.error('❌ SLACK_BOT_TOKEN is not set');
      return;
    } else {
      console.log('✅ SLACK_BOT_TOKEN is set');
    }
    
    // Test Slack API connection
    console.log('\nTesting Slack API connection...');
    
    console.time('Slack API Response Time');
    const response = await axios.post('https://slack.com/api/auth.test', {}, {
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.timeEnd('Slack API Response Time');
    
    console.log('Response status:', response.status);
    
    if (response.data.ok) {
      console.log('\n✅ Slack API test successful!');
      console.log('Bot name:', response.data.user);
      console.log('Team:', response.data.team);
    } else {
      console.error('❌ Slack API test failed:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Slack API test failed:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the tests
async function runDiagnostics() {
  console.log('Starting diagnostics...\n');
  
  await testLangflowConnection();
  await testSlackConnection();
  
  console.log('\nDiagnostics complete.');
}

runDiagnostics();