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
    const { flowId, apiToken, fullEndpoint } = config.langflow;

    if (!flowId || !apiToken) {
      throw new Error('Missing Langflow configuration: Flow ID or API Token');
    }

    const url = `${fullEndpoint}${flowId}?stream=false`;

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

/**
 * Test the Langflow connection
 * @returns {Promise<string>} - The test response
 */
async function testLangflowConnection() {
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

module.exports = {
  queryLangflow,
  testLangflowConnection
};