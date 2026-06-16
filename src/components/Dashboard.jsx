import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getDashboardStats, markReminderSent } from '../lib/api';

export default function Dashboard({ setActiveTab, handleGlobalAddBook, searchFilter = '' }) {
  const shouldReduceMotion = useReducedMotion();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifyingId, setNotifyingId] = useState(null);
  const [showOverdueModal, setShowOverdueModal] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { type: 'tween', duration: 0.1 }
        : {
            type: 'spring',
            stiffness: 260,
            damping: 22
          }
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const dashData = await getDashboardStats();
      setStats(dashData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSendReminder = async (item) => {
    try {
      setNotifyingId(item.transaction_id);
      await markReminderSent(item.transaction_id);
      
      // Update local state to show reminder as sent
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          overdueList: prev.overdueList.map(o => 
            o.transaction_id === item.transaction_id 
              ? { ...o, automated_reminder_sent: 1 } 
              : o
          )
        };
      });
    } catch (err) {
      console.error(err);
    } finally {
      setNotifyingId(null);
    }
  };

  const calculateDaysOverdue = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    const diffTime = today - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getOverdueBadgeClass = (days) => {
    if (days >= 10) {
      return 'bg-error text-on-error font-bold shadow-sm';
    } else if (days >= 5) {
      return 'bg-error-container text-error font-bold border border-error/20';
    } else if (days >= 2) {
      return 'bg-error-container/70 text-error font-bold border border-error/20';
    } else {
      return 'bg-surface-variant text-on-surface-variant border border-outline-variant/30';
    }
  };

  if (loading || !stats) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
          <p className="text-xs text-on-surface-variant font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const { metrics, overdueList } = stats;

  const filteredOverdueList = (overdueList || []).filter(item => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      (item.student_name && item.student_name.toLowerCase().includes(q)) ||
      (item.student_id && item.student_id.toLowerCase().includes(q)) ||
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.book_title && item.book_title.toLowerCase().includes(q))
    );
  });

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 text-left"
    >


      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Metric 1: Volume */}
        <motion.div 
          variants={cardVariants}
          className="bg-surface-container-lowest border border-surface-variant rounded-md p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 w-16 h-16 bg-primary/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2">
            <div className="p-1.5 bg-secondary-container rounded-md text-secondary">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>book</span>
            </div>
            <span className="text-outline font-label-md text-[10px] uppercase">Volume</span>
          </div>
          <div>
            <h3 className="font-display-lg text-[24px] leading-tight text-on-surface mb-0.5">
              {metrics.totalBooks ? metrics.totalBooks.toLocaleString() : '0'}
            </h3>
            <p className="font-body-sm text-[11px] text-on-surface-variant">Total Books Volume</p>
          </div>
        </motion.div>

        {/* Metric 2: Active */}
        <motion.div 
          variants={cardVariants}
          className="bg-surface-container-lowest border border-surface-variant rounded-md p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 w-16 h-16 bg-secondary/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2">
            <div className="p-1.5 bg-primary-fixed rounded-md text-primary">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>swap_calls</span>
            </div>
            <span className="text-outline font-label-md text-[10px] uppercase">Active</span>
          </div>
          <div>
            <h3 className="font-display-lg text-[24px] leading-tight text-on-surface mb-0.5">
              {metrics.activeIssues ? metrics.activeIssues.toLocaleString() : '0'}
            </h3>
            <p className="font-body-sm text-[11px] text-on-surface-variant">Active Book Loans</p>
          </div>
        </motion.div>

        {/* Metric 3: Alert */}
        <motion.div 
          variants={cardVariants}
          className="bg-surface-container-lowest border border-surface-variant rounded-md p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 w-16 h-16 bg-error/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2">
            <div className="p-1.5 bg-error-container rounded-md text-error">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            </div>
            <span className="text-error font-label-md text-[10px] uppercase font-bold">Alert</span>
          </div>
          <div>
            <h3 className="font-display-lg text-[24px] leading-tight text-error mb-0.5 font-bold">
              {metrics.totalOverdue ? metrics.totalOverdue.toLocaleString() : '0'}
            </h3>
            <p className="font-body-sm text-[11px] text-on-surface-variant">Overdue Returns Count</p>
          </div>
        </motion.div>

        {/* Metric 4: Pending */}
        <motion.div 
          variants={cardVariants}
          className="bg-surface-container-lowest border border-surface-variant rounded-md p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 w-16 h-16 bg-tertiary/5 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2">
            <div className="p-1.5 bg-tertiary-fixed rounded-md text-tertiary">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
            </div>
            <span className="text-outline font-label-md text-[10px] uppercase">Pending</span>
          </div>
          <div>
            <h3 className="font-display-lg text-[24px] leading-tight text-on-surface mb-0.5">
              ₹{(metrics.totalFines || 0).toLocaleString()}
            </h3>
            <p className="font-body-sm text-[11px] text-on-surface-variant">Total Pending Fines</p>
          </div>
        </motion.div>
      </div>

      {/* Main Layout: 2-Column Split */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Column: Overdue List (70%) */}
        <div className="lg:w-[70%] flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-headline-sm text-[16px] text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-error text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>assignment_late</span>
              Overdue List
            </h3>
            <button 
              onClick={() => setShowOverdueModal(true)}
              className="text-primary font-label-md text-[11px] hover:underline flex items-center gap-1 cursor-pointer"
            >
              View All <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          <div className="bg-surface-container-lowest border border-surface-variant rounded-md shadow-sm overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high border-b border-surface-variant font-label-md text-[10px] text-on-surface-variant uppercase tracking-wider">
                    <th className="py-2 px-3">Student</th>
                    <th className="py-2 px-3">Book Title</th>
                    <th className="py-2 px-3">Due Date</th>
                    <th className="py-2 px-3">Days Overdue</th>
                    <th className="py-2 px-3">Due Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant font-body-sm text-[12px] text-on-surface">
                  <AnimatePresence mode="popLayout">
                    {filteredOverdueList && filteredOverdueList.length > 0 ? (
                      filteredOverdueList.slice(0, 10).map((item) => {
                        const overdueDays = calculateDaysOverdue(item.expected_return_date);
                        return (
                          <motion.tr 
                            key={item.transaction_id}
                            layout={!shouldReduceMotion}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="hover:bg-surface-container-low transition-colors group"
                          >
                            <td className="py-2 px-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-primary">{item.student_name}</span>
                                <span className="font-mono-sm text-[10px] text-on-surface-variant">ID: {item.student_id || `ST-${1000 + item.transaction_id}`}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3">{item.title || item.book_title}</td>
                            <td className="py-2 px-3">
                              {new Date(item.expected_return_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-label-md text-[9px] uppercase ${getOverdueBadgeClass(overdueDays)}`}>
                                {overdueDays} {overdueDays === 1 ? 'Day' : 'Days'}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              ₹{item.fine_amount?.toLocaleString() ?? '0'}
                            </td>
                          </motion.tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-6 text-on-surface-variant font-medium">
                          No overdue books found.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions (30%) */}
        <div className="lg:w-[30%] flex flex-col gap-2">
          <h3 className="font-headline-sm text-[16px] text-primary mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            Quick Actions
          </h3>
          <div className="flex flex-col gap-2">
            {/* Quick Action 1: Add New Title */}
            <button 
              onClick={handleGlobalAddBook}
              className="w-full text-left bg-surface-container-lowest border border-surface-variant rounded-md p-3 shadow-sm hover:shadow-md hover:border-secondary-fixed-dim transition-all group flex items-center gap-3 cursor-pointer"
            >
              <div className="w-8 h-8 rounded bg-secondary-fixed flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <span className="material-symbols-outlined text-[18px]">library_add</span>
              </div>
              <div>
                                <h4 className="font-headline-sm text-[13px] font-semibold text-on-surface group-hover:text-secondary transition-colors m-0">Add New Book</h4>
                <p className="font-body-sm text-[10px] text-on-surface-variant mt-0.5 mb-0">Register new inventory</p>
              </div>
            </button>

            {/* Mini Chart/Stats area to fill space */}
            <div className="bg-surface-container-low rounded-md p-3 border border-surface-variant">
              <h5 className="font-label-md text-[10px] text-on-surface-variant uppercase mb-2 mt-0">Library Overview</h5>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-on-surface">Active Loans</span>
                    <span className="font-medium text-primary">{metrics.activeIssues}</span>
                  </div>
                  <div className="w-full bg-surface-variant rounded-full h-1">
                    <div className="bg-primary h-1 rounded-full" style={{ width: `${Math.min(100, (metrics.activeIssues / Math.max(metrics.totalBooks, 1)) * 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-on-surface">Overdue</span>
                    <span className="font-medium text-error">{metrics.totalOverdue}</span>
                  </div>
                  <div className="w-full bg-surface-variant rounded-full h-1">
                    <div className="bg-error h-1 rounded-full" style={{ width: `${metrics.activeIssues > 0 ? Math.min(100, (metrics.totalOverdue / metrics.activeIssues) * 100) : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OVERDUE LIST POPUP MODAL */}
      <AnimatePresence>
        {showOverdueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOverdueModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-lg p-6 relative z-10 border border-surface-variant shadow-xl text-left flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-4 border-b border-surface-variant pb-2 shrink-0">
                <h3 className="text-base font-bold text-primary flex items-center gap-1.5 m-0">
                  <span className="material-symbols-outlined text-error text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>assignment_late</span>
                  Overdue Library Books
                </h3>
                <button onClick={() => setShowOverdueModal(false)} className="text-on-surface-variant hover:text-primary cursor-pointer bg-transparent border-none flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar pr-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-surface-variant font-label-md text-[10px] text-on-surface-variant uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Book Title</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Days Overdue</th>
                      <th className="py-2.5 px-3">Due Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant font-body-sm text-[12px] text-on-surface">
                    {filteredOverdueList && filteredOverdueList.length > 0 ? (
                      filteredOverdueList.map((item) => {
                        const overdueDays = calculateDaysOverdue(item.expected_return_date);
                        return (
                          <tr 
                            key={item.transaction_id}
                            className="hover:bg-surface-container-low transition-colors"
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-primary">{item.student_name}</span>
                                <span className="font-mono-sm text-[10px] text-on-surface-variant">ID: {item.student_id || `ST-${1000 + item.transaction_id}`}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">{item.title || item.book_title}</td>
                            <td className="py-2.5 px-3">
                              {new Date(item.expected_return_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-label-md text-[9px] uppercase ${getOverdueBadgeClass(overdueDays)}`}>
                                {overdueDays} {overdueDays === 1 ? 'Day' : 'Days'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              ₹{item.fine_amount?.toLocaleString() ?? '0'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-6 text-on-surface-variant font-medium">
                          No overdue books found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4 pt-2 border-t border-surface-variant/40 shrink-0">
                <button
                  onClick={() => setShowOverdueModal(false)}
                  className="px-4 py-1.5 bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container rounded-md font-label-md text-[11px] transition-colors border-none cursor-pointer font-semibold shadow-sm"
                >
                  Close Overdue List
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
