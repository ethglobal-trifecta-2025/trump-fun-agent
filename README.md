# Trump.fun AI Agent

![Trump.fun Logo](https://fxewzungnacaxpsnowcu.supabase.co/storage/v1/object/public/trump-fun/logo/trump.fun.logo.jpg)

AI agents for pool creation and bet grading on the Trump.fun prediction market platform.

## Overview

The Trump.fun AI Agent system consists of two primary components:
1. **Pool Creation Agent**: Monitors Trump's Truth Social posts and creates relevant betting pools
2. **Bet Grading Agent**: Monitors news and Trump's activities to automatically resolve bets

These agents power the core functionality of Trump.fun - an AI-powered prediction market platform centered around President Trump's actions and statements, allowing users to place bets using either cryptocurrency (USDC) or our platform's native FREEDOM tokens.

## Key Functionality

- **Pool Creation**: Automatically analyzes Trump's social media posts
- **Market Formation**: Creates betting markets with appropriate options
- **Automated Grading**: Monitors real-world events to determine bet outcomes
- **Trump-Style Responses**: Generates responses to user comments in Trump's distinctive style

## Tech Stack

- Bun runtime for JavaScript/TypeScript
- LangChain/LangGraph for agent workflows
- LangSmith for tracing and debugging
- Integration with blockchain for market creation and resolution

## Environment Setup

Refer to the project Notion for detailed environment variable setup instructions. Required variables include:
- API keys for language models
- Blockchain connection details
- Truth Social monitoring credentials
- LangSmith API keys

## Running the Agents

### Pool Creation Agent

```bash
bun run run-pool-creation-agent.ts
```

This agent:
1. Monitors Truth Social for new posts by Trump
2. Analyzes post content for potential betting opportunities
3. Creates appropriate betting markets with options
4. Deploys these markets to the blockchain

### Bet Grading Agent

```bash
bun run run-bet-grading-agent.ts
```

This agent:
1. Monitors active betting markets approaching resolution
2. Analyzes news sources and social media for outcome information
3. Determines the winning option based on verifiable events
4. Triggers the resolution process on the blockchain

## Deployment

The agents are deployed to a server and run on a schedule via cron jobs:

```bash
./deploy.sh
```

To check the current cron configuration:
```bash
crontab -e
```

## Log Monitoring

Monitor agent activity logs:

```bash
tail -f /root/trump-fun-agent/run-pool-creation-agent.log
tail -f /root/trump-fun-agent/run-bet-grading-agent.log
```

## Debugging with LangSmith

LangSmith provides tracing that shows inputs and outputs for each node in the agent graph. Credentials for this service are available in the project Notion.

You can also use LangGraph Studio to visualize agent workflows locally, though notebooks may provide better performance for development and testing.

## Agent Architecture

The agents use a directed graph architecture with:
- State management for tracking agent progress
- Multiple specialized tools for different tasks
- Error handling and retry mechanisms
- Blockchain integration for on-chain actions

## Social Media

- Twitter: [@realTrumpFun](https://x.com/realTrumpFun)
- Truth Social: [@realDonaldTrump](https://truthsocial.com/@realDonaldTrump)
- Telegram: [trump_fun_bot](https://t.me/trump_fun_bot)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
