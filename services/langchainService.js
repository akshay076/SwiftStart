// services/langchainService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const documentProcessor = require('./documentProcessor');

// Load environment variables
dotenv.config({ path: './variables.env' });

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";

// Load system prompts
let BASE_SYSTEM_PROMPT = "You are SwiftStart, an AI-powered onboarding assistant for Horizon Technologies.";
let CHECKLIST_SYSTEM_PROMPT = "You are SwiftStart, creating structured onboarding checklists tailored to specific roles.";
let WELLNESS_SYSTEM_PROMPT = "You are SwiftStart, analyzing well-being data and providing insights.";

try {
  if (fs.existsSync(path.join(__dirname, '../prompts/system.txt'))) {
    BASE_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/system.txt'), 'utf8');
  }
  if (fs.existsSync(path.join(__dirname, '../prompts/checklist.txt'))) {
    CHECKLIST_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/checklist.txt'), 'utf8');
  }
  if (fs.existsSync(path.join(__dirname, '../prompts/wellness.txt'))) {
    WELLNESS_SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, '../prompts/wellness.txt'), 'utf8');
  }
} catch (error) {
  console.error('Error loading prompt files:', error);
}

/**
 * Format documents for better citation
 * @param {Array} docs - Retrieved documents
 * @returns {Array} - Formatted documents with citation info
 */
function formatDocumentsForCitation(docs) {
  // Create source map for better citation
  const sourceMap = {};
  
  docs.forEach((doc, index) => {
    const { metadata } = doc;
    const sourceId = metadata.sectionId || 'UNKNOWN';
    const sourceTitle = metadata.sectionTitle || metadata.source || 'Unknown Source';
    
    // Create citation key
    const citationKey = `${sourceId} (${metadata.source})`;
    
    // Add to source map
    if (!sourceMap[citationKey]) {
      sourceMap[citationKey] = {
        index: index + 1,
        title: sourceTitle,
        content: doc.pageContent,
        source: metadata.source,
        sectionId: sourceId,
        subsections: []
      };
    }
    
    // Add subsection if present
    if (metadata.parentSectionId) {
      sourceMap[citationKey].subsections.push({
        id: metadata.sectionId,
        title: metadata.sectionTitle
      });
    }
  });
  
  // Format docs with citation info
  const formattedDocs = docs.map(doc => {
    const { metadata } = doc;
    const sourceId = metadata.sectionId || 'UNKNOWN';
    const citationKey = `${sourceId} (${metadata.source})`;
    const citationIndex = sourceMap[citationKey].index;
    
    return {
      ...doc,
      citationKey,
      citationIndex
    };
  });
  
  return { formattedDocs, sourceMap };
}

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
  
  // Format documents for citation
  const { formattedDocs, sourceMap } = formatDocumentsForCitation(retrievedDocuments);
  
  // Extract the content from retrieved documents
  const contextContent = formattedDocs
    .map(doc => `[Reference ${doc.citationIndex}: ${doc.metadata.sectionTitle || doc.metadata.source}]\n${doc.pageContent}`)
    .join('\n\n');
  
  // Create citation guide
  const citationGuide = Object.values(sourceMap)
    .map(source => `Reference ${source.index}: ${source.title} [${source.sectionId}] from ${source.source}`)
    .join('\n');
  
  // Slack formatting guidelines
  const slackFormattingGuidelines = `
SLACK FORMATTING GUIDELINES:
- Use *single asterisks* for bold text (not **double asterisks**)
- Use _underscores_ for italic text
- Use \`backticks\` for inline code
- Use \`\`\`triple backticks\`\`\` for code blocks
- Use > for blockquotes
- Use numbered lists with 1. 2. 3. etc.
- Use bullet lists with •
`;

  // Create enhanced system prompt with context
  const enhancedPrompt = `${systemPrompt}
  
RETRIEVED CONTEXT:
${contextContent}

CITATION GUIDE:
${citationGuide}

${slackFormattingGuidelines}

INSTRUCTIONS FOR USING CONTEXT:
1. Use the above context to answer the user's question.
2. If the context doesn't contain the answer, say you don't have that information.
3. Cite sources properly using [Reference X] format where X is the reference number.
4. Don't make up information that's not in the context or your knowledge.
5. If answering based on your general knowledge instead of the context, clearly indicate this.
6. Always use Slack-compatible formatting as described above.
7. When citing sources, include the reference number, not document numbers or section IDs in the citation.`;

  return enhancedPrompt;
}

/**
 * Process a query with RAG implementation
 * @param {string} query - User query to process
 * @param {string} promptType - Type of prompt to use (default, checklist, wellness)
 * @returns {Promise<string>} - AI response
 */
async function processQuery(query, promptType = 'default') {
  try {
    console.log(`Processing ${promptType} query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    // Retrieve relevant documents
    const retrievedDocs = await documentProcessor.similaritySearch(query, 5);
    console.log(`Retrieved ${retrievedDocs.length} documents for query`);
    
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

    // Initialize the model
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.3'),
        maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '2000')
      }
    });
    
    // Start a chat to be able to provide system prompt
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "System: " + enhancedSystemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "I understand and will follow these instructions." }],
        },
      ]
    });
    
    // Send the user query
    const result = await chat.sendMessage(query);
    
    // Get the response text
    const responseText = result.response.text();
    
    // Log the completion
    console.log(`Completed processing query, response length: ${responseText.length}`);
    
    return responseText;
  } catch (error) {
    console.error('Error processing query with Google Generative AI:', error);
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
    const result = await documentProcessor.processDocuments();
    console.log('Knowledge base refresh result:', result);
    return result.success;
  } catch (error) {
    console.error(`Error refreshing knowledge base: ${error.message}`);
    return false;
  }
}

/**
 * Test the Generative AI connection
 * @returns {Promise<string>} - Test response
 */
async function testConnection() {
  try {
    const testQuery = "Hello, how are you?";
    const response = await processQuery(testQuery);
    console.log('Google Generative AI connection test successful');
    return response;
  } catch (error) {
    console.error('Google Generative AI connection test failed:', error);
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