import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  currentLanguage = 'en'
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const isArabicInterface = currentLanguage === 'ar';

  return (
    <div className="clay-card flex flex-col h-[600px] bg-slate-50/70 border border-slate-200/90 rounded-2xl overflow-hidden shadow-neu-sm">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map((m, idx) => {
          const isUser = m.sender === 'patient' || m.sender === 'doctor';
          const isArabic = m.language === 'ar' || /[\u0600-\u06FF]/.test(m.content);

          return (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              dir={isArabic ? 'rtl' : 'ltr'}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs shadow-sm shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-teal-600 text-white rounded-tr-none font-medium'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none font-normal'
                }`}
              >
                {/* Data Provenance Badge */}
                {m.data_provenance && m.data_provenance !== 'PATIENT_REPORTED' && (
                  <div className="text-[9px] uppercase font-bold tracking-wider mb-1 px-1.5 py-0.2 rounded bg-teal-100/80 text-teal-800 inline-block">
                    {m.data_provenance.replace('_', ' ')}
                  </div>
                )}
                <div>{m.content}</div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs shadow-sm shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 italic p-2">
            <Bot className="w-4 h-4 text-teal-600 animate-spin" />
            <span>{isArabicInterface ? 'جاري تحليل المعطيات السريرية...' : 'Analyzing clinical context...'}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isArabicInterface
              ? 'صف الأعراض أو أجب عن السؤال هنا...'
              : 'Type your symptoms or response here...'
          }
          dir={isArabicInterface ? 'rtl' : 'ltr'}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-inner"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="clay-btn px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium text-sm flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
