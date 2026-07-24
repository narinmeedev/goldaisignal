'use client';

import React, { useState, useEffect } from 'react';
import { History, Search, ShieldAlert, LogIn, CreditCard, UserPlus } from 'lucide-react';

interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  createdAt: string;
  user: {
    email: string;
  }
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/admin/logs');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        } else {
          setErrorMsg('Failed to load logs');
        }
      } catch (err) {
        setErrorMsg('Network error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <LogIn className="h-4 w-4 text-emerald-500" />;
      case 'REGISTER': return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'SUBMIT_PAYMENT': return <CreditCard className="h-4 w-4 text-amber-500" />;
      case 'PAYMENT_APPROVED': return <ShieldAlert className="h-4 w-4 text-emerald-500" />;
      case 'PAYMENT_REJECTED': return <ShieldAlert className="h-4 w-4 text-rose-500" />;
      default: return <History className="h-4 w-4 text-neutral-500" />;
    }
  };

  const filteredLogs = logs.filter(log => 
    log.user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <History className="h-6 w-6 text-amber-500" />
            ประวัติการใช้งาน (Activity Logs)
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            ตรวจสอบประวัติการล็อคอิน การสมัครสมาชิก และการชำระเงินเพื่อป้องกันข้อพิพาท
          </p>
        </div>
        
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input 
            type="text" 
            placeholder="ค้นหา Email หรือ Action..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm focus:outline-none focus:border-amber-500/50 text-neutral-200 transition-colors"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-mono">
          {errorMsg}
        </div>
      )}

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-neutral-500 font-mono animate-pulse">Loading logs...</div>
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left text-sm text-neutral-300">
            <thead className="bg-neutral-950/50 text-xs uppercase text-neutral-500 font-mono">
              <tr>
                <th className="px-6 py-4 font-semibold">Date / Time</th>
                <th className="px-6 py-4 font-semibold">User Email</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-800/20 transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-neutral-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('th-TH')}
                  </td>
                  <td className="px-6 py-4 font-medium text-neutral-200">{log.user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className="font-mono text-xs font-bold tracking-wider">{log.action}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-neutral-400">{log.details || '-'}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                    No activity logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
