FROM langchain/langgraphjs-api:20
ADD . /deps/trump-fun-agent
ENV LANGSERVE_GRAPHS='{"pool-creation-agent":"./src/pool-generation-agent/betting-pool-graph.ts:bettingPoolGeneratorGraph"}'
WORKDIR /deps/trump-fun-agent
RUN npm ci
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts