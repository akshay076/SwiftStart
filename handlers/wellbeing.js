// handlers/wellbeing.js
const slackService = require('../services/slack');
const wellnessInsightsService = require('../services/wellnessInsights');

/**
 * Handle demo command to showcase WellSense360
 * @param {Object} payload - Slack command payload
 */
async function handleDemoCommand(payload) {
  const { user_id, channel_id } = payload;
  
  try {
    // Send intro message
    await slackService.sendMessage(
      channel_id,
      "🚀 *Welcome to the WellSense360 Demo!*\n\nI'll walk you through how our continuous well-being measurement works."
    );
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Explain the automated pulse checks
    await slackService.sendMessage(
      channel_id,
      "WellSense360 automatically sends short pulse checks at variable times throughout the workday:"
    );
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Show an example pulse - mock it directly here since we don't have the scheduler yet
    const pulseBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📊 *Quick Well-being Pulse*\n\nHow would you rate your energy level right now?"
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "😴 Low", 
              emoji: true 
            },
            value: "low",
            action_id: "energy_low"
          },
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "😐 Medium", 
              emoji: true 
            },
            value: "medium",
            action_id: "energy_medium"
          },
          {
            type: "button",
            text: { 
              type: "plain_text", 
              text: "⚡ High", 
              emoji: true 
            },
            value: "high",
            action_id: "energy_high"
          }
        ]
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Well-being pulse check",
      pulseBlocks
    );
    
    // Wait for demo response, then continue
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Explain data collection
    await slackService.sendMessage(
      channel_id,
      "Each response is anonymized and aggregated with team data. Individual responses are never shared with management."
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Show mock team dashboard
    await slackService.sendMessage(
      channel_id,
      "Based on continuous measurements, leadership gets anonymized team insights:"
    );
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock insights
    const insightBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Team Well-being Insights",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Team Energy Trend (Last 14 Days)*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "```\nEnergy: ▁▂▃▂▁▂▃▄▅▆▅▄▅▇\n         Mon          Fri          Wed\n```"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Key Insights*\n• Energy levels typically dip on Mondays\n• Team's overall energy has increased 23% this week\n• 2 team members reported lower energy today"
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Dimension Breakdown*"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Physical:* 72% 📈"
          },
          {
            type: "mrkdwn",
            text: "*Mental:* 68% 📉"
          },
          {
            type: "mrkdwn",
            text: "*Social:* 85% ↔️"
          },
          {
            type: "mrkdwn",
            text: "*Financial:* 77% 📈"
          }
        ]
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Team well-being insights",
      insightBlocks
    );
    
    // Send mock GenAI-generated recommendations
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const recommendationBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "AI-Generated Recommendations",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Based on current patterns:*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "1️⃣ Consider lighter meeting load on Monday mornings to address the energy dip pattern we're seeing consistently at the start of each week."
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "2️⃣ Mental dimension shows a 5% downward trend over two weeks - promote existing mental health resources and consider scheduling recovery time after the recent product launch."
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "3️⃣ Recent successful intervention: Flexible lunch hours has correlated with a 15% improvement in afternoon energy levels across the team."
        }
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channel_id,
      "Well-being recommendations",
      recommendationBlocks
    );
    
    // Finish demo
    await new Promise(resolve => setTimeout(resolve, 4000));
    await slackService.sendMessage(
      channel_id,
      "That's the WellSense360 experience! \n\n*Key benefits:*\n• Continuous vs. periodic measurement\n• Minimal employee effort (< 5 seconds per pulse)\n• Actionable insights for leaders\n• Privacy-preserving design\n• AI-powered recommendations\n\nTry `/enroll` to start receiving automated pulses, or `/insights` to view the insights dashboard."
    );
  } catch (error) {
    console.error('Error in demo:', error);
    await slackService.sendMessage(
      channel_id,
      "Sorry, I encountered an error during the demo."
    );
  }
}

/**
 * Handle insights command to show well-being dashboard
 * @param {Object} payload - Slack command payload
 */
