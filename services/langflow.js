// services/langflow.js
const axios = require('axios');
const config = require('../config');

/**
 * Query the Langflow API with a message
 * @param {string} message - The message to send to Langflow
 * @returns {Promise<string>} - The response from Langflow
 */
async function queryLangflow(message) {
  try {
    console.log(`Starting Langflow query with message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    const { flowId, apiToken, fullEndpoint } = config.langflow;

    if (!flowId || !apiToken) {
      throw new Error('Missing Langflow configuration: Flow ID or API Token');
    }

    const url = `${fullEndpoint}${flowId}?stream=false`;
    
    console.log(`Making request to Langflow API: ${url}`);
    
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
        timeout: 45000 // 45 second timeout to prevent hanging indefinitely
      }
    );

    console.log('Langflow response received successfully');

    // Extract the nested message using multiple possible paths
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
          console.log(`Successfully extracted message using path ${extractionPaths.indexOf(path)}`);
          break;
        }
      } catch (err) {
        // Path failed, try the next one
      }
    }

    // Fallback if no message is found
    if (!extractedMessage) {
      console.error('Could not extract message from response');
      console.error('Response structure:', JSON.stringify(Object.keys(response.data), null, 2));
      console.error('Full response data:', JSON.stringify(response.data, null, 2));
      extractedMessage = "I couldn't generate a response. There was an issue with the AI service. Please try again in a moment.";
    }

    console.log(`Extracted message (first 100 chars): "${extractedMessage.substring(0, 100)}${extractedMessage.length > 100 ? '...' : ''}"`);
    return extractedMessage;
  } catch (error) {
    console.error('Detailed Langflow Error:');
    
    if (error.code === 'ECONNABORTED') {
      console.error('Langflow request timed out');
      return "I'm sorry, but my AI service is taking too long to respond right now. Please try again in a few minutes.";
    }
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    
    return "I'm having trouble connecting to my knowledge base right now. Please try again in a few minutes.";
  }
}

/**
 * Legacy method for compatibility - forwards to queryLangflow
 * @param {string} text - The message to send
 * @returns {Promise<string>} - The response
 */
async function getLangflowResponse(text) {
  return await queryLangflow(text);
}

/**
 * Test the Langflow connection
 * @returns {Promise<string>} - The test response
 */
async function testLangflowConnection() {
  try {
    const testMessage = "Hello, how are you?";
    console.log(`Testing Langflow query with message: "${testMessage}"`);
    
    const response = await queryLangflow(testMessage);
    
    console.log('Test Langflow Response:', response);
    
    return response;
  } catch (error) {
    console.error('Langflow Query Test Failed:', error);
    throw error;
  }
}

module.exports = {
  queryLangflow,
  getLangflowResponse,
  testLangflowConnection
};