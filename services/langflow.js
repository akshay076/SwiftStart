// services/langflow.js
// This is now a wrapper around langchainService for backward compatibility
const langchainService = require('./langchainService');

/**
 * Query with Langchain (previously Langflow)
 * @param {string} message - The message to send
 * @returns {Promise<string>} - The response
 */
async function queryLangflow(message) {
  try {
    console.log(`Forwarding query to Langchain: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // Determine if this is a checklist request
    if (message.toLowerCase().includes('checklist') || message.toLowerCase().includes('onboarding list')) {
      // Extract role from the message if it's a checklist request
      const roleMatch = message.match(/for a (.*?) role/i) || message.match(/for (.*?) role/i);
      
      if (roleMatch && roleMatch[1]) {
        const role = roleMatch[1].trim();
        return await langchainService.generateChecklist(role);
      }
    }
    
    // Default case - regular query
    return await langchainService.processQuery(message);
  } catch (error) {
    console.error('Error with Langchain:', error);
    return "I'm having trouble connecting to my knowledge base right now. Please try again in a few minutes.";
  }
}

/**
 * Legacy method for compatibility
 * @param {string} text - The message to send
 * @returns {Promise<string>} - The response
 */
async function getLangflowResponse(text) {
  return await queryLangflow(text);
}

/**
 * Test the connection
 * @returns {Promise<string>} - The test response
 */
async function testLangflowConnection() {
  try {
    console.log('Testing Langchain connection...');
    return await langchainService.testConnection();
  } catch (error) {
    console.error('Langchain connection test failed:', error);
    throw error;
  }
}

module.exports = {
  queryLangflow,
  getLangflowResponse,
  testLangflowConnection
};