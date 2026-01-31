import { useState, useEffect } from 'react';

interface QuestionRequest {
    id: string;
    question: string;
    options?: string[];
}

export function useUserQuestions() {
    const [pendingQuestion, setPendingQuestion] = useState<QuestionRequest | null>(null);

    useEffect(() => {
        const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
            const request = args[0] as QuestionRequest;
            console.log('[UserQuestion] Received question:', request);
            setPendingQuestion(request);
        };
        const cleanup = window.ipcRenderer.on('agent:user-question', handler);
        return cleanup;
    }, []);

    const handleAnswer = (id: string, answer: string) => {
        console.log('[UserQuestion] Sending answer:', id, answer);
        window.ipcRenderer.invoke('agent:user-question-response', { id, answer });
        setPendingQuestion(null);
    };

    return { pendingQuestion, handleAnswer };
}
