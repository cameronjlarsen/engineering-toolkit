import { describe, expect, it } from "bun:test";
import { parseAppOutput, reportedModelMatches } from "./parse-output.ts";

describe("parseAppOutput", () => {
  it("extracts Claude text, model, usage, cost, and session", () => {
    const parsed = parseAppOutput(
      "claude-code",
      JSON.stringify({
        result: "CLAUDE_OK",
        session_id: "claude-session",
        usage: { input_tokens: 10, output_tokens: 3 },
        total_cost_usd: 0.05,
        modelUsage: { "claude-fable-9-9": { inputTokens: 10 } },
      }),
      "",
      "fable"
    );
    expect(parsed).toMatchObject({
      text: "CLAUDE_OK",
      reportedModel: "claude-fable-9-9",
      sessionId: "claude-session",
      usage: { inputTokens: 10, outputTokens: 3 },
      costUsd: 0.05,
    });
  });

  it("extracts Cursor's JSON result without inventing a provider-reported model", () => {
    const parsed = parseAppOutput(
      "cursor",
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 12,
        duration_api_ms: 12,
        result: "CURSOR_OK",
        session_id: "cursor-session",
        request_id: "req-1",
        usage: { inputTokens: 40, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 1 },
      }),
      "",
      "grok-4.7"
    );
    expect(parsed).toEqual({
      text: "CURSOR_OK",
      reportedModel: null,
      sessionId: "cursor-session",
      usage: {
        inputTokens: 40,
        cachedInputTokens: 2,
        cacheCreationInputTokens: 1,
        outputTokens: 5,
        reasoningTokens: undefined,
        totalTokens: undefined,
      },
      costUsd: null,
    });
  });

  it("rejects a Cursor error result", () => {
    expect(() =>
      parseAppOutput(
        "cursor",
        JSON.stringify({ type: "result", subtype: "error", is_error: true, result: "boom" }),
        "",
        "grok-4.7"
      )
    ).toThrow("cursor reported an error result");
  });

  it("extracts Codex JSONL without inventing a provider-reported model", () => {
    const parsed = parseAppOutput(
      "codex",
      [
        JSON.stringify({ type: "thread.started", thread_id: "codex-session" }),
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "CODEX_OK" },
        }),
        JSON.stringify({
          type: "turn.completed",
          usage: {
            input_tokens: 20,
            cached_input_tokens: 4,
            output_tokens: 5,
            reasoning_output_tokens: 2,
          },
        }),
      ].join("\n"),
      "model: gpt-5.6-sol\nreasoning effort: max\n",
      "gpt-5.6-sol"
    );
    expect(parsed).toMatchObject({
      text: "CODEX_OK",
      reportedModel: null,
      sessionId: "codex-session",
      usage: {
        inputTokens: 20,
        cachedInputTokens: 4,
        outputTokens: 5,
        reasoningTokens: 2,
      },
    });
  });

  it("accepts Grok's reported build suffix", () => {
    const parsed = parseAppOutput(
      "grok",
      [
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: "progress" }] },
        }),
        JSON.stringify({
          type: "result",
          subtype: "success",
          is_error: false,
          result: "GROK_OK",
          session_id: "grok-session",
          usage: {
            input_tokens: 30,
            cache_read_input_tokens: 6,
            output_tokens: 7,
            reasoning_tokens: 3,
            total_tokens: 43,
          },
          total_cost_usd: 0.02,
          modelUsage: { "grok-4.6-build": {} },
        }),
      ].join("\n"),
      "",
      "grok-4.6"
    );
    expect(parsed.text).toBe("GROK_OK");
    expect(parsed.reportedModel).toBe("grok-4.6-build");
    expect(reportedModelMatches("grok", "grok-4.6", parsed.reportedModel)).toBe(
      true
    );
  });

  it("selects the requested Claude model when usage includes a side model", () => {
    const parsed = parseAppOutput(
      "claude-code",
      JSON.stringify({
        result: "CLAUDE_OK",
        modelUsage: {
          "claude-haiku-4-5-20251001": {},
          "claude-fable-9-9": {},
        },
      }),
      "",
      "fable"
    );
    expect(parsed.reportedModel).toBe("claude-fable-9-9");
  });

  it("matches only concrete Claude revisions from the requested rolling family", () => {
    expect(reportedModelMatches("claude-code", "fable", "claude-fable-9-9")).toBe(true);
    expect(reportedModelMatches("claude-code", "opus", "claude-opus-9")).toBe(true);
    expect(reportedModelMatches("claude-code", "fable", "claude-opus-9")).toBe(false);
    expect(reportedModelMatches("claude-code", "fable", "claude-fable-beta")).toBe(false);
    expect(reportedModelMatches("claude-code", "fable", "fable")).toBe(false);
    expect(reportedModelMatches("claude-code", "fable", "fable-preview")).toBe(false);
    expect(reportedModelMatches("grok", "fable", "claude-fable-9-9")).toBe(false);
  });

  it("rejects malformed or textless responses", () => {
    expect(() =>
      parseAppOutput("claude-code", "not-json", "", "fable")
    ).toThrow("valid JSON");
    expect(() =>
      parseAppOutput(
        "codex",
        JSON.stringify({ type: "turn.completed" }),
        "",
        "gpt-5.6-sol"
      )
    ).toThrow("final agent message");
  });
});
