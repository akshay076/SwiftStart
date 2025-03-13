// services/responsibleAI.js
const config = require('../config');
const raiConfig = require('../config/rai');

/**
 * Generates and tracks responsible AI metrics for manager insights
 */
class ResponsibleAIService {
  /**
   * Generate responsible AI metrics for a given AI response
   * @param {string} query - The original user query
   * @param {string} response - The AI response text
   * @param {boolean} isPIIDetected - Whether PII was detected
   * @param {boolean} isBiasDetected - Whether bias was detected 
   * @returns {object} - Object containing responsible AI metrics
   */
  static generateMetrics(query, response, isPIIDetected = false, isBiasDetected = false) {
    // Calculate simple metrics
    const queryLength = query.length;
    const responseLength = response.length;
    const wordCount = response.split(/\s+/).filter(Boolean).length;
    
    // Calculate response time (simulate for now)
    const responseTime = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds range
    
    // Calculate simple content safety metrics
    const sensitiveTerms = this.checkForSensitiveTerms(response);
    const uncertaintyMarkers = this.detectUncertaintyMarkers(response);
    const sentimentScore = this.calculateSentimentScore(response);
    
    // Static confidence score that could be replaced with actual model confidence
    const confidenceScore = Math.max(0.65, Math.min(0.95, 0.85 - (sensitiveTerms.length * 0.05)));
    
    return {
      metrics: {
        responseTime: `${responseTime}ms`,
        wordCount: wordCount,
        confidence: (confidenceScore * 100).toFixed(1) + '%',
        sentiment: sentimentScore,
        uncertaintyLevel: uncertaintyMarkers.length,
      },
      safetyFlags: {
        piiDetected: isPIIDetected,
        biasDetected: isBiasDetected,
        sensitiveTermsCount: sensitiveTerms.length,
        sensitiveTriggers: sensitiveTerms.slice(0, 3), // Only show up to 3 sensitive terms
      },
      timestamp: new Date().toISOString(),
      modelInfo: {
        modelName: "gemini-1.5-pro",
        modelVersion: "20240219", // Simulated version info
        modelProvider: "Google"
      }
    };
  }
  
  /**
   * Check for potentially sensitive terms in response
   * @param {string} text - The text to check
   * @returns {Array} - Array of detected sensitive terms
   */
  static checkForSensitiveTerms(text) {
    const sensitivePatterns = [
      'password', 'confidential', 'secret', 'private', 'sensitive',
      'proprietary', 'classified', 'restricted', 'internal', 'only',
      'social security', 'ssn', 'birth date', 'credit card', 'account number'
    ];
    
    const lowercaseText = text.toLowerCase();
    return sensitivePatterns.filter(term => lowercaseText.includes(term));
  }
  
  /**
   * Detect uncertainty markers in response
   * @param {string} text - The text to check
   * @returns {Array} - Array of detected uncertainty markers
   */
  static detectUncertaintyMarkers(text) {
    const uncertaintyPatterns = [
      'maybe', 'perhaps', 'possibly', 'might', 'could be', 
      'not sure', 'uncertain', 'unclear', 'unknown', 'estimate',
      'approximately', 'around', 'about', 'roughly'
    ];
    
    const lowercaseText = text.toLowerCase();
    return uncertaintyPatterns.filter(term => lowercaseText.includes(term));
  }
  
  /**
   * Calculate a simple sentiment score for text
   * @param {string} text - The text to analyze
   * @returns {string} - Sentiment category (Positive, Neutral, or Negative)
   */
  static calculateSentimentScore(text) {
    const positiveTerms = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'best',
      'helpful', 'beneficial', 'positive', 'success', 'successful',
      'recommended', 'effective', 'efficient', 'valuable'
    ];
    
    const negativeTerms = [
      'bad', 'poor', 'terrible', 'awful', 'worst', 'difficult', 
      'hard', 'problem', 'issue', 'concern', 'negative', 'fail',
      'failure', 'ineffective', 'inefficient', 'useless'
    ];
    
    const lowercaseText = text.toLowerCase();
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = lowercaseText.match(regex);
      if (matches) positiveCount += matches.length;
    });
    
    negativeTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = lowercaseText.match(regex);
      if (matches) negativeCount += matches.length;
    });
    
    // Determine sentiment based on relative counts
    if (positiveCount > negativeCount * 1.5) return "Positive";
    if (negativeCount > positiveCount * 1.5) return "Negative";
    return "Neutral";
  }
  
  /**
   * Format metrics for display in Slack
   * @param {object} metrics - The metrics object
   * @returns {string} - Formatted metrics for Slack display
   */
  static formatMetricsForSlack(metrics) {
    return [
      `*🤖 AI Response Metrics*`,
      `• 🔍 Confidence: ${metrics.metrics.confidence}`,
      `• ⏱️ Response Time: ${metrics.metrics.responseTime}`,
      `• 📊 Word Count: ${metrics.metrics.wordCount}`,
      `• 🧠 Sentiment: ${metrics.metrics.sentiment}`,
      `${metrics.safetyFlags.piiDetected || metrics.safetyFlags.biasDetected || metrics.safetyFlags.sensitiveTermsCount > 0 ? '⚠️ *Safety Flags:*' : '✅ *No Safety Concerns*'}`,
      `${metrics.safetyFlags.piiDetected ? '  • PII detected and handled' : ''}`,
      `${metrics.safetyFlags.biasDetected ? '  • Potential bias mitigated' : ''}`,
      `${metrics.safetyFlags.sensitiveTermsCount > 0 ? `  • ${metrics.safetyFlags.sensitiveTermsCount} sensitive terms found` : ''}`,
      `_Model: ${metrics.modelInfo.modelName} (${metrics.modelInfo.modelProvider})_`
    ].filter(Boolean).join('\n');
  }
}

module.exports = ResponsibleAIService;