import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../lib/AuthContext";
import { CreditCard, CheckCircle2, Clock, AlertCircle, Loader2, IndianRupee } from "lucide-react";

const FeesPage = () => {
  const { studentData } = useAuth();
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentData?.id) return;
    setLoading(true);

    const q = query(
      collection(db, "fees"),
      where("studentId", "==", studentData.id)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => {
        const aTime = a.dueDate?.toMillis?.() || 0;
        const bTime = b.dueDate?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setFees(data);
      setLoading(false);
    });

    return () => unsub();
  }, [studentData?.id]);

  const totalPaid = fees.filter((f: any) => f.status === "Paid").reduce((acc: number, f: any) => acc + (f.amount || 0), 0);
  const totalPending = fees.filter((f: any) => f.status !== "Paid").reduce((acc: number, f: any) => acc + (f.amount || 0), 0);
  const overdue = fees.filter((f: any) => {
    if (f.status === "Paid") return false;
    const due = f.dueDate?.toDate ? f.dueDate.toDate() : new Date(f.dueDate || 0);
    return due < new Date();
  });

  const getStatusStyle = (status: string, dueDate: any) => {
    if (status === "Paid") return { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200", label: "Paid", icon: CheckCircle2 };
    const due = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate || 0);
    if (due < new Date()) return { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", label: "Overdue", icon: AlertCircle };
    return { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200", label: "Pending", icon: Clock };
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1e294b] to-[#1e3a8a] rounded-[3rem] p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 scale-150"><CreditCard size={200} /></div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-300 mb-3">Payment Center</p>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Fee Status</h1>
          <p className="text-blue-200 text-sm font-bold">{studentData?.name} · {studentData?.className || "Class"}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Total Paid</p>
          <div className="flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-emerald-500" />
            <h3 className="text-4xl font-black text-emerald-500">{totalPaid.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Total Pending</p>
          <div className="flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-amber-500" />
            <h3 className="text-4xl font-black text-amber-500">{totalPending.toLocaleString()}</h3>
          </div>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Overdue Dues</p>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h3 className="text-4xl font-black text-red-500">{overdue.length}</h3>
          </div>
        </div>
      </div>

      {/* Fee Records */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-10 py-7 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Payment Records</h2>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#1e294b] animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading records...</p>
          </div>
        ) : fees.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-10">
            <div className="w-20 h-20 rounded-[2rem] bg-slate-50 flex items-center justify-center mb-6">
              <CreditCard className="w-10 h-10 text-slate-200" />
            </div>
            <p className="text-lg font-black text-slate-300 uppercase tracking-widest">No fee records found</p>
            <p className="text-xs font-bold text-slate-300 mt-2">Your school has not added any fee records yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {fees.map((fee: any) => {
              const { bg, text, border, label, icon: StatusIcon } = getStatusStyle(fee.status, fee.dueDate);
              const dueDate = fee.dueDate?.toDate ? fee.dueDate.toDate() : new Date(fee.dueDate || 0);
              return (
                <div key={fee.id} className="px-10 py-7 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-[1.5rem] ${bg} ${text} flex items-center justify-center border ${border}`}>
                      <StatusIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-lg uppercase tracking-tight leading-none mb-1">{fee.title || fee.type || "School Fee"}</p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Due: {isNaN(dueDate.getTime()) ? "N/A" : dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-2xl font-black text-slate-800">
                      <IndianRupee className="w-5 h-5" />
                      {(fee.amount || 0).toLocaleString()}
                    </div>
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${bg} ${text} ${border}`}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-xs font-bold text-slate-300 uppercase tracking-widest">
        Contact your school administration for payment queries.
      </p>
    </div>
  );
};

export default FeesPage;
