# Onboarding Buddy

A Slack-based AI-powered onboarding assistant using Langflow (RAG) and Gemini, designed to help new employees navigate the onboarding process.

## Features

- `/askbuddy` command for general onboarding questions
- `/create-checklist` command for managers to create role-specific onboarding checklists
- `/check-progress` command for managers to check employee onboarding progress
- Interactive checklists with checkboxes and progress tracking
- Direct message support for private conversations
- Mentions handling in channels
- Manager-only access for specific commands

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
   git clone https://github.com/yourusername/onboarding-buddy.git
   cd onboarding-buddy
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

## Command Usage

- `/askbuddy [question]` - Ask any onboarding-related question
- `/create-checklist [role] for @username` - Create an onboarding checklist for a specific role and user (manager only)
- `/check-progress @username` - Check the onboarding progress of a specific user (manager only)

## Interactive Features

- **Checklist Items**: Users can check off completed items in their checklist
- **Progress Tracking**: Both users and managers can view progress summaries
- **Notifications**: Managers receive notifications when employees complete tasks

## Future Enhancements

- Integration with Azure Active Directory for proper manager verification
- Persistent database storage for checklists and progress data
- More granular permissions and role-based access
- Enhanced analytics and reporting for onboarding progress
- Custom checklist creation and modification

## License

MIT