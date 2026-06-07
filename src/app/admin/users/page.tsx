'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield, User as UserIcon, Edit2, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  role: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    role: '',
    subscriptionPlan: '',
    subscriptionStatus: '',
    subscriptionEndsAt: ''
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        setErrorMsg('Failed to load users');
      }
    } catch (err) {
      setErrorMsg('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      const data = await res.json();

      if (res.ok) {
        setUsers([data.user, ...users]);
        setNewEmail('');
        setNewPassword('');
        setNewRole('viewer');
        setShowAddForm(false);
      } else {
        setErrorMsg(data.error || 'Failed to create user');
      }
    } catch (err) {
      setErrorMsg('Network error while creating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      subscriptionPlan: user.subscriptionPlan || 'none',
      subscriptionStatus: user.subscriptionStatus || 'inactive',
      subscriptionEndsAt: user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toISOString().slice(0, 10) : ''
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          role: editForm.role,
          subscriptionPlan: editForm.subscriptionPlan === 'none' ? null : editForm.subscriptionPlan,
          subscriptionStatus: editForm.subscriptionStatus,
          subscriptionEndsAt: editForm.subscriptionEndsAt || null
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...data.user } : u));
        setEditingUser(null);
      } else {
        setErrorMsg(data.error || 'Failed to update user');
      }
    } catch (err) {
      setErrorMsg('Network error while updating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}?`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const getStatusBadge = (user: User) => {
    if (user.role === 'admin') return <span className="text-amber-500 font-bold text-xs uppercase">Admin</span>;
    if (user.subscriptionStatus === 'expired') return <span className="px-2 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-md text-[10px] font-bold uppercase">หมดอายุ</span>;
    if (user.subscriptionStatus === 'pending') return <span className="px-2 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[10px] font-bold uppercase">รอชำระเงิน</span>;
    if (user.subscriptionStatus === 'active') {
      if (user.subscriptionPlan === 'vip') return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-bold uppercase">สมาชิก PRO</span>;
      if (user.subscriptionPlan === 'monthly') return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold uppercase">สมาชิกรายเดือน</span>;
      return <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-bold uppercase">ทดลองใช้งานฟรี</span>;
    }
    return <span className="text-neutral-500 text-[10px]">-</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-500" />
            ระบบผู้ใช้งาน (User Management)
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            จัดการบัญชีผู้ใช้งาน และสิทธิ์การเข้าถึงระบบ
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-xl text-sm font-medium text-neutral-200 transition-all"
        >
          <UserPlus className="h-4 w-4 text-amber-500" />
          {showAddForm ? 'ยกเลิก' : 'เพิ่มผู้ใช้งานใหม่'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-mono">
          {errorMsg}
        </div>
      )}

      {showAddForm && (
        <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
          <h2 className="text-lg font-bold text-neutral-100 mb-4">สร้างบัญชีใหม่</h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 uppercase font-mono tracking-wider">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                placeholder="friend@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 uppercase font-mono tracking-wider">Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5 uppercase font-mono tracking-wider">Role</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
              >
                <option value="viewer">Viewer (ผู้ใช้ทั่วไป)</option>
                <option value="admin">Admin (ผู้ดูแลระบบ)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'กำลังสร้าง...' : 'บันทึก'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-neutral-500 font-mono animate-pulse">Loading users...</div>
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left text-sm text-neutral-300">
            <thead className="bg-neutral-950/50 text-xs uppercase text-neutral-500 font-mono">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Expires</th>
                <th className="px-6 py-4 font-semibold">Joined At</th>
                <th className="px-6 py-4 font-semibold">Last Active</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-800/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700">
                        <UserIcon className="h-4 w-4 text-neutral-400" />
                      </div>
                      <span className="font-medium text-neutral-200">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border ${
                      user.role === 'admin' 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(user)}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-neutral-500">
                    {user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-neutral-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-neutral-500">
                    {user.lastLoginAt ? (
                      <span className="text-emerald-400">{new Date(user.lastLoginAt).toLocaleString()}</span>
                    ) : (
                      <span className="text-neutral-600 italic">Never logged in</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(user)}
                        className="p-2 text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                        title="Edit user"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={user.email === 'admin@goldsignal.ai'}
                        className="p-2 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
                        title={user.email === 'admin@goldsignal.ai' ? "Cannot delete master admin" : "Delete user"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-neutral-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-100">แก้ไขข้อมูลผู้ใช้</h3>
              <button onClick={() => setEditingUser(null)} className="p-2 text-neutral-400 hover:text-white rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">อีเมลผู้ใช้งาน</label>
                <div className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-500 font-mono">
                  {editingUser.email}
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">ระดับสิทธิ์ (Role)</label>
                <select
                  value={editForm.role}
                  onChange={e => setEditForm({...editForm, role: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="viewer">Viewer (ผู้ใช้ทั่วไป)</option>
                  <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">ประเภทแพ็กเกจ (Plan)</label>
                <select
                  value={editForm.subscriptionPlan}
                  onChange={e => setEditForm({...editForm, subscriptionPlan: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="none">ไม่มีแพ็กเกจ (None)</option>
                  <option value="trial">ทดลองใช้งานฟรี (Trial)</option>
                  <option value="monthly">สมาชิกรายเดือน (Monthly)</option>
                  <option value="vip">สมาชิก PRO (ไม่จำกัดเวลา)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">สถานะ (Status)</label>
                <select
                  value={editForm.subscriptionStatus}
                  onChange={e => setEditForm({...editForm, subscriptionStatus: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="inactive">ไม่ได้ใช้งาน (Inactive)</option>
                  <option value="pending">รอตรวจสอบชำระเงิน (Pending)</option>
                  <option value="active">ใช้งานปกติ (Active)</option>
                  <option value="expired">หมดอายุ (Expired)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">วันหมดอายุแพ็กเกจ (Ends At)</label>
                <input
                  type="date"
                  value={editForm.subscriptionEndsAt}
                  onChange={e => setEditForm({...editForm, subscriptionEndsAt: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/50 [color-scheme:dark]"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
