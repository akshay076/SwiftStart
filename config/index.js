// config/index.js
require('dotenv').config({ path: './variables.env' });
const { ChatGoogleGenerativeAI } = require("langchain/chat_models/googleai");
const config = {
  port: process.env.PORT || 3000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000')
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET
  },
  validRoles: [
    'software-engineer', 
    'product-manager', 
    'designer', 
    'marketing', 
    'sales', 
    'customer-success', 
    'hr', 
    'finance'
  ],
  // Azure AD configuration (for future integration)
  azureAd: {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    tenantId: process.env.AZURE_AD_TENANT_ID,
    redirectUri: process.env.AZURE_AD_REDIRECT_URI,
    authority: process.env.AZURE_AD_AUTHORITY
  }
};

// Log configuration (excluding sensitive values)
console.log('Configuration loaded:');
console.log('- Server port:', config.port);
console.log('- OpenAI model:', config.openai.model || 'Not set');
console.log('- OpenAI API key:', config.openai.apiKey ? 'Set (value hidden)' : 'Not set');
console.log('- Slack signing secret:', config.slack.signingSecret ? 'Set (value hidden)' : 'Not set');
console.log('- Slack bot token:', config.slack.botToken ? 'Set (value hidden)' : 'Not set');
console.log('- Azure AD client ID:', config.azureAd.clientId ? 'Set (value hidden)' : 'Not set');

module.exports = config;