// config/index.js
require('dotenv').config({ path: './variables.env' });

const config = {
  port: process.env.PORT || 3000,
  langflow: {
    url: process.env.LANGFLOW_URL,
    flowId: process.env.LANGFLOW_FLOW_ID,
    apiToken: process.env.LANGFLOW_API_TOKEN,
    fullEndpoint: `${process.env.LANGFLOW_URL}/api/v1/run/`,
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
console.log('- Langflow URL:', config.langflow.url || 'Not set');
console.log('- Langflow Flow ID:', config.langflow.flowId ? 'Set (value hidden)' : 'Not set');
console.log('- Slack signing secret:', config.slack.signingSecret ? 'Set (value hidden)' : 'Not set');
console.log('- Slack bot token:', config.slack.botToken ? 'Set (value hidden)' : 'Not set');
console.log('- Azure AD client ID:', config.azureAd.clientId ? 'Set (value hidden)' : 'Not set');

module.exports = config;