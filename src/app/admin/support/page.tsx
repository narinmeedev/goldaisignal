'use client';

import React, { useEffect, useState } from 'react';
import { 
  LifeBuoy, 
  Send, 
  Ticket, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  AlertTriangle,
  User,
  Shield,
  Loader2
} from 'lucide-react';

interface Reply {
  sender: 'admin' | 'user';
  message: string;
  timestamp: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  userEmail: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'RESOLVED' | 'CLOSED';
  replies: Reply[];
  createdAt: string;
  updatedAt: string;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New ticket form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('LOW');
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);

  // Reply state
  const [replyMsg, setReplyMsg] = useState('');

  const fetchTickets = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch('/api/support');
      const data = await res.json();
      if (res.ok && data.success) {
        setTickets(data.tickets || []);
      } else {
        setErrorMsg(data.error || 'ไม่สามารถโหลดข้อมูลตั๋วสนับสนุนได้');
      }
    } catch {
      setErrorMsg('ข้อผิดพลาดเครือข่าย ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    // Auto-refresh chat every 10 seconds silently
    const interval = setInterval(() => {
      fetchTickets(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, priority }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubject('');
        setMessage('');
        setPriority('LOW');
        setShowNewTicketForm(false);
        await fetchTickets();
      } else {
        setErrorMsg(data.error || 'ส่งข้อมูลแจ้งเรื่องล้มเหลว');
      }
    } catch {
      setErrorMsg('ส่งเรื่องล้มเหลวเนื่องจากข้อผิดพลาดเครือข่าย');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyMsg.trim()) return;
    setIsReplying(true);

    try {
      const res = await fetch(`/api/support/${selectedTicketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMsg }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReplyMsg('');
        // Instantly update local ticket state to show reply
        setTickets(prevTickets => 
          prevTickets.map(t => 
            t.id === selectedTicketId 
              ? { 
                  ...t, 
                  status: 'OPEN', 
                  replies: [...(t.replies || []), { sender: 'user', message: replyMsg.trim(), timestamp: new Date().toISOString() }] 
                }
              : t
          )
        );
        fetchTickets(true);
      } else {
        alert(data.error || 'ส่งคำตอบกลับล้มเหลว');
      }
    } catch {
      alert('ส่งคำตอบกลับล้มเหลวเนื่องจากปัญหาอินเทอร์เน็ต');
    } finally {
      setIsReplying(false);
    }
  };

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  const getPriorityLabel = (level: string) => {
    switch(level) {
      case 'CRITICAL': return { text: 'ด่วนที่สุด', style: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
      case 'HIGH': return { text: 'ด่วนสูง', style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' };
      case 'MEDIUM': return { text: 'ปานกลาง', style: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
      default: return { text: 'ทั่วไป', style: 'bg-neutral-850 text-neutral-400 border border-neutral-850' };
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 font-sans text-neutral-200 px-4 py-5 sm:px-6 lg:px-8 pb-12">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neutral-950/80 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-amber-250 bg-clip-text text-transparent flex items-center gap-2.5">
            <LifeBuoy className="h-6 w-6 text-amber-500" />
            ศูนย์ความช่วยเหลือและแจ้งปัญหา (Support Desk)
          </h1>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            ติดต่อแอดมินหรือทีมพัฒนาโดยตรงจากหน้าต่างนี้ โดยคำขอของคุณจะถูกนำไปประมวลผลผ่าน Mini SaaS Center ทันที
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => fetchTickets(false)} 
            disabled={isLoading}
            className="p-2.5 bg-neutral-900 border border-white/5 hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-xl transition-all disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewTicketForm(!showNewTicketForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-xs font-bold text-neutral-950 rounded-xl transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus className="h-4 w-4" />
            {showNewTicketForm ? 'ปิดฟอร์มแจ้งเรื่อง' : 'แจ้งปัญหา/ขอความช่วยเหลือ'}
          </button>
        </div>
      </div>

      {/* LINE Contact Quick Support Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-600/5 to-transparent border border-emerald-500/20 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
        <div className="flex gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-400">💬 ติดต่อแอดมินหรือส่งหลักฐานโดยตรงผ่าน LINE (สะดวกรวดเร็วที่สุด)</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              สอบถามข้อมูล ปรับสถานะ ชำระเงิน หรือแจ้งปัญหาโดยตรงผ่าน LINE ไอดี <span className="font-bold text-emerald-400 font-mono">@413aryiz</span>
            </p>
          </div>
        </div>
        <a 
          href="https://line.me/R/ti/p/@413aryiz" 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
        >
          แอดไลน์ @413aryiz
        </a>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-mono text-xs shadow-lg">
          {errorMsg}
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Tickets List & New Ticket Form */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* New Ticket Form (Conditional Overlay/Card) */}
          {showNewTicketForm && (
            <div className="bg-neutral-900/60 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
              <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent" />
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-4 uppercase tracking-wider">
                <Ticket className="h-4 w-4" />
                ส่งคำขอแจ้งเรื่องใหม่
              </h3>
              
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">หัวข้อเรื่อง (Subject)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="เช่น ชำระเงินแล้วแต่ไม่ปรับ PRO, บอทไม่แจ้งเตือนทาง LINE"
                    required
                    className="w-full px-3 py-2 bg-neutral-950/80 border border-neutral-850 rounded-xl text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">ความสำคัญ (Priority)</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-neutral-950/80 border border-neutral-855 border-neutral-850 rounded-xl text-sm focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                  >
                    <option value="LOW">ต่ำ / ข้อเสนอแนะทั่วไป (Low)</option>
                    <option value="MEDIUM">ปานกลาง / ใช้งานติดขัด (Medium)</option>
                    <option value="HIGH">สูง / ฟีเจอร์หลักพัง (High)</option>
                    <option value="CRITICAL">ด่วนที่สุด / เซิร์ฟเวอร์ล่ม (Critical)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 font-mono">รายละเอียดปัญหา (Message)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="โปรดอธิบายรายละเอียดปัญหา รูปแบบขั้นตอนที่เกิดข้อผิดพลาด หรือเวลาที่พบปัญหา..."
                    rows={4}
                    required
                    className="w-full px-3 py-2 bg-neutral-950/80 border border-neutral-850 rounded-xl text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ส่งคำแจ้งเรื่องความช่วยเหลือ'}
                </button>
              </form>
            </div>
          )}

          {/* Tickets Catalog List */}
          <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <MessageSquare className="h-4 w-4 text-cyan-400" />
              ประวัติรายการแจ้งปัญหาของคุณ ({tickets.length})
            </h3>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {tickets.map((t) => {
                const isSelected = selectedTicketId === t.id;
                const { text: priorityText, style: priorityStyle } = getPriorityLabel(t.priority);
                const isOpen = t.status === 'OPEN';
                
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 flex items-start justify-between gap-3 ${
                      isSelected 
                        ? 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.06)]' 
                        : 'bg-neutral-950/40 border-white/5 hover:border-neutral-800 hover:bg-neutral-900/30'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-amber-400' : 'text-neutral-200'}`}>
                          {t.subject}
                        </h4>
                        {isOpen && t.priority === 'CRITICAL' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                        <span>{new Date(t.createdAt).toLocaleDateString('th-TH')}</span>
                        <span>•</span>
                        <span className={t.status === 'RESOLVED' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                          {t.status === 'RESOLVED' ? 'แก้ไขสำเร็จ' : 'รอดำเนินการ'}
                        </span>
                      </div>
                    </div>

                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase whitespace-nowrap shrink-0 ${priorityStyle}`}>
                      {priorityText}
                    </span>
                  </div>
                );
              })}

              {tickets.length === 0 && !isLoading && (
                <div className="py-12 text-center text-xs text-neutral-600 font-mono">
                  ยังไม่มีประวัติการส่งรายการช่วยเหลือเข้ามาในระบบ
                </div>
              )}

              {isLoading && (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-neutral-500 font-mono">
                  <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                  กำลังดึงข้อมูลระบบ...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Conversation Thread View */}
        <div className="lg:col-span-7">
          {selectedTicket ? (
            <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-6 space-y-6 relative overflow-hidden">
              {/* Thread Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-bold text-neutral-100 truncate">{selectedTicket.subject}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
                    <span>ตั๋วรหัส: {selectedTicket.id.substring(0, 8)}</span>
                    <span>•</span>
                    <span>อีเมลติดต่อ: {selectedTicket.userEmail}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    selectedTicket.status === 'RESOLVED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                  }`}>
                    {selectedTicket.status === 'RESOLVED' ? 'แก้ไขเสร็จสิ้น' : 'รอการดำเนินงาน'}
                  </span>
                  
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getPriorityLabel(selectedTicket.priority).style}`}>
                    ความเร่งด่วน: {getPriorityLabel(selectedTicket.priority).text}
                  </span>
                </div>
              </div>

              {/* Chat Thread Area */}
              <div className="space-y-4 pt-1">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">
                  ประวัติการตอบกลับ / กล่องสนทนา (Live Chat Thread)
                </h4>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin flex flex-col">
                  {/* First original issue message */}
                  <div className="flex flex-col items-start space-y-1">
                    <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 font-mono font-bold">
                      <User className="h-2.5 w-2.5 text-neutral-400" />
                      <span>ผู้ใช้งาน (ปัญหาแรกเริ่มที่ส่งแจ้ง)</span>
                      <span>•</span>
                      <span>{new Date(selectedTicket.createdAt).toLocaleTimeString('th-TH')}</span>
                    </div>
                    <div className="bg-neutral-950/80 px-4 py-2.5 border border-white/5 rounded-2xl rounded-tl-none text-xs max-w-[85%] text-neutral-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedTicket.message}
                    </div>
                  </div>

                  {/* Replies Loop */}
                  {selectedTicket.replies?.map((rep, idx) => {
                    const isAdminSender = rep.sender === 'admin';
                    
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col space-y-1 ${isAdminSender ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 font-mono font-bold">
                          {isAdminSender ? (
                            <>
                              <Shield className="h-2.5 w-2.5 text-amber-500 animate-pulse" />
                              <span className="text-amber-400">เจ้าหน้าที่ระบบ (Admin)</span>
                            </>
                          ) : (
                            <>
                              <User className="h-2.5 w-2.5 text-neutral-400" />
                              <span>คุณผู้ใช้งาน</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(rep.timestamp).toLocaleTimeString('th-TH')}</span>
                        </div>
                        
                        <div className={`px-4 py-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed whitespace-pre-wrap font-sans ${
                          isAdminSender
                            ? 'bg-amber-500/10 border border-amber-500/20 rounded-tl-none text-amber-200'
                            : 'bg-neutral-950/85 border border-white/5 rounded-tr-none text-neutral-300'
                        }`}>
                          {rep.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reply Form */}
              {selectedTicket.status !== 'RESOLVED' ? (
                <form onSubmit={handleSendReply} className="space-y-3 pt-4 border-t border-white/5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                      เขียนข้อความคุยกับผู้ดูแลระบบ (Reply message)
                    </label>
                    <textarea
                      value={replyMsg}
                      onChange={(e) => setReplyMsg(e.target.value)}
                      placeholder="พิมพ์ข้อความตอบกลับเพื่ออธิบายปัญหาเพิ่มเติม หรือยืนยันเมื่อบั๊กได้รับการแก้ไขแล้ว..."
                      rows={3}
                      required
                      className="w-full px-3 py-2.5 bg-neutral-950 border border-white/5 rounded-xl text-xs placeholder-neutral-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isReplying}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-xs font-bold text-neutral-950 rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                    >
                      {isReplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send size={12} />}
                      ส่งข้อความ
                    </button>
                  </div>
                </form>
              ) : (
                <div className="pt-6 border-t border-white/5 flex items-center justify-center gap-2.5 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 text-emerald-400 text-xs font-bold animate-pulse">
                  <CheckCircle2 size={16} />
                  เรื่องร้องขอความช่วยเหลือนี้ได้รับการแก้ไขและทำเครื่องหมายเสร็จสิ้นแล้ว
                </div>
              )}
            </div>
          ) : (
            <div className="h-[350px] bg-neutral-900/20 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-8">
              <div className="h-12 w-12 bg-neutral-900 border border-white/5 rounded-xl flex items-center justify-center text-neutral-600 mb-4 animate-pulse">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-neutral-300">กล่องดูรายละเอียดสนทนา</h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1.5 leading-relaxed">
                กรุณาคลิกเลือกรายการแจ้งคำขอที่อยู่ในลิสต์ด้านซ้ายมือ เพื่อเปิดดูประวัติแชทและเขียนคำตอบกลับถึงผู้ดูแลระบบแบบสดๆ
              </p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
