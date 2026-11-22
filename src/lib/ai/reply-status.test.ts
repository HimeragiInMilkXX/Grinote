import { describe, expect, it } from "vitest";

import type { ChatUIMessage } from "@/tools";
import { getReplyIssue, readableErrorMessage } from "./reply-status";

type Part = ChatUIMessage["parts"][number];

function assistant( parts: unknown[], metadata?: ChatUIMessage["metadata"] ): ChatUIMessage {
    return { id: "a1", role: "assistant", parts: parts as Part[], metadata };
}

const reasoning = { type: "reasoning", text: "hmm", state: "done" };
const text = ( value: string ) => ({ type: "text", text: value, state: "done" });
const base = { isBusy: false, hasError: false, stoppedByUser: false };

describe( "getReplyIssue", () => {

    it( "is quiet while streaming", () => {
        expect( getReplyIssue({ ...base, isBusy: true, hasError: true, lastMessage: undefined }) ).toBeNull();
    });

    it( "reports an error even when the last message is the user's", () => {
        const user: ChatUIMessage = { id: "u1", role: "user", parts: [ text( "hi" ) as Part ] };
        expect( getReplyIssue({ ...base, hasError: true, lastMessage: user }) ).toBe( "error" );
    });

    it( "is quiet after a user message without an error", () => {
        const user: ChatUIMessage = { id: "u1", role: "user", parts: [ text( "hi" ) as Part ] };
        expect( getReplyIssue({ ...base, lastMessage: user }) ).toBeNull();
    });

    it( "tells a stop from an interruption when no finish arrived", () => {
        const message = assistant( [ reasoning ] );
        expect( getReplyIssue({ ...base, lastMessage: message }) ).toBe( "interrupted" );
        expect( getReplyIssue({ ...base, stoppedByUser: true, lastMessage: message }) ).toBe( "stopped" );
    });

    it( "reports an empty reply when only reasoning came back", () => {
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ reasoning, text( "  " ) ], { finishReason: "stop" } ) }) ).toBe( "empty" );
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ reasoning ], { finishReason: "length" } ) }) ).toBe( "empty" );
    });

    it( "reports truncated text", () => {
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ text( "Step 1…" ) ], { finishReason: "length" } ) }) ).toBe( "length" );
    });

    it( "reports the step limit, but not while ask_user waits", () => {
        const tool = { type: "tool-get_graph_info", toolCallId: "t1", state: "output-available", input: {}, output: {} };
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ tool ], { finishReason: "tool-calls" } ) }) ).toBe( "step-limit" );

        const ask = { type: "tool-ask_user", toolCallId: "t2", state: "input-available", input: {} };
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ ask ], { finishReason: "tool-calls" } ) }) ).toBeNull();
    });

    it( "is quiet for a normal reply or a tool-only reply", () => {
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ reasoning, text( "Done." ) ], { finishReason: "stop" } ) }) ).toBeNull();
        const tool = { type: "tool-propose_goal_tree", toolCallId: "t1", state: "output-available", input: {}, output: {} };
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ tool ], { finishReason: "stop" } ) }) ).toBeNull();
    });

    it( "treats a finish with reason error as an interruption", () => {
        expect( getReplyIssue({ ...base, lastMessage: assistant( [ reasoning ], { finishReason: "error" } ) }) ).toBe( "interrupted" );
    });

});

describe( "readableErrorMessage", () => {

    it( "unwraps a JSON route error", () => {
        expect( readableErrorMessage( new Error( "{\"error\":\"Model x is not available.\"}" ) ) ).toBe( "Model x is not available." );
    });

    it( "keeps a plain message", () => {
        expect( readableErrorMessage( new Error( "AIサーバーに接続できません。" ) ) ).toBe( "AIサーバーに接続できません。" );
        expect( readableErrorMessage( undefined ) ).toBeUndefined();
    });

});
