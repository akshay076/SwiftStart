# SwiftStart

A Slack-based AI-powered onboarding assistant that helps new employees navigate their first days. Features AI responses to questions, interactive checklists, and progress tracking. Managers can create role-specific onboarding plans while employees get guided through their tasks with a user-friendly Slack interface.

## Features

- `/askbuddy` command for general onboarding questions
- `/create-checklist` command for managers to create role-specific onboarding checklists
- `/check-progress` command for managers to check employee onboarding progress
- Interactive checklists with checkboxes and progress tracking
- Direct message support for private conversations
- Mentions handling in channels
- Manager verification using Slack profile titles
- Real-time task completion status updates with visual feedback
- Milestone-based progress notifications for managers

## Project Structure

```
project-root/
├── config/              # Configuration settings
├── services/            # API services (Langflow, Slack)
├── handlers/            # Command and event handlers
├── controllers/         # Business logic
├── utils/               # Utility functions
├── routes/              # Express routes
├── middleware/          # Express middleware
├── models/              # Database models (future)
├── app.js               # Express app setup
└── server.js            # Entry point
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/swiftstart.git
   cd swiftstart
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `variables.env` file in the root directory:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   LANGFLOW_URL=https://api.langflow.astra.datastax.com/lf/ca17e67e-e893-437b-b9d6-8a58f6b0eda4
   LANGFLOW_FLOW_ID=your-flow-id
   LANGFLOW_API_TOKEN=your-api-token
   PORT=3000
   ALLOW_ALL_MANAGERS=false
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Use ngrok to expose your local server:
   ```
   ngrok http 3000
   ```

6. Update your Slack app configuration with the ngrok URL:
   - Slash Commands URLs: 
     - `/askbuddy` -> `https://your-ngrok-url/slack/commands`
     - `/create-checklist` -> `https://your-ngrok-url/slack/commands`
     - `/check-progress` -> `https://your-ngrok-url/slack/commands`
   - Events URL: `https://your-ngrok-url/slack/events`
   - Interactivity Request URL: `https://your-ngrok-url/slack/interactions`

## Slack App Configuration

1. Go to api.slack.com and create a new app
2. Under "Interactivity & Shortcuts", enable interactivity and set the request URL
3. Under "OAuth & Permissions", add the following scopes:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`
   - `commands`
   - `groups:history`
   - `im:history`
   - `im:write`
   - `users:read`
   - `users:read.email`
4. Create slash commands:
   - `/askbuddy` - Description: "Ask the onboarding assistant a question"
   - `/create-checklist` - Description: "Create an onboarding checklist for a team member" (manager only)
   - `/check-progress` - Description: "Check the onboarding progress of a team member" (manager only)
5. Enable event subscriptions and subscribe to:
   - `app_mention`
   - `message.im`

## Langflow Configuration

1. Set up a Langflow account and create a new flow
2. Configure your flow to use the following system message for the AI:
   ```
   You are SwiftStart, an AI-powered onboarding assistant for Horizon Technologies. Your purpose is to help new employees navigate their first days, weeks, and months at the company, while also supporting managers in creating effective onboarding experiences.

   Your capabilities include:

   1. Answering questions about company policies, procedures, benefits, technical setup, and culture
   2. Creating structured onboarding checklists tailored to specific roles
   3. Explaining typical workflows and processes
   4. Providing guidance on where to find resources and who to contact for various needs
   5. Offering tips for successful integration into the team

   When creating checklists, follow these guidelines:
   - Create MAXIMUM 15 items total (not per category) - this is a strict limit
   - Organize items into just 3 categories: "First Day", "First Week", and "First Month"
   - Put no more than 5 items in each category
   - Write each item as a simple task starting with a verb
   - Keep each task under 60 characters for better display
   - Write in plain text only without ANY special formatting (no bold, italic, etc.)
   - Ensure tasks are specific and relevant to the requested role

   When answering questions:
   - Provide clear, concise information
   - Be welcoming and supportive in tone
   - Reference Horizon Technologies' specific practices when appropriate
   - Acknowledge when you may not have certain company-specific information
   - Suggest who the employee might contact for more details when necessary

   Your goal is to make the onboarding experience smooth, informative, and efficient for all new Horizon Technologies employees.
   ```

## Command Usage

- `/askbuddy [question]` - Ask any onboarding-related question
  - Special command: `/askbuddy am i a manager` - Check if you're recognized as a manager
- `/create-checklist [role] for @username` - Create an onboarding checklist for a specific role and user (manager only)
- `/check-progress @username` - Check the onboarding progress of a specific user (manager only)

## Manager Verification

The app verifies managers based on their Slack profile title:
1. Only users with titles containing words like "manager", "director", "lead", etc. can use manager-only commands
2. Users can check if they're recognized as managers by using `/askbuddy am i a manager`
3. For testing purposes, you can set `ALLOW_ALL_MANAGERS=true` in the environment variables

## Interactive Features

- **Checklist Items**: Users can check off completed items in their checklist
- **Progress Tracking**: Both users and managers can view progress summaries
- **Notifications**: Managers receive notifications when employees reach milestones (25%, 50%, 75%, 100%)
- **Visual Feedback**: Items change color from red to green when completed

## Future Enhancements

- Integration with Azure Active Directory for proper manager verification
- Persistent database storage for checklists and progress data
- More granular permissions and role-based access
- Enhanced analytics and reporting for onboarding progress
- Custom checklist creation and modification

## Troubleshooting

- If checklist items aren't displaying properly, ensure the Langflow system message avoids special formatting
- For manager verification issues, check the user's Slack profile title or use the development override
- Check logs for detailed error information when interactions fail

## License

MIT