// handlers/wellbeing.js
// Update handleInsightsCommand
async function handleInsightsCommand(payload) {
    const { channel_id } = payload;
    
    try {
      await wellnessInsightsService.sendWellnessInsights(channel_id);
    } catch (error) {
      console.error('Error sending insights:', error);
      await slackService.sendMessage(
        channel_id,
        "Sorry, I encountered an error showing your insights."
      );
    }
  }
  
  async function sendPersonalInsights(userId, channelId) {
    // Retrieve user's pulse responses
    const userResponses = getUserPulseResponses(userId);
    
    if (!userResponses || Object.keys(userResponses).length === 0) {
      await slackService.sendMessage(
        channelId,
        "You haven't completed any pulse checks yet. Keep tracking your well-being!"
      );
      return;
    }
    
    // Create personal insights blocks
    const personalInsightsBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🌟 Your Personal Well-being Insights",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Your Recent Well-being Snapshot*"
        }
      }
    ];
    
    // Add insights for each dimension
    Object.entries(userResponses).forEach(([dimension, response]) => {
      personalInsightsBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${dimension.charAt(0).toUpperCase() + dimension.slice(1)}*: ${response.value} (${response.timestamp})`
        }
      });
    });
    
    // Add trend and recommendation block
    personalInsightsBlocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Personalized Recommendation:*\nKeep tracking your well-being and celebrate your progress!"
        }
      }
    );
    
    await slackService.sendMessageWithBlocks(
      channelId,
      "Your Personal Well-being Insights",
      personalInsightsBlocks
    );
  }
  
  function getUserPulseResponses(userId) {
    // In a real implementation, this would query a database
    // For now, we'll use the in-memory storage from interactions
    const pulseResponses = global.pulseResponses || new Map();
    return pulseResponses.get(userId) || {};
  }
  
  async function sendTeamInsights(channelId) {
    // Aggregate insights across the team
    const teamInsightsBlocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📊 Comprehensive Team Well-being Analytics",
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🔍 Trend Analysis & Key Insights*"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Overall Wellness Trend:* 🟢 Improving (+5% this week)"
          },
          {
            type: "mrkdwn",
            text: "*Risk Areas:* 🚨 Mental Well-being (Low Focus Levels)"
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Dimensional Performance Breakdown*"
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: "*Energy* 🔋\n- Avg: 72%\n- Trend: 📈 Improving\n- Hotspot: Afternoon energy dip"
          },
          {
            type: "mrkdwn",
            text: "*Focus* 🎯\n- Avg: 58%\n- Trend: 📉 Declining\n- Hotspot: Morning concentration"
          },
          {
            type: "mrkdwn",
            text: "*Team Connection* 🤝\n- Avg: 65%\n- Trend: ↔️ Stable\n- Insight: Remote work impact"
          },
          {
            type: "mrkdwn",
            text: "*Professional Growth* 📈\n- Avg: 70%\n- Trend: 📈 Improving\n- Hotspot: Learning opportunities"
          }
        ]
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🔬 Detailed Trend Analysis*\n\n*Key Observations:*\n" +
                "• Mental well-being shows signs of strain\n" +
                "• Energy levels improving with recent interventions\n" +
                "• Professional growth perception increasing"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🚀 Recommended Interventions:*\n" +
                "1. Introduce focused breaks to address concentration issues\n" +
                "2. Implement peer support groups for mental well-being\n" +
                "3. Continue professional development initiatives"
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 Insights based on anonymized, aggregated responses. Updated: " + new Date().toLocaleDateString()
          }
        ]
      }
    ];
    
    await slackService.sendMessageWithBlocks(
      channelId,
      "Comprehensive Team Well-being Insights",
      teamInsightsBlocks
    );
  }
  
  module.exports = {
    handleInsightsCommand
  };

/**
 * Handle enrollment for automated well-being pulses
 * @param {Object} payload - Slack command payload
 */
// In handlers/wellbeing.js
async function handleEnrollCommand(payload) {
    const { user_id, channel_id, team_id } = payload;
    
    try {
      // Send confirmation
      await slackService.sendMessage(
        channel_id,
        `✅ *You're enrolled in WellSense360!*\n\nYou'll receive automated well-being pulse checks throughout your workday.\n\nThese brief check-ins help measure team well-being patterns while respecting your privacy.\n\nType \`/insights\` anytime to see anonymized team insights.`
      );
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Use pulse scheduler to create blocks
      const pulseScheduler = require('../services/pulseScheduler');
      const pulseBlocks = pulseScheduler.createPulseCheckBlocks();
      
      // Send the pulse check with blocks
      await slackService.sendMessageWithBlocks(
        channel_id, 
        "WellSense360 Well-being Pulse",
        pulseBlocks
      );
      
    } catch (error) {
      console.error('Error enrolling in well-being pulses:', error);
      await slackService.sendMessage(
        channel_id,
        "Sorry, I encountered an error enrolling you in well-being measurements."
      );
    }
  }

module.exports = {
  handleDemoCommand,
  handleInsightsCommand,
  handleEnrollCommand
};