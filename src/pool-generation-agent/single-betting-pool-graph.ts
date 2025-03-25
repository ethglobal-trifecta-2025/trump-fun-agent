/**
 *
 * IMPORTANT: THIS ANNOTATION IS NOT BEING USED RIGHT NOW, DO NOT MODIFY IF YOU'RE DEALING WITH A PRODUCTION ISSUE
 * IT'S A STARTING POINT TO TRAIN OTHER TEAM MEMBERS ON THE AGENT CODE
 * Feel free to modify, just make sure the other agent code runs before deploying
 *
 * Learning session scheduled for Mar. 26th.
 * Please remove this comment after the single research subgraph is fully implemented
 */
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import type { BettingChainConfig } from "../config";
import { DEFAULT_CHAIN_ID, config } from "../config";
import type { ResearchItem } from "../types/research-item";

export const SingleResearchItemAnnotation = Annotation.Root({
  targetTruthSocialAccountId: Annotation<string>,
  chainConfig: Annotation<BettingChainConfig>({
    value: (curr, update) => update,
    default: () => config.chainConfig[DEFAULT_CHAIN_ID],
  }),
  research: Annotation<ResearchItem>({
    reducer: (curr, update) => {
      // If current item is empty, return the update
      if (!curr.truth_social_post?.id) return update;

      // If update item is empty, return current
      if (!update.truth_social_post?.id) return curr;

      // If IDs match, merge the items
      if (curr.truth_social_post.id === update.truth_social_post.id) {
        return {
          ...curr,
          ...update,
          transaction_hash: update.transaction_hash || curr.transaction_hash,
          pool_id: update.pool_id || curr.pool_id,
        };
      }

      // If IDs don't match, return the update as it's a new item
      return update;
    },
    default: () => ({
      truth_social_post: {
        id: "",
        created_at: new Date().toISOString(),
        in_reply_to_id: null,
        quote_id: null,
        in_reply_to_account_id: null,
        sensitive: false,
        spoiler_text: "",
        visibility: "public",
        language: "en",
        uri: "",
        url: "",
        content: "",
        account: {
          id: "",
          username: "",
          acct: "",
          display_name: "",
          locked: false,
          bot: false,
          discoverable: false,
          group: false,
          created_at: new Date().toISOString(),
          note: "",
          url: "",
          avatar: "",
          avatar_static: "",
          header: "",
          header_static: "",
          followers_count: 0,
          following_count: 0,
          statuses_count: 0,
          last_status_at: new Date().toISOString(),
          verified: false,
          location: "",
          website: "",
          unauth_visibility: false,
          chats_onboarded: false,
          feeds_onboarded: false,
          accepting_messages: false,
          show_nonmember_group_statuses: null,
          emojis: [],
          fields: [],
          tv_onboarded: false,
          tv_account: false,
        },
        media_attachments: [],
        mentions: [],
        tags: [],
        card: null,
      },
      should_process: false,
      transaction_hash: null,
      pool_id: null,
    }),
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
});

export type SingleResearchItemState = typeof SingleResearchItemAnnotation.State;
