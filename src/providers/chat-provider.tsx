"use client"

import { GatewayModel } from "@/lib/ai/models";
import { AskUserToolPart, ChatUIMessage, ProposeGoalTreeToolPart } from "@/tools";
import { useChat } from "@ai-sdk/react"
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useAtom } from "jotai/react";
import React from "react";
import { createContext } from "react";
import { atom } from "jotai";

export const assistantHistoryAtom = atom<{ id: string, messages: ChatUIMessage[] }>();

type ChatContextValue = ReturnType<typeof useChat<ChatUIMessage>> & {

    models: GatewayModel[]
    model: string;
    setModel: ( id: string ) => void;
    resolvedModel: string;
    isBusy: boolean;
    lastMessage: ChatUIMessage | undefined;
    pendingQuestion: AskUserToolPart;
    pendingProposal: ProposeGoalTreeToolPart;

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

        () => ({ ...chat, model, setModel, resolvedModel, isBusy, lastMessage, pendingQuestion, pendingProposal, models }),
        [ model, setModel, chat, resolvedModel, isBusy, lastMessage, pendingQuestion, pendingProposal, models ]

    )

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>

}

export const useChatContext = () => {

    const ctx = React.useContext(ChatContext);
    if (!ctx) throw new Error("useChatContext must be inside ChatProvider");
    return ctx;

}