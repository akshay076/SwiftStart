// services/langchainService.js
const { ChatGoogleGenerativeAI } = require("langchain/chat_models/googleai");
const { PromptTemplate } = require("langchain/prompts");
const { LLMChain } = require("langchain/chains");
const { HumanMessage, SystemMessage, AIMessage } = require("langchain/schema");
const { loadQAChain } = require("langchain/chains");
const { RetrievalQAChain } = require("langchain/chains");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Import custom services
const documentProcessor = require('./documentProcessor');
const governanceService = require('./governanceService');

// Load environment variables
dotenv.config({ path: './variables.env' });

// Initialize vector store
let vectorStore = null;

// Initialize the vector store on module load
(async () => {
  try {
    vectorStore = await documentProcessor.loadOrCreateVectorStore();
    console.log('Vector store initialized successfully');
  } catch (error) {
    console.error(`Error initializing vector store: ${error.message}`);
  }
})();

// Create ChatGoogleGenerativeAI instance
const chatModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  modelName: process.env.GEMINI_MODEL || "gemini-1.5-pro",
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.3'),
  maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '2000'),
});

// Load system prompts
const BASE_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/system.txt'), 'utf8');
const CHECKLIST_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/checklist.txt'), 'utf8');
const WELLNESS_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/wellness.txt'), 'utf8');

/**
 * Enhance prompt with retrieved context
 * @param {string} query - User query
 * @param {Array} retrievedDocuments - Retrieved documents
 * @param {string} systemPrompt - System prompt to use
 * @returns {string} - Enhanced prompt
 */
function enhancePromptWithContext(query, retrievedDocuments, systemPrompt) {
  if (!retrievedDocuments || retrievedDocuments.length === 0) {
    return systemPrompt;
  }
  
  // Extract the content from retrieved documents
  const contextContent = retrievedDocuments
    .map((doc, i) => `[Document ${i+1}]: ${doc.pageContent}`)
    .join('\n\n');
  
  // Create enhanced system prompt with context
  const enhancedPrompt = `${systemPrompt}
  
RETRIEVED CONTEXT:
${contextContent}

INSTRUCTIONS FOR USING CONTEXT:
1. Use the above context to answer the user's question.
2. If the context doesn't contain the answer, say you don't have that information.
3. Cite the document sources in your answer as [Document X].
4. Don't make up information that's not in the context or your knowledge.
5. If answering based on your general knowledge instead of the context, clearly indicate this.`;

  return enhancedPrompt;
}

/**
 * Retrieve relevant documents from vector store
 * @param {string} query - User query
 * @returns {Promise<Array>} - Retrieved documents
 */
async function retrieveDocuments(query) {
  try {
    if (!vectorStore) {
      console.log('Vector store not initialized, initializing now...');
      vectorStore = await documentProcessor.loadOrCreateVectorStore();
    }
    
    // Retrieve relevant documents
    const retrievedDocs = await vectorStore.similaritySearch(query, 5);
    console.log(`Retrieved ${retrievedDocs.length} documents for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    return retrievedDocs;
  } catch (error) {
    console.error(`Error retrieving documents: ${error.message}`);
    return [];
  }
}

/**
 * Process a query with RAG+Governance implementation
 * @param {string} query - User query to process
 * @param {string} promptType - Type of prompt to use (default, checklist, wellness)
 * @returns {Promise<string>} - AI response
 */
async function processQuery(query, promptType = 'default') {
  try {
    console.log(`Processing ${promptType} query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    // Log the query for governance
    governanceService.logGovernanceEvent('query_received', {
      query: query.substring(0, 100),
      promptType
    });
    
    // Retrieve relevant documents
    const retrievedDocs = await retrieveDocuments(query);
    
    // Choose appropriate system prompt based on prompt type
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (promptType === 'checklist') {
      systemPrompt = CHECKLIST_SYSTEM_PROMPT;
    } else if (promptType === 'wellness') {
      systemPrompt = WELLNESS_SYSTEM_PROMPT;
    }
    
    // Enhance the system prompt with retrieved context
    const enhancedSystemPrompt = enhancePromptWithContext(
      query, 
      retrievedDocs,
      systemPrompt
    );
    
    // Apply governance to input
    const { hasBias } = governanceService.detectBias(query);
    
    // Add bias warning if detected
    let finalPrompt = enhancedSystemPrompt;
    if (hasBias) {
      finalPrompt += "\n\nNote: The user's query may contain biased language. Ensure your response is fair and unbiased.";
    }
    
    // Create message list with system prompt and user query
    const messages = [
      new SystemMessage(finalPrompt),
      new HumanMessage(query)
    ];
    
    // Process query with the model
    const response = await chatModel.call(messages);
    
    // Apply governance to output
    const { processedOutput, governanceInfo } = await governanceService.processGovernance(
      query, 
      response.content,
      { promptType, retrievedDocsCount: retrievedDocs.length }
    );
    
    // Log completion for governance
    governanceService.logGovernanceEvent('query_completed', {
      outputLength: processedOutput.length,
      governanceInfo
    });
    
    // Return the processed content
    return processedOutput;
  } catch (error) {
    console.error('Error processing query with Langchain:', error);
    governanceService.logGovernanceEvent('query_error', {
      error: error.message,
      query: query.substring(0, 100)
    });
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
 * Refresh the knowledge base by reprocessing documents
 * @returns {Promise<boolean>} - Success status
 */
async function refreshKnowledgeBase() {
  try {
    console.log('Refreshing knowledge base...');
    const documents = await documentProcessor.processAllDocuments();
    vectorStore = await documentProcessor.createVectorStore(documents);
    console.log('Knowledge base refreshed successfully');
    return true;
  } catch (error) {
    console.error(`Error refreshing knowledge base: ${error.message}`);
    return false;
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
  testConnection,
  refreshKnowledgeBase
};