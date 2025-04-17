// services/wellnessInsights.js
const langflowService = require('./langflow');
const slackService = require('./slack');

/**
 * Generate AI-driven wellness insights
 * @param {Object} wellnessData - Aggregated wellness data
 * @returns {Promise<Object>} - Insights with key observations and recommendations
 */
async function generateWellnessInsights(wellnessData) {
    try {
      const insightsPrompt = `
  Analyze team wellness data and provide a concise report. 
  
  WELLNESS DATA:
  - Physical Energy: ${wellnessData.physical.score}% (${wellnessData.physical.trend})
  - Mental Well-being: ${wellnessData.mental.score}% (${wellnessData.mental.trend})
  - Social Connection: ${wellnessData.social.score}% (${wellnessData.social.trend})
  - Professional Growth: ${wellnessData.growth.score}% (${wellnessData.growth.trend})
  
  INSTRUCTIONS:
  - Generate insights in max 3 concise bullet points
  - Focus on key trends and critical observations
  - Keep total response under 350 characters
  - Use clear, direct language
  - Highlight potential risks or opportunities
  
  FORMAT YOUR RESPONSE STRICTLY AS:
  **Detailed Trend Analysis**
  Key Observations: [Concise, data-driven insights]
  
  **Recommended Interventions**
  1. [Specific, targeted intervention]
  2. [Specific, targeted intervention]
  3. [Specific, targeted intervention]
  `;
  
      // Call Langflow to generate insights
      const insights = await langflowService.queryLangflow(insightsPrompt);
  
      return insights;
    } catch (error) {
      console.error('Error generating wellness insights:', error);
      return `**Detailed Trend Analysis**
  Key Observations: Mental strain detected, energy improving, growth potential emerging
  
  **Recommended Interventions**
  1. Implement mindfulness programs
  2. Boost team engagement initiatives
  3. Provide skill development resources`;
    }
  }

/**
 * Create Slack blocks for wellness insights
 * @param {string} insights - AI-generated insights text
 * @returns {Array} - Slack message blocks
 */

/**
 * Generate AI-driven wellness insights
 * @param {Object} wellnessData - Aggregated wellness data
 * @returns {Promise<string>} - Insights text
 */
async function generateWellnessInsights(wellnessData) {
  try {
    // Structured, explicit prompt for wellness insights
    const insightsPrompt = `
Generate team wellness insights based on the following aggregated data:

Wellness Dimensions:
- Physical Energy: ${wellnessData.physical.score}% (Trend: ${wellnessData.physical.trend})
- Mental Well-being: ${wellnessData.mental.score}% (Trend: ${wellnessData.mental.trend})
- Social Connection: ${wellnessData.social.score}% (Trend: ${wellnessData.social.trend})
- Professional Growth: ${wellnessData.growth.score}% (Trend: ${wellnessData.growth.trend})

Detailed Trend Analysis
Key Observations:
1. Provide an insight about the overall wellness trend
2. Highlight the most significant dimension change
3. Note any potential areas of concern
4. Identify a positive trend or strength

Recommended Interventions:
1. Suggest a targeted intervention for the lowest scoring dimension
2. Propose a strategy to maintain or improve the highest scoring dimension
3. Recommend a holistic approach to team well-being

Focus on:
- Objective, data-driven insights
- Constructive, supportive recommendations
- Anonymized, aggregate perspective
- Clear, concise language without special formatting

Your response should strictly follow the format:

Detailed Trend Analysis
Key Observations: 
1. [First observation]
2. [Second observation]
3. [Third observation]
4. [Fourth observation]

Recommended Interventions:
1. [First intervention]
2. [Second intervention]
3. [Third intervention]
    `;

    // Call Langflow to generate insights
    const insights = await langflowService.queryLangflow(insightsPrompt);

    return insights || "No insights could be generated at this time.";
  } catch (error) {
    console.error('Error generating wellness insights:', error);
    return `Unable to generate insights. Error: ${error.message}`;
  }
}

/**
 * Create Slack blocks for wellness insights
 * @param {string} insights - AI-generated insights text
 * @returns {Array} - Slack message blocks
 */
function createWellnessInsightsBlocks(insights) {
  try {
    // Explicit parsing to handle various response formats
    const trendAnalysisRegex = /Detailed Trend Analysis\s*Key Observations:\s*(.*?)(?:\n\n|Recommended Interventions|$)/s;
    const interventionsRegex = /Recommended Interventions:\s*(.*)/s;

    const trendAnalysisMatch = insights.match(trendAnalysisRegex);
    const interventionsMatch = insights.match(interventionsRegex);

    const trendAnalysis = trendAnalysisMatch 
      ? trendAnalysisMatch[1].trim() 
      : "No trend analysis available.";

    const interventions = interventionsMatch 
      ? interventionsMatch[1].trim() 
      : "No interventions recommended.";

    return [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🌈 WellSense360 Team Insights",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Detailed Trend Analysis*\n" + trendAnalysis
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Recommended Interventions*\n" + interventions
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 Insights generated by AI, based on anonymized team responses"
          }
        ]
      }
    ];
  } catch (error) {
    console.error('Error creating insights blocks:', error);
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "❌ Unable to generate insights at this time."
        }
      }
    ];
  }
}

/**
 * Send wellness insights to a Slack channel
 * @param {string} channelId - Slack channel to send insights to
 */
async function sendWellnessInsights(channelId) {
  try {
    // Mock wellness data (in real scenario, aggregate from pulse responses)
    const wellnessData = {
      physical: { score: 75, trend: 'slight increase' },
      mental: { score: 62, trend: 'decrease' },
      social: { score: 85, trend: 'stable' },
      growth: { score: 70, trend: 'increase' }
    };

    // Generate insights
    const insights = await generateWellnessInsights(wellnessData);
    
    // Create Slack blocks with robust error handling
    const insightsBlocks = createWellnessInsightsBlocks(insights);
    
    // Send to Slack
    await slackService.sendMessageWithBlocks(
      channelId, 
      "WellSense360 Team Wellness Insights", 
      insightsBlocks
    );
  } catch (error) {
    console.error('Error sending wellness insights:', error);
    await slackService.sendMessage(
      channelId,
      "Sorry, I couldn't generate insights at this time."
    );
  }
}


module.exports = {
  generateWellnessInsights,
  sendWellnessInsights
};
