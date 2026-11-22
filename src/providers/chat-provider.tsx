"use client"

import { GatewayModel } from "@/lib/ai/models";
import { AskUserToolPart, ChatUIMessage, ProposeGoalTreeToolPart } from "@/tools";
import { useChat } from "@ai-sdk/react"
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useAtom } from "jotai/react";
import React from "react";
import { createContext } from "react";
import { atom } from "jotai";
import { useStallDetector } from "@/hooks/useStallDetector";
import { getReplyIssue, type ReplyIssue } from "@/lib/ai/reply-status";

export const assistantHistoryAtom = atom<{ id: string, messages: ChatUIMessage[] }>();

type ChatContextValue = ReturnType<typeof useChat<ChatUIMessage>> & {

    models: GatewayModel[]
    model: string;
    setModel: ( id: string ) => void;
    resolvedModel: string;
    isBusy: boolean;
    lastMessage: ChatUIMessage | undefined;
    pendingQuestion: AskUserToolPart | undefined;
    pendingProposal: ProposeGoalTreeToolPart | undefined;
    // The user pressed stop during the last request.
    stoppedByUser: boolean;
    // No new chunk arrived for a while during the current request.
    isStalled: boolean;
    dismissStall: () => void;
    // What went wrong with the last turn, if anything (see getReplyIssue).
    replyIssue: ReplyIssue | null;

}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ models, children }: { models: GatewayModel[], children: React.ReactNode }) {

    const [model, setModel] = React.useState(models[0]?.id ?? "")

    const [ assistantHistory, setAssistantHistory ] = useAtom(assistantHistoryAtom);

    const chat = useChat<ChatUIMessage>({
        // Resume the conversation automatically once the user has answered the
        // ask_user questionnaire.
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
        id: assistantHistory?.id,
        messages: assistantHistory?.messages
    })

    const isBusy = chat.status === "submitted" || chat.status === "streaming"

    // Save only when not streaming, instead of on every token
    React.useEffect(() => {
    if (chat.id && !isBusy) {
        setAssistantHistory({ id: chat.id, messages: chat.messages })
    }
    }, [chat.id, chat.messages, isBusy, setAssistantHistory])

    const resolvedModel = models.some((m) => m.id === model)
        ? model
        : (models[0]?.id ?? "")

    const lastMessage = chat.messages.at(-1)

    const [ stoppedByUser, setStoppedByUser ] = React.useState(false)

    React.useEffect(() => {
        if (chat.status === "submitted") setStoppedByUser(false)
    }, [chat.status])

    const { stop: stopChat } = chat
    const stop = React.useCallback(async () => {
        setStoppedByUser(true)
        await stopChat()
    }, [stopChat])

    // Changes whenever anything new streams in (text, reasoning, tool states).
    const stallSignature = isBusy
        ? [
            chat.status,
            chat.messages.length,
            ...(lastMessage?.parts ?? []).map((part) =>
                [
                    part.type,
                    "text" in part ? part.text.length : "",
                    "state" in part ? part.state : "",
                ].join(":")
            ),
        ].join("|")
        : ""

    const { isStalled, dismiss: dismissStall } = useStallDetector(stallSignature, isBusy)

    const replyIssue = getReplyIssue({
        lastMessage,
        isBusy,
        hasError: chat.error != null,
        stoppedByUser,
    })
    const pendingQuestion =
        lastMessage?.role === "assistant"
        ? lastMessage.parts.find(
            (part): part is Extract<typeof part, { type: "tool-ask_user" }> =>
                part.type === "tool-ask_user" &&
                (part.state === "input-streaming" ||
                part.state === "input-available")
            )
        : undefined

    const pendingProposal =
    lastMessage?.role === "assistant"
        ? lastMessage.parts.find(
            (part): part is Extract<
            typeof part,
            {
                type: "tool-propose_goal_tree";
                state: "output-available";
            }
            > =>
            part.type === "tool-propose_goal_tree" &&
            part.state === "output-available"
        )
        : undefined;

    const value = React.useMemo(

        () => ({ ...chat, stop, model, setModel, resolvedModel, isBusy, lastMessage, pendingQuestion, pendingProposal, models, stoppedByUser, isStalled, dismissStall, replyIssue }),
        [ model, setModel, chat, stop, resolvedModel, isBusy, lastMessage, pendingQuestion, pendingProposal, models, stoppedByUser, isStalled, dismissStall, replyIssue ]

    )

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>

}

export const useChatContext = () => {

    const ctx = React.useContext(ChatContext);
    if (!ctx) throw new Error("useChatContext must be inside ChatProvider");
    return ctx;

}