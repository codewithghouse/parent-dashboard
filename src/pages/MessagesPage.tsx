import { useState, useEffect } from "react";
import { Phone, Video, MoreVertical, Paperclip, Smile, Send, Languages, Sparkles, CheckCheck, Loader2 } from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";

const conversations = [
  { initials: "PP", name: "Mrs. Priya Patel", preview: "Thank you for your response...", time: "2h ago", color: "bg-indigo-600", unread: true },
  { initials: "RK", name: "Mr. Rajesh Kumar", preview: "The Science project guidelines...", time: "1d ago", color: "bg-emerald-600", unread: false },
  { initials: "SG", name: "Ms. Sunita Gupta", preview: "Aditya's essay was well written...", time: "2d ago", color: "bg-amber-600", unread: false },
  { initials: "AD", name: "Admin Office", preview: "Fee payment reminder for Q4...", time: "3d ago", color: "bg-slate-600", unread: false },
];

const initialMessages = [
  { from: "teacher", initials: "PP", text: "Hello Mr. Sharma, I wanted to share some good news about Aditya's recent performance in Mathematics. He's been doing exceptionally well!", time: "10:30 AM" },
  { from: "parent", text: "That's wonderful to hear! Thank you for letting me know. What specifically has improved?", time: "11:00 AM" },
  { from: "teacher", initials: "PP", text: "His test scores have improved from 78% to 92%, and he's much more confident in class.", time: "11:15 AM" },
];

const MessagesPage = () => {
  const [activeChat, setActiveChat] = useState(0);
  const [message, setMessage] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>(["Thanks for the update!", "Will check it out.", "Great to hear!"]);

  useEffect(() => {
    // Mimic smart reply generation
    const lastMsg = initialMessages[initialMessages.length - 1].text;
    const fetchSuggestions = async () => {
       const result = await ParentAIController.getMessageIntelligence({ content: lastMsg });
       if (result.status === "success") {
          setAiSuggestions(result.data.reply_suggestions);
       }
    };
    fetchSuggestions();
  }, [activeChat]);

  const handleTranslate = async () => {
    if (!message) return;
    setIsTranslating(true);
    try {
      const result = await ParentAIController.getMessageIntelligence({ content: message, mode: "translate" });
      if (result.status === "success" && result.data.translation) {
        setMessage(result.data.translation.content);
      }
    } finally {
      setIsTranslating(false);
    }
  };

  return (
      <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-140px)] bg-white rounded-[2.5rem] border-2 border-slate-50 overflow-hidden shadow-2xl animate-in fade-in duration-700">
        
        {/* Conversations List */}
        <div className="lg:col-span-4 border-r-2 border-slate-50 flex flex-col bg-slate-50/30">
          <div className="p-8 border-b-2 border-slate-50 bg-white/50 backdrop-blur-md">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Messages</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">4 Active Conversations</p>
          </div>
          <div className="flex-1 overflow-auto scrollbar-hide py-4 px-3 space-y-2">
            {conversations.map((c, i) => (
              <button key={c.name} onClick={() => setActiveChat(i)}
                className={`w-full flex items-center gap-4 p-5 rounded-[1.5rem] text-left transition-all ${
                  i === activeChat ? "bg-white shadow-lg shadow-slate-200/50 scale-[1.02]" : "hover:bg-white/60"
                }`}>
                <div className={`w-12 h-12 rounded-[1rem] ${c.color} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-lg`}>{c.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-black text-slate-800 truncate">{c.name}</p>
                    <span className="text-[10px] font-bold text-slate-400">{c.time}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 truncate">{c.preview}</p>
                </div>
                {c.unread && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-8 flex flex-col bg-white">
          {/* Chat Header */}
          <div className="px-8 py-6 border-b-2 border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className={`w-12 h-12 rounded-[1rem] ${conversations[activeChat].color} flex items-center justify-center text-white text-sm font-black shadow-xl`}>
                 {conversations[activeChat].initials}
               </div>
               <div>
                 <p className="text-base font-black text-slate-800 leading-tight">{conversations[activeChat].name}</p>
                 <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Now</p>
                 </div>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <button className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><Phone className="w-4 h-4 text-slate-500" /></button>
               <button className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><Video className="w-4 h-4 text-slate-500" /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-8 space-y-8 bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:20px_20px]">
            {initialMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "parent" ? "justify-end" : "justify-start"}`}>
                <div className={`flex items-end gap-3 max-w-[80%] ${msg.from === "parent" ? "flex-row-reverse" : ""}`}>
                  {msg.from === "teacher" && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mb-1">{msg.initials}</div>
                  )}
                  <div className="space-y-1">
                    <div className={`px-5 py-3 rounded-[1.5rem] text-sm font-bold leading-relaxed shadow-sm ${
                      msg.from === "parent"
                        ? "bg-slate-900 text-white rounded-br-none"
                        : "bg-white border text-slate-800 rounded-bl-none"
                    }`}>{msg.text}</div>
                    <div className={`flex items-center gap-2 mt-1 ${msg.from === "parent" ? "justify-end" : ""}`}>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{msg.time}</p>
                       {msg.from === "parent" && <CheckCheck className="w-3 h-3 text-indigo-500" />}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input Area */}
          <div className="p-8 bg-slate-50/50 border-t-2 border-slate-50">
            
            {/* FEATURE 14: Smart Reply Suggestions */}
            <div className="flex flex-wrap gap-2 mb-6">
               <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-3 py-1.5 rounded-lg mr-2">
                  <Sparkles className="w-3 h-3 text-amber-500" /> AI Suggestions:
               </span>
               {aiSuggestions.map((s, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setMessage(s)}
                    className="px-4 py-1.5 bg-white border-2 border-slate-100 hover:border-indigo-100 rounded-xl text-[10px] font-black text-slate-600 hover:text-indigo-600 hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    {s}
                  </button>
               ))}
            </div>

            <div className="flex flex-col gap-4 bg-white rounded-3xl p-4 shadow-xl shadow-slate-200/30 border border-slate-100">
               <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..." 
                  className="w-full bg-transparent border-none px-4 py-2 text-sm font-bold outline-none resize-none h-20 text-slate-800 placeholder:text-slate-300" 
               />
               <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Paperclip className="w-5 h-5" /></button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Smile className="w-5 h-5" /></button>
                    {/* FEATURE 13: AI Message Translator */}
                    <button 
                      onClick={handleTranslate}
                      disabled={isTranslating || !message}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                         isTranslating ? "bg-amber-50 text-amber-600" : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {isTranslating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Languages className="w-3 h-3" />}
                      {isTranslating ? "Translating..." : "Fix Tone / Translate"}
                    </button>
                  </div>
                  <button className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-xl active:scale-95 group">
                    <span>Send Portal</span>
                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
            </div>
            <p className="text-center text-[9px] font-bold text-slate-300 mt-6 uppercase tracking-[0.2em]">All communications are monitored for safety & quality assurance.</p>
          </div>
        </div>
      </div>
  );
};

export default MessagesPage;
