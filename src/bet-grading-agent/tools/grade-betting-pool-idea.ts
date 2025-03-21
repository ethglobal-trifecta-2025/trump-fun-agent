import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { config } from "../../config";
import type { GraderState, PendingPool } from "../betting-grader-graph";

export interface BettingPoolIdeaGraderOutput {
  result: string;
  result_code: number;
  probabilities?: Record<string, number>;
  sources: string[];
  explanation: string;
  time_period_analysis?: {
    period_mentioned?: string;
    period_has_passed: boolean;
    official_results_available: boolean;
  };
}

const gradingSysMsg = new SystemMessage(
  `You are a betting pool idea grader with expertise in data analysis and probability assessment.
        
        Your task is to:
        1. Understand the EXACT time period being asked about in the question
        2. Determine if that time period has already passed, regardless of the pool's decision date
        3. Review the provided evidence and evaluate its relevance and reliability
        4. Make a decision based on official/verifiable results when available
        
        IMPORTANT TIME HANDLING: 
        - First, identify the specific time period in the question (e.g., "Q1 2024", "January 2024")
        - If that time period has passed:
          * Look for official results/data for that specific period
          * If official results are available, use them to make a decision regardless of the pool's decision date
          * If official results aren't available yet, return "not resolved yet"
        - If the time period hasn't passed yet:
          * Always return "not resolved yet"
          * Analyze the time period to determine the next date and time to check for official results
        
        DECISION GUIDELINES:
        - Return "option A" or "option B" if:
          * The time period has passed AND
          * Official results are available AND
          * The evidence clearly shows which option is correct
        - Return "not resolved yet" if:
          * The time period hasn't passed yet OR
          * Official results aren't available yet
        - Return "push" if:
          * The time period has passed AND
          * Official results show neither option is correct
        
        EVIDENCE EVALUATION:
        - Prioritize official company reports/announcements
        - Consider reliable third-party verification
        - Require multiple sources for confirmation
        - Check source dates to ensure they cover the correct time period
        
        Your response must be ONLY a JSON object with these fields:
        {
            "result": "", // "not resolved yet", "option A", "option B", or "push"
            "probabilities": {
                // Probabilities for each option
            },
            "sources": [
                // URLs of sources used
            ],
            "explanation": "", // Include the time period analysis in your explanation
            "time_period_analysis": { 
                "period_mentioned": "", // e.g., "Q1 2025"
                "period_has_passed": true/false,
                "official_results_available": true/false
            }
        }`
);
/**
 * Grades all non-failed betting pools concurrently based on evidence
 */
export async function gradeBettingPoolIdea(
  state: GraderState
): Promise<Partial<GraderState>> {
  console.log("Grading betting pools based on evidence concurrently");

  if (Object.keys(state.pendingPools).length === 0) {
    console.error("No pending pools to grade");
    return { pendingPools: {} };
  }

  // Process each non-failed pool concurrently
  const pendingPoolsPromises = Object.entries(state.pendingPools).map(
    async ([poolId, pendingPool]) => {
      // Skip pools that have failed or don't have evidence
      if (pendingPool.failed || pendingPool.evidence.length === 0) {
        console.log(`Skipping pool ${poolId} - failed or no evidence`);
        return [
          poolId,
          {
            ...pendingPool,
            failed: true,
          },
        ] as [string, PendingPool];
      }

      // Handle different options formats safely
      let poolOptions = pendingPool.pool.options;

      //TODO One of the few places where we have a limit to number of options hardcoded in a prompt
      const gradingUserMsg = new HumanMessage(
        `EVIDENCE PROVIDED:
        ${JSON.stringify(pendingPool.evidence, null, 2)}

        BETTING POOL DETAILS:
        Question: ${pendingPool.pool.question}
        Options: ${poolOptions.join(", ")}
        
        Option A corresponds to: ${poolOptions[0] || ""}
        Option B corresponds to: ${poolOptions[1] || ""}
        
        CLOSURE CRITERIA:
        ${pendingPool.pool.closureCriteria}
        
        CLOSURE INSTRUCTIONS:
        ${pendingPool.pool.closureInstructions}
        
        CLOSURE DATETIME: ${new Date(pendingPool.pool.betsCloseAt * 1000).toISOString()}
        CURRENT DATETIME: ${new Date().toISOString()}`
      );

      try {
        const resultJson = await config.large_llm.invoke([
          gradingSysMsg,
          gradingUserMsg,
        ]);

        // Parse the result
        let result: BettingPoolIdeaGraderOutput;
        if (typeof resultJson.content === "string") {
          result = JSON.parse(resultJson.content);
        } else {
          result = resultJson.content as any;
        }

        // Determine the result code based on the grading output
        if (result.result === "not resolved yet") {
          result.result_code = 0; // NOT READY TO GRADE
        } else if (result.result === "option A") {
          result.result_code = 1; // Option A
        } else if (result.result === "option B") {
          result.result_code = 2; // Option B
        } else if (result.result === "push") {
          result.result_code = 3; // DRAW
        } else {
          result.result_code = 4; // ERROR
        }

        console.log(`Grading result for pool ${poolId}:`, result);

        // Return updated pool with grading result
        return [
          poolId,
          {
            ...pendingPool,
            gradingResult: {
              result: result.result,
              result_code: result.result_code,
              probabilities: result.probabilities || {},
              sources: result.sources || [],
              explanation: result.explanation || "",
            },
          },
        ] as [string, PendingPool];
      } catch (error) {
        console.error(`Error grading betting pool ${poolId}:`, error);
        return [
          poolId,
          {
            ...pendingPool,
            failed: true,
          },
        ] as [string, PendingPool];
      }
    }
  );

  // Wait for all pools to be processed
  const processedPools = await Promise.all(pendingPoolsPromises);

  // Reconstruct the pendingPools object
  const updatedPendingPools = Object.fromEntries(processedPools);

  return { pendingPools: updatedPendingPools };
}
