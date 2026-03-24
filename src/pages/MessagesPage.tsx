import { useState, useEffect } from "react";
import { Phone, Video, MoreVertical, Paperclip, Smile, Send, Languages, Sparkles, CheckCheck, Loader2, MessageSquare, Info } from "lucide-react";
import { ParentAIController } from "../ai/controller/ai-controller";
import { useAuth } from "@/lib/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";

const MessagesPage = () => {
  const { studentData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChatIdx, setActiveChatIdx] = useState(0);
  const [message, setMessage] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>(["Thanks for the update!", "Will check it out.", "Great to hear!"]);

  const activeChat = conversations[activeChatIdx];

  useEffect(() => {
    if (!studentData?.id) return;

    setLoading(true);
    // In a real app, we'd have a 'conversations' collection. 
    // Here we'll group from 'communications' or assume a simple structure.
    const q = query(
      collection(db, "parent_notes"),
      where("studentName", "==", studentData.name)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        let timeLabel = "Recent";
        try {
          if (d.createdAt) timeLabel = d.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch(e) {}
        return { id: doc.id, ...d, time: timeLabel };
      });
      data.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setConversations(data);
      setLoading(false);
    }, (error) => {
      console.error("Messages Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentData]);

  useEffect(() => {
    if (activeChat?.content) {
      const fetchSuggestions = async () => {
         const result = await ParentAIController.getMessageIntelligence({ content: activeChat.content });
         if (result.status === "success") {
            setAiSuggestions(result.data.reply_suggestions);
         }
      };
      fetchSuggestions();
    }
  }, [activeChatIdx, conversations]);

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

  const handleSendMessage = async () => {
    if (!message.trim() || !studentData) return;
    
    // In a real app, send to 'communications' or 'messages'
    try {
        await addDoc(collection(db, "parent_notes"), {
            teacherId: activeChat?.teacherId || "unknown", // Reply to the specific teacher
            teacherName: activeChat?.teacherName || "Institution",
            studentId: studentData.id || "unknown",
            studentName: studentData.name,
            parentName: studentData.parentName || `Parent of ${studentData.name}`,
            subject: `Reply: ${activeChat?.subject || "Update"}`,
            content: message,
            status: "Pending Reply", // the teacher now needs to reply
            type: "Received", // teacher will see this as "Received"
            from: "parent",
            createdAt: serverTimestamp()
        });
        setMessage("");
    } catch (e) {
        console.error("Failed to send message:", e);
    }
  };

  return (
      <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-140px)] bg-white rounded-[2.5rem] border-2 border-slate-50 overflow-hidden shadow-2xl animate-in fade-in duration-700">
        
        {/* Conversations List */}
        <div className="lg:col-span-4 border-r-2 border-slate-50 flex flex-col bg-slate-50/30">
          <div className="p-8 border-b-2 border-slate-50 bg-white/50 backdrop-blur-md">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Portal Chat</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{conversations.length} Active Threads</p>
          </div>
          
          <div className="flex-1 overflow-auto scrollbar-hide py-4 px-3 space-y-2">
            {loading ? (
                <div className="py-20 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                </div>
            ) : conversations.length === 0 ? (
                <div className="py-20 text-center px-6">
                    <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Active Conversations</p>
                </div>
            ) : (
                conversations.map((c, i) => (
                    <button key={c.id} onClick={() => setActiveChatIdx(i)}
                      className={`w-full flex items-center gap-4 p-5 rounded-[1.5rem] text-left transition-all ${
                        i === activeChatIdx ? "bg-white shadow-lg shadow-slate-200/50 scale-[1.02]" : "hover:bg-white/60"
                      }`}>
                      <div className={`w-12 h-12 rounded-[1rem] bg-indigo-600 flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-lg`}>
                        {c.teacher?.substring(0, 2).toUpperCase() || c.parent?.substring(0, 2).toUpperCase() || "T"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-black text-slate-800 truncate">{c.teacherName || c.parentName || "Faculty"}</p>
                          <span className="text-[10px] font-bold text-slate-400">{c.time}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 truncate">{c.content || c.subject}</p>
                      </div>
                      {c.unread && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />}
                    </button>
                ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-8 flex flex-col bg-white">
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                <div className="w-24 h-24 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-sm">
                    <MessageSquare className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">Select a Thread</h3>
                <p className="text-sm font-bold text-slate-400 max-w-sm leading-relaxed">
                    The feature will work automatically after the faculty sends an update or you start a new conversation.
                </p>
            </div>
          ) : (
            <>
                {/* Chat Header */}
                <div className="px-8 py-6 border-b-2 border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-[1rem] bg-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-xl`}>
                            {activeChat.teacherName?.substring(0, 2).toUpperCase() || "T"}
                        </div>
                        <div>
                            <p className="text-base font-black text-slate-800 leading-tight">{activeChat.teacherName || "Faculty"}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Institution Online</p>
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
                    <div className={`flex ${activeChat.from === "parent" ? "justify-end" : "justify-start"}`}>
                        <div className={`flex items-end gap-3 max-w-[80%] ${activeChat.from === "parent" ? "flex-row-reverse" : ""}`}>
                            {activeChat.from !== "parent" && (
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mb-1">
                                    {activeChat.teacherName?.substring(0, 2).toUpperCase() || "T"}
                                </div>
                            )}
                            <div className="space-y-1">
                                <div className={`px-5 py-3 rounded-[1.5rem] text-sm font-bold leading-relaxed shadow-sm ${
                                    activeChat.from === "parent"
                                        ? "bg-slate-900 text-white rounded-br-none"
                                        : "bg-white border text-slate-800 rounded-bl-none"
                                }`}>{activeChat.content}</div>
                                <div className={`flex items-center gap-2 mt-1 ${activeChat.from === "parent" ? "justify-end" : ""}`}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{activeChat.time}</p>
                                    {activeChat.from === "parent" && <CheckCheck className="w-3 h-3 text-indigo-500" />}
                                </div>
                            </div>
                        </div>
                    </div>
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
                                className="px-4 py-1.5 bg-white border-2 border-slate-100 hover:border-indigo-100 rounded-xl text-[10px] font-black text-slate-600 hover:text-indigo-600 hover:shadow-md transition-all"
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
                                    {isTranslating ? "Processing AI..." : "Fix Tone / Translate"}
                                </button>
                            </div>
                            <button 
                                onClick={handleSendMessage}
                                className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-xl active:scale-95"
                            >
                                <span>Send Portal</span>
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </>
          )}
        </div>
      </div>
  );
};

export default MessagesPage;
