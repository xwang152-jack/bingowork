import { MessageSquare } from 'lucide-react';

interface QuestionRequest {
    id: string;
    question: string;
    options?: string[];
}

interface UserQuestionDialogProps {
    request: QuestionRequest | null;
    onAnswer: (id: string, answer: string) => void;
}

export function UserQuestionDialog({ request, onAnswer }: UserQuestionDialogProps) {
    if (!request) return null;

    const hasOptions = request.options && request.options.length > 0;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white/95 backdrop-blur-md border border-stone-200/60 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-stone-200/60 bg-blue-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 rounded-2xl">
                            <MessageSquare className="text-blue-600" size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-stone-800 tracking-tight">需要您的输入</h3>
                            <p className="text-sm text-stone-500">Agent 需要您的确认或信息</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-stone-700 font-medium mb-4">{request.question}</p>
                    
                    {hasOptions ? (
                        <div className="flex flex-col gap-2">
                            {request.options!.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => onAnswer(request.id, option)}
                                    className="w-full px-4 py-3 bg-white border border-stone-200 hover:bg-stone-50 hover:border-stone-300 text-stone-700 rounded-xl transition-all text-left font-medium"
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    ) : (
                         <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const answer = formData.get('answer') as string;
                                if (answer.trim()) {
                                    onAnswer(request.id, answer);
                                }
                            }}
                            className="flex gap-2"
                         >
                             <input 
                                 name="answer"
                                 type="text" 
                                 className="flex-1 px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                 placeholder="请输入您的回复..."
                                 autoFocus
                                 autoComplete="off"
                             />
                             <button 
                                 type="submit"
                                 className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm shadow-blue-200"
                             >
                                 发送
                             </button>
                         </form>
                    )}
                </div>
            </div>
        </div>
    );
}
