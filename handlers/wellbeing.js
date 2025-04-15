// handlers/wellbeing.js
async function handlePulseCommand(payload) {
    const { user_id, channel_id } = payload;
    
    try {
      // Create a simple pulse check with buttons
      const pulseBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📊 *Quick Well-being Pulse*\n\nHow would you rate your energy level today?"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "😴 Low", emoji: true },
              value: "low",
              action_id: "pulse_low"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "😐 Medium", emoji: true },
              value: "medium",
              action_id: "pulse_medium"
            },
            {
              type: "button",
              text: { type: "plain_text", text: "⚡ High", emoji: true },
              value: "high",
              action_id: "pulse_high"
            }
          ]
        }
      ];
      
      await slackService.sendMessageWithBlocks(
        channel_id,
        "Well-being pulse check",
        pulseBlocks
      );
    } catch (error) {
      console.error('Error sending pulse check:', error);
      await slackService.sendMessage(
        channel_id,
        "Sorry, I encountered an error sending your pulse check."
      );
    }
  }

  // handlers/wellbeing.js
async function handleInsightsCommand(payload) {
    const { user_id, channel_id } = payload;
    
    try {
      // For hackathon, we'll just show mock insights
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
          },
          accessory: {
            type: "image",
            image_url: "https://via.placeholder.com/150?text=Mock+Chart",
            alt_text: "Mock dimension chart"
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
      
      // Send mock recommendations
      const recommendationBlocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Recommended Actions",
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
            text: "1️⃣ Consider lighter meeting load on Monday mornings"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "2️⃣ Mental dimension shows downward trend - promote mental health resources"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "3️⃣ Recent successful intervention: Flexible lunch hours (+15% energy)"
          }
        }
      ];
      
      await slackService.sendMessageWithBlocks(
        channel_id,
        "Team well-being recommendations",
        recommendationBlocks
      );
    } catch (error) {
      console.error('Error sending insights:', error);
      await slackService.sendMessage(
        channel_id,
        "Sorry, I encountered an error showing your insights."
      );
    }
  }

// handlers/wellbeing.js - update handleDemoCommand
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
      
      // Show an example pulse
      const pulseScheduler = require('../services/pulseScheduler');
      await pulseScheduler.sendPulseCheck(user_id, channel_id);
      
      // Wait for demo response, then continue
      await new Promise(resolve => setTimeout(resolve, 8000));
      
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
      await handleInsightsCommand(payload);
      
      // Finish demo
      await new Promise(resolve => setTimeout(resolve, 5000));
      await slackService.sendMessage(
        channel_id,
        "That's the WellSense360 experience! \n\n*Key benefits:*\n• Continuous vs. periodic measurement\n• Minimal employee effort (< 5 seconds per pulse)\n• Actionable insights for leaders\n• Privacy-preserving design\n\nTry `/enroll` to start receiving automated pulses, or `/insights` to view the mock insights dashboard."
      );
    } catch (error) {
      console.error('Error in demo:', error);
      await slackService.sendMessage(
        channel_id,
        "Sorry, I encountered an error during the demo."
      );
    }
  }

  // handlers/wellbeing.js
async function handleEnrollCommand(payload) {
    const { user_id, channel_id, team_id } = payload;
    
    try {
      // Schedule automated pulses for this user
      const pulseScheduler = require('../services/pulseScheduler');
      const checkTimes = pulseScheduler.scheduleForUser(user_id, team_id, channel_id);
      
      // Format times for display
      const formattedTimes = checkTimes
        .map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')}`)
        .join(' and ');
      
      // Send confirmation
      await slackService.sendMessage(
        channel_id,
        `✅ *You're enrolled in WellSense360!*\n\nYou'll receive automated well-being pulse checks during your workday (approximately at ${formattedTimes} today).\n\nThese brief check-ins help measure team well-being patterns while respecting your privacy.\n\nType \`/insights\` anytime to see anonymized team insights.`
      );
      
      // For hackathon demo purposes, also send a pulse immediately
      // In production, we'd just wait for the scheduled times
      await new Promise(resolve => setTimeout(resolve, 3000));
      await pulseScheduler.sendPulseCheck(user_id, channel_id);
      
    } catch (error) {
      console.error('Error enrolling in well-being pulses:', error);
      await slackService.sendMessage(
        channel_id,
        "Sorry, I encountered an error enrolling you in well-being measurements."
      );
    }
  }