// services/langchainService.js
const { OpenAI } = require('langchain/llms/openai');
const { PromptTemplate } = require('langchain/prompts');
const { LLMChain } = require('langchain/chains');
const { HumanMessage, SystemMessage, AIMessage } = require('langchain/schema');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { BufferMemory, ChatMessageHistory } = require("langchain/memory");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './variables.env' });

// Configure OpenAI API key from environment variable
const openaiApiKey = process.env.OPENAI_API_KEY;

// Create a ChatOpenAI instance
const chatModel = new ChatOpenAI({
  openAIApiKey: openaiApiKey,
  modelName: 'gpt-4-turbo',  // Use appropriate model
  temperature: 0.3, // Lower temperature for more deterministic outputs
  maxTokens: 2000, // Adjust as needed
});

// System prompts
const BASE_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/system.txt'), 'utf8');
const CHECKLIST_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/checklist.txt'), 'utf8');
const WELLNESS_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/wellness.txt'), 'utf8');

/**
 * Process a query with our Langchain setup
 * @param {string} query - User query to process
 * @param {string} promptType - Type of prompt to use (default, checklist, wellness)
 * @returns {Promise<string>} - AI response
 */
async function processQuery(query, promptType = 'default') {
  try {
    console.log(`Processing ${promptType} query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    let systemPrompt = BASE_SYSTEM_PROMPT;
    
    // Choose appropriate system prompt based on prompt type
    if (promptType === 'checklist') {
      systemPrompt = CHECKLIST_SYSTEM_PROMPT;
    } else if (promptType === 'wellness') {
      systemPrompt = WELLNESS_SYSTEM_PROMPT;
    }
    
    // Create message list with system prompt and user query
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(query)
    ];
    
    // Process query with the model
    const response = await chatModel.call(messages);
    
    // Return the content of the AI's response
    return response.content;
  } catch (error) {
    console.error('Error processing query with Langchain:', error);
    return "I'm sorry, I encountered an error processing your request. Please try again in a few moments.";
  }
}

/**
 * Generate a checklist for a specific role
 * @param {string} role - The job role to create a checklist for
 * @returns {Promise<string>} - The onboarding checklist for the role
 */
async function generateChecklist(role) {
  try {
    console.log(`Generating onboarding checklist for role: ${role}`);
    
    // Create the prompt for checklist generation
    const query = `Create a new employee onboarding checklist for the ${role} role. 
    Organize items into three categories: "First Day", "First Week", and "First Month". 
    Include a maximum of 15 items total across all categories.
    Write each item as a simple task starting with a verb and keep each task under 60 characters.`;
    
    // Process with checklist-specific prompt
    return await processQuery(query, 'checklist');
  } catch (error) {
    console.error('Error generating checklist:', error);
    return "I'm sorry, I couldn't generate the checklist at this time. Please try again later.";
  }
}

/**
 * Generate wellness insights from data
 * @param {Object} wellnessData - Aggregated wellness data
 * @returns {Promise<string>} - AI-generated insights
 */
async function generateWellnessInsights(wellnessData) {
  try {
    console.log('Generating wellness insights from data');
    
    // Create a structured prompt for wellness insights
    const query = `
    Generate team wellness insights based on the following aggregated data:
    
    Wellness Dimensions:
    - Physical Energy: ${wellnessData.physical.score}% (Trend: ${wellnessData.physical.trend})
    - Mental Well-being: ${wellnessData.mental.score}% (Trend: ${wellnessData.mental.trend})
    - Social Connection: ${wellnessData.social.score}% (Trend: ${wellnessData.social.trend})
    - Professional Growth: ${wellnessData.growth.score}% (Trend: ${wellnessData.growth.trend})
    
    Provide:
    1. Detailed Trend Analysis with Key Observations (4 bullet points)
    2. Recommended Interventions (3 specific suggestions)
    
    Focus on data-driven insights and actionable recommendations.
    `;
    
    // Process with wellness-specific prompt
    return await processQuery(query, 'wellness');
  } catch (error) {
    console.error('Error generating wellness insights:', error);
    return "Unable to generate insights at this time. Please try again later.";
  }
}

/**
 * Test the Langchain connection
 * @returns {Promise<string>} - Test response
 */
async function testConnection() {
  try {
    const testQuery = "Hello, how are you?";
    const response = await processQuery(testQuery);
    console.log('Langchain connection test successful');
    return response;
  } catch (error) {
    console.error('Langchain connection test failed:', error);
    throw error;
  }
}

module.exports = {
  processQuery,
  generateChecklist,
  generateWellnessInsights,
  testConnection
};