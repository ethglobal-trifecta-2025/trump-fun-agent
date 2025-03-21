//TODO This tool is stupid, where did I go wrong to have to create such a stupid tool?
import type { AgentState } from "../betting-pool-graph";

//Take the last message from the messages array and set it as the originalMessage
export const setOriginalMessageFunction = async (
  state: AgentState
): Promise<AgentState> => {
  const messages = state.messages;

  if (messages.length === 0) {
    return {
      ...state,
      originalMessage: "",
    };
  }

  // We checked messages.length above, so we know this is safe
  const lastMessage = messages[messages.length - 1]!;
  const content =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  return {
    ...state,
    originalMessage: content,
  };
};
