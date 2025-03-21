# trump-fun-agent

To install dependencies:

```bash
bun install
```

## Environment Setup

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Required environment variables:
- `TAVILY_API_KEY`: API key for Tavily search
- `OPENAI_API_KEY`: API key for OpenAI
- `ANTHROPIC_API_KEY`: API key for Anthropic

To run:

```bash
bun run index.ts
```

## Testing Trump Agent

### Run the full graph

```bash
bun run test-trump-agent.ts "What's the latest news on my election campaign?"
```

You can also use the npm script:

```bash
bun run test:full "What's the latest news on my election campaign?"
```

### Run a single node 

```bash
bun run test-trump-agent.ts "What's the latest news on my election campaign?" extract_query
```

You can also use the npm script:

```bash
bun run test:node "What's the latest news on my election campaign?" extract_query
```

You can replace `extract_query` with any of the following nodes:
- `extract_query`: Extracts search query from user input
- `search`: Performs search using Tavily with the extracted query
- `respond`: Generates response in Trump's style based on search results

This project was created using `bun init` in bun v1.2.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Commands

[Generate types from Supabase table](https://supabase.com/docs/guides/api/rest/generating-types) (project id is in [.env.example](.env.example)):

```bash
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema trifecta > src/database.types.ts  
```
