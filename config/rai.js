// config/rai.js
/**
 * Configuration settings for Responsible AI features
 */
const raiConfig = {
    // Enable or disable RAI features globally
    enabled: true,
    
    // Control which RAI metrics are shown
    metrics: {
      showConfidence: true,
      showResponseTime: true,
      showWordCount: true,
      showSentiment: true,
      showUncertainty: true
    },
    
    // Control which safety flags are checked and displayed
    safetyChecks: {
      checkPII: true,
      checkBias: true,
      checkSensitiveTerms: true,
      showSensitiveTermsList: true, // Whether to show actual sensitive terms found
      maxSensitiveTermsToShow: 3    // Max number of sensitive terms to display
    },
    
    // Control model info display
    modelInfo: {
      showModelName: true,
      showModelVersion: true,
      showModelProvider: true
    },
    
    // Control access to RAI features
    access: {
      restrictToManagers: true,     // Only show RAI metrics to managers
      restrictToAdmins: false,      // Only show RAI metrics to system admins
      showBasicMetricsToAll: false  // If true, shows basic metrics to all users
    }
};
  
module.exports = raiConfig;