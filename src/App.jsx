import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Dashboard from './components/Dashboard';
import BookCatalog from './components/BookCatalog';
import IssueReturnForm from './components/IssueReturnForm';
import { getDashboardStats, getStudents, getBooks, getIssuedBooks, getStudentTransactions, getStudentFines, getStudentStats, payFine, renewBook, updateStudent } from './lib/api';

// Student Management View Component
function StudentManagement({ 
  students, 
  setStudents,
  loading, 
  setActiveTab, 
  setPrefilledStudent, 
  stats,
  searchFilter = '',
  selectedStudent,
  setSelectedStudent
}) {
  const [studentSearch, setStudentSearch] = useState('');

  // Live data for the selected student
  const [studentTxns, setStudentTxns]       = useState([]);
  const [studentFinesList, setStudentFinesList] = useState([]);
  const [studentStatsData, setStudentStatsData] = useState(null);
  const [studentDataLoading, setStudentDataLoading] = useState(false);

  // Edit student modal states
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editStudentData, setEditStudentData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    status: 'Active'
  });

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    try {
      const updated = await updateStudent(currentStudentId, editStudentData);
      alert('Student profile updated successfully!');
      setShowEditStudentModal(false);
      const allStudents = await getStudents();
      if (setStudents) {
        setStudents(allStudents);
      }
      setSelectedStudent(allStudents.find(s => s.id === currentStudentId));
    } catch (err) {
      alert(`Failed to update profile: ${err.message}`);
    }
  };

  // Sync global search filter from top navigation
  useEffect(() => {
    if (searchFilter !== undefined) {
      setStudentSearch(searchFilter);
      setBorrowedPage(1);
      setHistoryPage(1);
      setFeesPage(1);
    }
  }, [searchFilter]);

  // Dropdown / Form states for Fine Collection
  const [selectedFineId, setSelectedFineId] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('Cash');

  // Pagination states for the three cards
  const [borrowedPageSize, setBorrowedPageSize] = useState(5);
  const [borrowedPage, setBorrowedPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(5);
  const [historyPage, setHistoryPage] = useState(1);
  const [feesPageSize, setFeesPageSize] = useState(5);
  const [feesPage, setFeesPage] = useState(1);

  // Default select the first student when data loads
  useEffect(() => {
    if (students && students.length > 0 && !selectedStudent) {
      setSelectedStudent(students[0]);
    }
  }, [students, selectedStudent]);

  // Fetch per-student data whenever selection changes
  useEffect(() => {
    if (!selectedStudent) return;
    const sid = selectedStudent.id || selectedStudent.student_id;
    setStudentDataLoading(true);
    Promise.all([
      getStudentTransactions(sid),
      getStudentFines(sid),
      getStudentStats(sid),
    ]).then(([txns, fines, statsResult]) => {
      setStudentTxns(txns);
      setStudentFinesList(fines);
      setStudentStatsData(statsResult);
    }).catch(console.error)
      .finally(() => setStudentDataLoading(false));
  }, [selectedStudent]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
          <p className="text-xs text-on-surface-variant font-medium">Loading Students...</p>
        </div>
      </div>
    );
  }

  // Filter students by search
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.id.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const getStudentDept = (s) => {
    if (!s) return 'Computer Science';
    if (s.department) return s.department;
    const name = s.name.toLowerCase();
    if (name.includes('vance') || name.includes('caulfield') || name.includes('eyre')) return 'Literature';
    if (name.includes('hastings')) return 'History';
    if (name.includes('smith') && name.includes('winston')) return 'Literature';
    if (name.includes('doe') || name.includes('jimenez') || name.includes('elena')) return 'Computer Science';
    if (name.includes('smith')) return 'Engineering';
    return 'Computer Science';
  };

  // Derive active/overdue counts from live overdueList for the sidebar badge
  const getStudentOverdueCount = (s) => {
    const sid = s.id || s.student_id;
    return (stats?.overdueList || []).filter(
      o => o.student_id === sid
    ).length;
  };

  const getStudentActiveCount = (s) => {
    const sid = s.id || s.student_id;
    return (stats?.overdueList || []).filter(o => o.student_id === sid).length;
  };

  // Derive borrowed/history/fines/stats from live API data
  const borrowed = studentTxns
    .filter(t => t.status === 'Active')
    .map(t => ({
      transaction_id: t.transaction_id,
      id:       String(t.transaction_id).toUpperCase().startsWith('TRX-') ? t.transaction_id : `TRX-${String(t.transaction_id).padStart(4, '0')}`,
      title:    t.book_title,
      author:   t.book_author,
      barcode:  `B-${String(t.transaction_id).padStart(5, '0')}`,
      dueDate:  t.due_date,
      isOverdue: t.is_overdue,
    }));

  const history = studentTxns
    .filter(t => t.status === 'Returned')
    .map(t => ({
      id:     String(t.transaction_id).toUpperCase().startsWith('TRX-') ? t.transaction_id : `TRX-${String(t.transaction_id).padStart(4, '0')}`,
      title:  t.book_title,
      date:   `Returned: ${t.return_date || t.due_date}`,
      status: t.return_date && t.return_date > t.due_date ? 'Late' : 'On Time',
    }));

  // Outstanding (Pending) fines list formatted for the dropdown
  const fines = studentFinesList
    .filter(f => f.payment_status === 'Pending')
    .map(f => ({
      id:     String(f.fine_id),
      fineId: f.fine_id,
      item:   `${String(f.transaction_id).toUpperCase().startsWith('TRX-') ? f.transaction_id : `TRX-${String(f.transaction_id).padStart(4, '0')}`} — Overdue: ${f.book_title}`,
      amount: f.fine_amount,
    }));

  // Paid fines as payment history rows
  const currentPaymentHistory = studentFinesList
    .filter(f => f.payment_status === 'Paid')
    .map(f => ({
      date:     f.paid_date || f.due_date,
      category: `Fine: ${f.book_title} (${String(f.transaction_id).toUpperCase().startsWith('TRX-') ? f.transaction_id : `TRX-${String(f.transaction_id).padStart(4, '0')}`})`,
      amount:   f.fine_amount,
      status:   'Paid',
    }));

  const currentStats = studentStatsData
    ? {
        totalCheckedOut: studentStatsData.total_checked_out,
        lateReturns:     studentStatsData.late_returns,
        dueBooks:        studentStatsData.active_loans,
        totalPaidFines:  studentStatsData.total_fines_paid,
      }
    : { totalCheckedOut: 0, lateReturns: 0, dueBooks: 0, totalPaidFines: 0 };

  const currentStudentId = selectedStudent ? (selectedStudent.id || selectedStudent.student_id) : '';
  const nameDisplay = selectedStudent ? selectedStudent.name : '';
  const idDisplay = selectedStudent ? (selectedStudent.id || selectedStudent.student_id) : '';
  const deptDisplay = getStudentDept(selectedStudent);
  const emailDisplay = selectedStudent?.email || '';
  const initialsDisplay = nameDisplay ? nameDisplay.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

  const totalOutstandingFine = fines.reduce((sum, f) => sum + f.amount, 0);

  const handleProcessPayment = async () => {
    if (fines.length === 0) {
      alert('No outstanding fines to pay!');
      return;
    }

    const finesToPay = selectedFineId === 'all' || !selectedFineId
      ? fines
      : fines.filter(f => f.id === selectedFineId);

    if (finesToPay.length === 0) {
      alert('Please select a valid fine to pay.');
      return;
    }

    try {
      // Pay each fine via the backend
      await Promise.all(finesToPay.map(f => payFine(f.fineId)));
      const amountPaid = finesToPay.reduce((sum, f) => sum + f.amount, 0);
      alert(`Success! Payment of \u20b9${amountPaid.toFixed(2)} processed via ${selectedPaymentMethod}.`);
      setSelectedFineId('');
      // Refresh the student's fine data from backend
      const [newFines, newStats] = await Promise.all([
        getStudentFines(currentStudentId),
        getStudentStats(currentStudentId),
      ]);
      setStudentFinesList(newFines);
      setStudentStatsData(newStats);
    } catch (err) {
      alert(`Payment failed: ${err.message}`);
    }
  };

  const handleCheckoutRedirect = () => {
    if (selectedStudent) {
      setPrefilledStudent(selectedStudent);
      setActiveTab('transactions');
    }
  };

  const handleRenewBook = async (item) => {
    try {
      await renewBook(item.transaction_id);
      alert(`Book "${item.title}" renewed successfully! Expected return date extended by 14 days.`);
      const sid = selectedStudent.id || selectedStudent.student_id;
      const txns = await getStudentTransactions(sid);
      setStudentTxns(txns);
      const newStats = await getStudentStats(sid);
      setStudentStatsData(newStats);
    } catch (err) {
      alert(`Renewal failed: ${err.message}`);
    }
  };

  // Pagination lists
  const paginatedBorrowed = borrowed.slice((borrowedPage - 1) * borrowedPageSize, borrowedPage * borrowedPageSize);
  const paginatedHistory = history.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);
  const paginatedFees = currentPaymentHistory.slice((feesPage - 1) * feesPageSize, feesPage * feesPageSize);

  const renderAvatar = (s, isSelected) => {
    if (s.avatarUrl) {
      return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-surface-variant/35">
          <img alt={s.name} className="w-full h-full object-cover" src={s.avatarUrl} />
        </div>
      );
    }
    const initials = s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-headline-sm text-headline-sm shrink-0 ${
        isSelected 
          ? 'bg-secondary-container text-on-secondary-container font-semibold' 
          : 'bg-surface-variant text-on-surface-variant'
      }`}>
        {initials}
      </div>
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden -mx-4 -my-4 h-[calc(100vh-48px)]">
      {/* Student Search Panel (Left Sidebar) */}
      <aside className="w-80 border-r border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 h-full overflow-hidden text-left">
        <div className="p-4 border-b border-surface-variant bg-surface z-10">
          <h2 className="font-headline-sm text-[16px] text-primary mb-3">STUDENT SEARCH</h2>
          <div className="relative flex items-center w-full h-8 rounded-md bg-surface-container-low border border-outline-variant focus-within:border-primary overflow-hidden transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant ml-2 text-[18px]">search</span>
            <input 
              className="w-full h-full bg-transparent border-none focus:ring-0 text-[13px] font-body-sm px-2 text-on-surface placeholder:text-on-surface-variant focus:outline-none" 
              placeholder="Enter Student ID or Name" 
              type="text"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setBorrowedPage(1);
                setHistoryPage(1);
                setFeesPage(1);
              }}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredStudents.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-6">No students found.</p>
          ) : (
            filteredStudents.map(s => {
              const activeCount = getStudentActiveCount(s);
              const overdueCount = getStudentOverdueCount(s);
              const isSelected = selectedStudent && selectedStudent.id === s.id;
              
              return (
                <div 
                  key={s.id}
                  onClick={() => {
                    setSelectedStudent(s);
                    setBorrowedPage(1);
                    setHistoryPage(1);
                    setFeesPage(1);
                    setSelectedFineId('');
                  }}
                  className={`border rounded-md p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden group text-left ${
                    isSelected 
                      ? 'bg-surface-container-lowest border-primary' 
                      : 'bg-surface-container-lowest border-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                  {overdueCount > 0 && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error"></div>}
                  
                  <div className="flex items-center gap-3">
                    {renderAvatar(s, isSelected)}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-body-lg text-[14px] text-on-surface font-semibold truncate m-0">{s.name}</h3>
                      <p className="font-mono-sm text-[10px] text-on-surface-variant truncate m-0">ID: {s.id}</p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-label-md text-[11px] text-secondary">{getStudentDept(s)}</span>
                    {overdueCount > 0 ? (
                      <span className="bg-error-container text-error font-label-md text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border border-error/20">
                        {overdueCount} Overdue
                      </span>
                    ) : (
                      <span className="bg-primary-container text-on-primary-container font-label-md text-[9px] uppercase px-1.5 py-0.5 rounded font-bold">
                        {activeCount} Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Panel (Detail View) */}
      <section className="flex-1 overflow-y-auto p-4 bg-background h-full text-left">
        {/* Selected Student Profile Header */}
        <div className="bg-surface-container-lowest border border-surface-variant rounded-md p-6 mb-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {selectedStudent?.avatarUrl ? (
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-surface font-bold shrink-0">
                <img alt={nameDisplay} className="w-full h-full object-cover" src={selectedStudent.avatarUrl} />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-display-lg text-display-lg border-2 border-surface font-bold shrink-0">
                {initialsDisplay}
              </div>
            )}
            <div>
              <h2 className="font-display-lg text-[32px] leading-tight text-on-surface mb-1 font-bold">{nameDisplay}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2 font-body-sm text-[12px] text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">badge</span> 
                  {idDisplay}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">school</span> 
                  {deptDisplay}, {selectedStudent?.id === '7102-21' ? 'Sophomore' : selectedStudent?.id === '9931-20' ? 'Senior' : 'Junior'}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">mail</span> 
                  {emailDisplay}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => {
                setEditStudentData({
                  first_name: selectedStudent.first_name || selectedStudent.name.split(' ')[0] || '',
                  last_name: selectedStudent.last_name || selectedStudent.name.split(' ').slice(1).join(' ') || '',
                  email: selectedStudent.email || '',
                  phone: selectedStudent.phone || selectedStudent.contact || '',
                  status: selectedStudent.status || 'Active'
                });
                setShowEditStudentModal(true);
              }}
              className="flex-1 md:flex-none border border-outline-variant text-on-surface font-label-md text-[11px] py-2 px-4 rounded-md hover:bg-surface-container-low hover:border-primary text-primary transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer bg-transparent"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span> 
              Edit Profile
            </button>
            <button 
              onClick={handleCheckoutRedirect}
              className="flex-1 md:flex-none bg-primary text-on-primary font-label-md text-[11px] py-2 px-4 rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm border-none font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span> 
              Check Out Item
            </button>
          </div>
        </div>

        {/* Content Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          <div className="lg:col-span-3 flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Collect Fines Bento Card */}
              <div className="flex flex-col gap-2">
                <h3 className="font-headline-sm text-[16px] text-primary mb-1 flex items-center gap-1.5 m-0 font-semibold">
                  <span className="material-symbols-outlined text-error text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                  Collect Fines
                </h3>
                <div className="bg-surface-container-lowest border border-surface-variant rounded-md shadow-sm p-4 flex flex-col gap-4">
                  <div className="bg-error-container/30 p-3 rounded-md border border-error/20">
                    <div className="text-on-surface-variant font-label-md text-[10px] uppercase mb-1 font-bold">Total Outstanding Fine</div>
                    <div className="font-display-lg text-[24px] leading-tight text-error font-bold">₹{totalOutstandingFine.toFixed(2)}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-on-surface-variant font-label-md text-[10px] uppercase font-bold">Select Book/Item</label>
                    <select 
                      value={selectedFineId}
                      onChange={(e) => setSelectedFineId(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-[13px] font-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer h-9 text-on-surface"
                    >
                      <option className="text-on-surface bg-surface" value="">-- Choose fine to pay --</option>
                      {fines.map(f => (
                        <option className="text-on-surface bg-surface" key={f.id} value={f.id}>{f.item} - ₹{f.amount.toFixed(2)}</option>
                      ))}
                      {fines.length > 1 && (
                        <option value="all" className="font-semibold text-primary bg-surface">Pay All Outstanding Fines (₹{totalOutstandingFine.toFixed(2)})</option>
                      )}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-on-surface-variant font-label-md text-[10px] uppercase font-bold">Payment Method</label>
                    <select 
                      value={selectedPaymentMethod}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-[13px] font-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer h-9 text-on-surface"
                    >
                      <option className="text-on-surface bg-surface" value="Cash">Cash</option>
                      <option className="text-on-surface bg-surface" value="Card">Card</option>
                      <option className="text-on-surface bg-surface" value="Digital">Digital</option>
                      <option className="text-on-surface bg-surface" value="UPI">UPI</option>
                    </select>
                  </div>
                  
                  <button 
                    onClick={handleProcessPayment}
                    className="w-full bg-primary text-on-primary font-label-md text-[11px] py-2.5 px-4 rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm mt-2 border-none font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
                    Process Payment
                  </button>
                </div>
              </div>

              {/* Patron Stats Bento Card */}
              <div className="flex flex-col gap-2">
                <h3 className="font-headline-sm text-[16px] text-primary mb-1 flex items-center gap-1.5 m-0 font-semibold">
                  <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
                  Patron Stats
                </h3>
                
                <div className="bg-surface-container-lowest border border-surface-variant rounded-md shadow-sm p-4 flex flex-col gap-4 mb-4 flex-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-container-low p-3 rounded-md border border-surface-variant">
                      <div className="text-on-surface-variant font-label-md text-[10px] uppercase mb-1 font-bold">Total Checked Out</div>
                      <div className="font-display-lg text-[24px] leading-tight text-primary font-bold">{currentStats.totalCheckedOut}</div>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-md border border-surface-variant">
                      <div className="text-on-surface-variant font-label-md text-[10px] uppercase mb-1 font-bold">Late Returns</div>
                      <div className="font-display-lg text-[24px] leading-tight text-on-surface font-bold">{currentStats.lateReturns}</div>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-md border border-surface-variant">
                      <div className="text-on-surface-variant font-label-md text-[10px] uppercase mb-1 font-bold">Due Books</div>
                      <div className="font-display-lg text-[24px] leading-tight text-on-surface font-bold">{currentStats.dueBooks}</div>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-md border border-surface-variant">
                      <div className="text-on-surface-variant font-label-md text-[10px] uppercase mb-1 font-bold">Total Amount Paid</div>
                      <div className="font-display-lg text-[24px] leading-tight text-primary font-bold">₹{currentStats.totalPaidFines.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-left">
                    <div className="text-on-surface-variant font-label-md text-[10px] uppercase mb-2 font-bold">Account Status</div>
                    {totalOutstandingFine > 0 ? (
                      <div className="flex items-center gap-2 bg-error-container/25 text-error p-3 rounded-md border border-error/30">
                        <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                        <span className="font-body-sm text-[12px] font-semibold">Account Blocked - Fines Pending</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-secondary-fixed-dim/20 text-on-surface p-3 rounded-md border border-secondary-fixed-dim/30">
                        <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                        <span className="font-body-sm text-[12px] font-semibold">Active & In Good Standing</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Currently Borrowed Bento Card */}
          <div className="lg:col-span-3 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-headline-sm text-[16px] text-primary flex items-center gap-1.5 m-0 font-semibold">
                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_library</span> 
                Currently Borrowed 
                <span className="bg-primary-container text-on-primary-container rounded-full px-2 py-0.5 text-label-md text-[9px] ml-1 font-bold text-white">
                  {borrowed.length}
                </span>
              </h3>
              {borrowed.length > 5 && (
                <button 
                  onClick={() => setBorrowedPageSize(prev => prev === 5 ? 20 : 5)}
                  className="text-primary font-label-md text-[11px] hover:underline flex items-center gap-1 border-none bg-transparent cursor-pointer font-bold"
                >
                  {borrowedPageSize === 5 ? 'View All' : 'Collapse'} <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              )}
            </div>
            
            <div className="bg-surface-container-lowest border border-surface-variant rounded-md shadow-sm overflow-hidden flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-surface-variant font-label-md text-[10px] text-on-surface-variant uppercase tracking-wider">
                      <th className="py-2 px-3 font-bold">Title</th>
                      <th className="py-2 px-3 font-bold">Transaction ID</th>
                      <th className="py-2 px-3 font-bold">Due Date</th>
                      <th className="py-2 px-3 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant font-body-sm text-[12px] text-on-surface">
                    {paginatedBorrowed.map((item, index) => (
                      <tr key={index} className="hover:bg-surface-container-low transition-colors group">
                        <td className="py-2 px-3">
                          <div className="font-medium text-primary">{item.title}</div>
                          <div className="text-on-surface-variant font-body-sm text-[10px]">{item.author}</div>
                        </td>
                        <td className="py-2 px-3 font-mono-sm text-[11px] text-primary">{item.id}</td>
                        <td className="py-2 px-3">
                          {item.isOverdue ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-error-container text-error font-label-md text-[9px] uppercase border border-error/20 font-bold">
                              Overdue
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant font-label-md text-[9px] uppercase border border-outline-variant/30">
                              {item.dueDate}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button 
                            onClick={() => handleRenewBook(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container hover:border-primary text-primary transition-all text-[11px] font-medium shadow-sm cursor-pointer"
                            type="button"
                          >
                            Renew
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="px-4 py-2 border-t border-surface-variant flex items-center gap-2">
                <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Books per page:</span>
                <select 
                  value={borrowedPageSize}
                  onChange={(e) => {
                    setBorrowedPageSize(Number(e.target.value));
                    setBorrowedPage(1);
                  }}
                  className="pagination-select bg-surface border border-outline-variant rounded py-1 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer text-[12px] h-8 font-medium"
                >
                  <option className="text-on-surface bg-surface" value="5">5</option>
                  <option className="text-on-surface bg-surface" value="10">10</option>
                  <option className="text-on-surface bg-surface" value="20">20</option>
                </select>
              </div>
            </div>
          </div>

          {/* Historical Checkouts Bento Card */}
          <div className="lg:col-span-3 mt-4">
            <h3 className="font-headline-sm text-[16px] text-primary mb-2 flex items-center gap-1.5 m-0 font-semibold">
              <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>history</span> 
              Recent History
            </h3>
            
            <div className="bg-surface-container-lowest border border-surface-variant rounded-md shadow-sm p-4">
              <div className="space-y-3">
                {paginatedHistory.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-surface-variant rounded-md bg-surface hover:bg-surface-container-low transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-surface-variant rounded flex items-center justify-center text-on-surface-variant group-hover:bg-primary-fixed group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">menu_book</span>
                      </div>
                      <div>
                        <div className="font-body-sm text-[13px] font-semibold text-on-surface">
                          {item.title} <span className="font-mono text-[11px] text-primary ml-1.5">{item.id}</span>
                        </div>
                        <div className="font-body-sm text-[11px] text-on-surface-variant">{item.date}</div>
                      </div>
                    </div>
                    <span className="bg-surface-container-high text-on-surface font-label-md text-[9px] uppercase px-1.5 py-0.5 rounded font-bold">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="px-4 py-2 border-t border-surface-variant flex items-center gap-2 mt-3 -mx-4 -mb-4">
                <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Books per page:</span>
                <select 
                  value={historyPageSize}
                  onChange={(e) => {
                    setHistoryPageSize(Number(e.target.value));
                    setHistoryPage(1);
                  }}
                  className="pagination-select bg-surface border border-outline-variant rounded py-1 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer text-[12px] h-8 font-medium"
                >
                  <option className="text-on-surface bg-surface" value="5">5</option>
                  <option className="text-on-surface bg-surface" value="10">10</option>
                  <option className="text-on-surface bg-surface" value="20">20</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fees Collection History Bento Card */}
          <div className="lg:col-span-3 mt-6">
            <h3 className="font-headline-sm text-[16px] text-primary mb-2 flex items-center gap-1.5 m-0 font-semibold">
              <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span> 
              Fees Collection History
            </h3>
            
            <div className="bg-surface-container-lowest border border-surface-variant rounded-md shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-surface-variant font-label-md text-[10px] text-on-surface-variant uppercase tracking-wider">
                      <th className="py-2 px-4 font-bold">Date</th>
                      <th className="py-2 px-4 font-bold">Category</th>
                      <th className="py-2 px-4 font-bold">Amount</th>
                      <th className="py-2 px-4 text-right font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant font-body-sm text-[12px] text-on-surface">
                    {paginatedFees.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-on-surface-variant">No fee payment history found.</td>
                      </tr>
                    ) : (
                      paginatedFees.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-3 px-4">{row.date}</td>
                          <td className="py-3 px-4 font-medium">{row.category}</td>
                          <td className="py-3 px-4">₹{row.amount.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-md text-[9px] uppercase font-bold">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span> Paid
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="px-4 py-2 border-t border-surface-variant flex items-center gap-2">
                <span className="font-label-md text-[12px] text-on-surface-variant font-bold">Records per page:</span>
                <select 
                  value={feesPageSize}
                  onChange={(e) => {
                    setFeesPageSize(Number(e.target.value));
                    setFeesPage(1);
                  }}
                  className="pagination-select bg-surface border border-outline-variant rounded py-1 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer text-[12px] h-8 font-medium"
                >
                  <option className="text-on-surface bg-surface" value="5">5</option>
                  <option className="text-on-surface bg-surface" value="10">10</option>
                  <option className="text-on-surface bg-surface" value="20">20</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </section>

      <AnimatePresence>
        {showEditStudentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditStudentModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-lg p-6 relative z-10 border border-outline-variant shadow-xl text-left"
            >
              <div className="flex items-center justify-between mb-4 border-b border-surface-variant pb-2">
                <h3 className="text-base font-bold text-primary m-0">Edit Student Profile</h3>
                <button onClick={() => setShowEditStudentModal(false)} className="text-on-surface-variant hover:text-primary cursor-pointer bg-transparent border-none flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form onSubmit={handleEditStudentSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">First Name</label>
                  <input
                    type="text"
                    required
                    value={editStudentData.first_name}
                    onChange={(e) => setEditStudentData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full bg-surface border border-surface-variant rounded-md px-3 py-2 font-body-sm text-[13px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editStudentData.last_name}
                    onChange={(e) => setEditStudentData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full bg-surface border border-surface-variant rounded-md px-3 py-2 font-body-sm text-[13px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editStudentData.email}
                    onChange={(e) => setEditStudentData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-surface border border-surface-variant rounded-md px-3 py-2 font-body-sm text-[13px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Contact Phone</label>
                  <input
                    type="text"
                    value={editStudentData.phone}
                    onChange={(e) => setEditStudentData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-surface border border-surface-variant rounded-md px-3 py-2 font-body-sm text-[13px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Account Status</label>
                  <select
                    value={editStudentData.status}
                    onChange={(e) => setEditStudentData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-surface border border-surface-variant rounded-md px-3 py-2 font-body-sm text-[13px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Graduated">Graduated</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditStudentModal(false)}
                    className="px-4 py-1.5 border border-outline-variant rounded-md font-label-md text-[11px] text-on-surface-variant hover:bg-surface-container-low transition-all border-none cursor-pointer bg-transparent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary text-on-primary px-4 py-1.5 rounded-md font-label-md text-[11px] hover:bg-primary/90 shadow-sm transition-all font-semibold border-none cursor-pointer"
                  >
                    Save Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Transaction History View Component
function TransactionHistory({ transactions, stats, loading, searchFilter }) {
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [allTxns, setAllTxns] = useState([]);
  const [txnLoading, setTxnLoading] = useState(true);

  // Modal states for transaction details
  const [showTxDetailsModal, setShowTxDetailsModal] = useState(false);
  const [selectedTxDetails, setSelectedTxDetails] = useState(null);

  // Fetch all transactions from backend on mount
  useEffect(() => {
    setTxnLoading(true);
    getIssuedBooks()
      .then(data => setAllTxns(data))
      .catch(console.error)
      .finally(() => setTxnLoading(false));
  }, []);

  if (txnLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
          <p className="text-xs text-on-surface-variant font-medium">Loading History...</p>
        </div>
      </div>
    );
  }

  // Map backend transactions to display rows
  const historyRows = allTxns.map(tx => ({
    id:          String(tx.transaction_id).toUpperCase().startsWith('TRX-') ? tx.transaction_id : `TRX-${String(tx.transaction_id).padStart(4, '0')}`,
    studentName: tx.student_name,
    title:       tx.title || tx.book_title,
    type:        tx.status === 'Returned' ? 'Return' : 'Issue',
    issueDate:   tx.issue_date,
    returnDate:  tx.return_date || '-',
    amount:      tx.fine_amount > 0 ? `\u20b9${Number(tx.fine_amount).toFixed(2)}` : '-',
    status:      tx.status === 'Returned'
                   ? 'Completed'
                   : tx.is_overdue || (tx.due_date && tx.due_date < new Date().toISOString().split('T')[0])
                     ? 'Overdue'
                     : 'Pending',
  }));

  // Filter Rows
  const filteredRows = historyRows.filter(row => {
    if (typeFilter && row.type.toLowerCase() !== typeFilter.toLowerCase()) {
      return false;
    }
    if (statusFilter && row.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return row.studentName.toLowerCase().includes(q) || 
             row.title.toLowerCase().includes(q) ||
             row.id.toLowerCase().includes(q);
    }
    return true;
  });

  // Pagination calculations
  const totalResults = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  
  // Safe page pointer
  const activePage = Math.min(currentPage, totalPages);
  
  const paginatedRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize);
  const showFrom = totalResults > 0 ? (activePage - 1) * pageSize + 1 : 0;
  const showTo = Math.min(activePage * pageSize, totalResults);

  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Student Name', 'Book Title', 'Type', 'Issue Date', 'Return Date', 'Amount', 'Status'];
    const rows = filteredRows.map(row => [
      row.id,
      row.studentName,
      row.title,
      row.type,
      row.issueDate,
      row.returnDate,
      row.amount,
      row.status
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transaction_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col text-left">
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0">
        <div>
          <h2 className="font-headline-sm text-[20px] text-primary mb-1">Transaction History</h2>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-md p-2.5 mb-4 flex flex-wrap gap-3 items-center shadow-sm shrink-0">
        <div className="flex items-center gap-1.5 px-2">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">filter_list</span>
          <span className="font-label-md text-[11px] text-on-surface-variant uppercase tracking-wider font-bold">Filters</span>
        </div>
        <div className="h-5 w-px bg-outline-variant mx-1 hidden sm:block"></div>
        
        <select 
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
          className="bg-surface border border-outline-variant rounded-md !px-3 !py-1 font-body-sm text-[13px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface cursor-pointer !w-auto !inline-block !h-9"
        >
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="">All Types</option>
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="issue">Issue</option>
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="return">Return</option>
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="fine payment">Fine Payment</option>
        </select>
        
        <select 
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="bg-surface border border-outline-variant rounded-md !px-3 !py-1 font-body-sm text-[13px] focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface cursor-pointer !w-auto !inline-block !h-9"
        >
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="">All Statuses</option>
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="completed">Completed</option>
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="overdue">Overdue</option>
          <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="pending">Pending</option>
        </select>
        
        <div className="flex items-center gap-2 bg-surface border border-outline-variant rounded-md !px-3 !py-1 h-9 !w-auto">
          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">calendar_today</span>
          <input className="!bg-transparent !border-none !focus:ring-0 !p-0 font-body-sm text-[12px] !w-24 text-on-surface !outline-none !shadow-none !h-auto" placeholder="Last 30 Days" readonly type="text"/>
        </div>
        
        {(typeFilter || statusFilter) && (
          <button 
            onClick={handleClearFilters}
            className="ml-auto text-primary font-label-md text-[11px] hover:underline px-2 cursor-pointer border-none bg-transparent"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Data Table Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-md shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-container-high border-b border-surface-variant font-label-md text-[10px] text-on-surface-variant uppercase tracking-wider">
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Book Title</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Issue Date</th>
                <th className="py-2.5 px-3">Return Date</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant font-body-sm text-[12px] text-on-surface">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-on-surface-variant">No matching records found.</td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => (
                  <tr key={row.id + idx} className="hover:bg-surface-container-low transition-colors group">
                    <td className="py-2.5 px-3 font-mono-sm text-[11px] text-primary">{row.id}</td>
                    <td className="py-2.5 px-3 font-medium text-primary">{row.studentName}</td>
                    <td className="py-2.5 px-3 truncate max-w-[200px]" title={row.title}>{row.title}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          row.type === 'Issue' 
                            ? 'bg-primary' 
                            : row.type === 'Return' 
                              ? 'bg-secondary' 
                              : 'bg-error'
                        }`}></span>
                        <span className={row.type === 'Fine Payment' ? 'text-error font-semibold' : ''}>{row.type}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant">{row.issueDate}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant">{row.returnDate}</td>
                    <td className={`py-2.5 px-3 ${row.type === 'Fine Payment' ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>{row.amount}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-1.5 py-0.5 rounded font-label-md text-[9px] uppercase border font-bold ${
                        row.status === 'Completed'
                          ? 'bg-secondary-container/50 text-secondary border-secondary/20'
                          : row.status === 'Overdue'
                            ? 'bg-error-container text-error border-error/20'
                            : 'bg-surface-variant text-on-surface-variant border-outline-variant/30'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button 
                        onClick={() => {
                          setSelectedTxDetails(row);
                          setShowTxDetailsModal(true);
                        }}
                        className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded hover:bg-surface-container border-none bg-transparent cursor-pointer flex items-center ml-auto"
                      >
                        <span className="material-symbols-outlined text-[16px]">more_vert</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Panel */}
        <div className="bg-surface px-4 py-2.5 border-t border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <p className="font-body-sm text-[12px] text-on-surface-variant m-0">
                Showing <span className="font-medium text-on-surface">{showFrom}</span> to <span className="font-medium text-on-surface">{showTo}</span> of <span className="font-medium text-on-surface">{totalResults}</span> results
              </p>
            </div>
            
            {/* Page Size Selector */}
            <div className="flex items-center gap-2 font-body-sm text-[12px] text-on-surface-variant shrink-0 whitespace-nowrap">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="pagination-select bg-surface border border-outline-variant rounded-md py-1 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer text-[12px] h-8 font-medium"
              >
                <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="5">5</option>
                <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="10">10</option>
                <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="20">20</option>
                <option className="bg-white text-slate-800 dark:bg-slate-900 dark:text-white" value="50">50</option>
              </select>
            </div>
          </div>
          <div className="flex flex-1 justify-between sm:justify-end gap-1.5 items-center">
            <button 
              disabled={activePage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-2.5 py-1 bg-surface border border-outline-variant rounded hover:bg-surface-container transition-colors text-on-surface-variant font-label-md text-[11px] disabled:opacity-50 h-7 flex items-center cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="hidden sm:flex gap-1 items-center">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isSelected = activePage === pageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 flex items-center justify-center rounded font-body-sm text-[12px] border-none cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary text-on-primary font-bold'
                        : 'hover:bg-surface-container text-on-surface bg-transparent'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button 
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-2.5 py-1 bg-surface border border-outline-variant rounded hover:bg-surface-container transition-colors text-on-surface font-label-md text-[11px] h-7 flex items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {showTxDetailsModal && selectedTxDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTxDetailsModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-lg p-6 relative z-10 border border-outline-variant shadow-xl text-left"
            >
              <div className="flex items-center justify-between mb-4 border-b border-surface-variant pb-2">
                <h3 className="text-base font-bold text-primary flex items-center gap-1.5 m-0">
                  <span className="material-symbols-outlined text-[20px]">info</span>
                  Transaction Details
                </h3>
                <button onClick={() => setShowTxDetailsModal(false)} className="text-on-surface-variant hover:text-primary cursor-pointer bg-transparent border-none flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-4 text-[13px] font-body-sm text-on-surface">
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Transaction ID</span>
                  <span className="col-span-2 font-semibold font-mono text-primary">{selectedTxDetails.id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Borrower</span>
                  <span className="col-span-2 font-semibold text-primary">{selectedTxDetails.studentName}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Book Title</span>
                  <span className="col-span-2">{selectedTxDetails.title}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Lending Type</span>
                  <span className="col-span-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded font-label-md text-[9px] uppercase border font-bold ${
                      selectedTxDetails.type === 'Issue'
                        ? 'bg-primary-container text-on-primary-container border-primary/20'
                        : 'bg-secondary-container text-on-secondary-container border-secondary/20'
                    }`}>{selectedTxDetails.type}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Issue Date</span>
                  <span className="col-span-2 font-mono text-on-surface-variant">{selectedTxDetails.issueDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Return Date</span>
                  <span className="col-span-2 font-mono text-on-surface-variant">{selectedTxDetails.returnDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Accrued Fine</span>
                  <span className="col-span-2 font-semibold text-error">{selectedTxDetails.amount !== '-' ? selectedTxDetails.amount : 'None'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-surface-variant/30">
                  <span className="text-on-surface-variant font-medium">Status</span>
                  <span className="col-span-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded font-label-md text-[9px] uppercase border font-bold ${
                      selectedTxDetails.status === 'Completed'
                        ? 'bg-secondary-container/50 text-secondary border-secondary/20'
                        : selectedTxDetails.status === 'Overdue'
                          ? 'bg-error-container text-error border-error/20'
                          : 'bg-surface-variant text-on-surface-variant border-outline-variant/30'
                    }`}>{selectedTxDetails.status}</span>
                  </span>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowTxDetailsModal(false)}
                  className="px-4 py-1.5 bg-primary text-on-primary hover:bg-primary/95 rounded-md font-label-md text-[11px] transition-colors border-none cursor-pointer font-semibold shadow-sm"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // State to trigger the "Add Book" modal inside BookCatalog
  const [addBookTrigger, setAddBookTrigger] = useState(0);
  const [prefilledStudent, setPrefilledStudent] = useState(null);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [allBooks, setAllBooks] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // Sync books list
  useEffect(() => {
    const fetchAllBooks = async () => {
      const booksData = await getBooks();
      setAllBooks(booksData);
    };
    fetchAllBooks();
  }, [activeTab]);

  // Click outside to close global search dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.search-box-container')) {
        setSearchFocused(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filter matches for global search dropdown
  const getGlobalSearchMatches = () => {
    if (!searchQuery.trim()) return { books: [], students: [], transactions: [] };
    const q = searchQuery.toLowerCase();

    const bookMatches = allBooks.filter(b => 
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      (b.isbn && b.isbn.includes(q))
    ).slice(0, 5);

    const studentMatches = students.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    ).slice(0, 5);

    let txs = [];
    if (stats?.recentTransactions) {
      stats.recentTransactions.forEach(tx => {
        txs.push({
          id: `TRX-${9000 + tx.id}`,
          title: tx.title,
          studentName: tx.student_name,
          status: tx.status
        });
      });
    }
    if (stats?.overdueList) {
      stats.overdueList.forEach(o => {
        if (!txs.some(t => t.title.toLowerCase() === o.title.toLowerCase() && t.studentName.toLowerCase() === o.student_name.toLowerCase())) {
          txs.push({
            id: String(o.transaction_id).toUpperCase().startsWith('TRX-') ? o.transaction_id : `TRX-${o.transaction_id}`,
            title: o.title,
            studentName: o.student_name,
            status: 'Overdue'
          });
        }
      });
    }

    const transactionMatches = txs.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.studentName.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    ).slice(0, 5);

    return { books: bookMatches, students: studentMatches, transactions: transactionMatches };
  };

  const { books: globalBookMatches, students: globalStudentMatches, transactions: globalTxMatches } = getGlobalSearchMatches();
  const hasGlobalMatches = globalBookMatches.length > 0 || globalStudentMatches.length > 0 || globalTxMatches.length > 0;


  const shouldReduceMotion = useReducedMotion();

  const fadeVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } }
  };

  const fetchStatsAndStudents = async () => {
    try {
      setLoading(true);
      const [dashData, studentsData] = await Promise.all([
        getDashboardStats(),
        getStudents()
      ]);
      setStats(dashData);
      setStudents(studentsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndStudents();
    window.document.documentElement.classList.remove('dark');
  }, []);

  const handleGlobalAddBook = () => {
    setActiveTab('books');
    setAddBookTrigger(prev => prev + 1);
  };

  // Navigates to Transactions and starts a new issue entry
  const handleNewEntry = () => {
    setActiveTab('transactions');
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Dashboard 
            setActiveTab={setActiveTab} 
            handleGlobalAddBook={handleGlobalAddBook} 
            searchFilter={searchQuery}
          />
        );
      case 'books':
        return (
          <BookCatalog 
            defaultCategory="" 
            addBookTrigger={addBookTrigger}
            searchFilter={searchQuery}
          />
        );
      case 'students':
        return (
          <StudentManagement 
            students={students} 
            setStudents={setStudents}
            loading={loading} 
            setActiveTab={setActiveTab}
            setPrefilledStudent={setPrefilledStudent}
            stats={stats}
            searchFilter={searchQuery}
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
          />
        );
      case 'transactions':
        return (
          <IssueReturnForm 
            defaultTab="issue" 
            prefilledStudent={prefilledStudent}
            clearPrefilledStudent={() => setPrefilledStudent(null)}
          />
        );
      case 'history':
        return (
          <TransactionHistory 
            searchFilter={searchQuery}
          />
        );
      default:
        return (
          <Dashboard 
            setActiveTab={setActiveTab} 
            handleGlobalAddBook={handleGlobalAddBook} 
          />
        );
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body-lg antialiased h-screen flex overflow-hidden">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-[240px] bg-primary dark:bg-primary shadow-md z-20 flex flex-col p-3">
        {/* Brand Header */}
        <div className="mb-6 flex items-center gap-2 px-2">
          <img 
            alt="Library System Logo" 
            className="w-8 h-8 rounded-full object-cover border-2 border-surface-variant" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCixAdH9mYA1N5mXzA8Uk0p7Vtl-_68Mn3rL4mfzf-gEGDQNfImXVvW1pd5yhAaRtRJSH44WLzSPqDteLI7E605U4clnMLgoD-Vu36YFDmSyTTzse_9xSaqoc_7CXLYt-7IDEIk1mkfliogZ59bWNfrYZbi-7RV0bYWiwxXPDLuE2MmPULdJlIBowtVMnNBg1JzeEFJHjXaxv5t2VWlfhzEpbtChyiuGgaZLMN-uGXkJwqAn717y62fsILyjAhdcwcPN1p-OJMljc50"
          />
          <div className="text-left">
            <h1 className="font-headline-sm text-[14px] leading-tight font-bold text-on-primary m-0">Sri Gowthami Educational Institutions</h1>
            <p className="font-body-sm text-[11px] text-primary-fixed-dim m-0 mt-0.5">Admin Portal</p>
          </div>
        </div>

        {/* New Entry Button */}
        <button 
          onClick={handleNewEntry}
          className="mb-4 w-full py-1.5 px-3 bg-on-primary text-primary rounded-md font-label-md text-[11px] hover:bg-surface-variant transition-colors cursor-pointer active:scale-95 transition-transform flex items-center justify-center gap-1 shadow-sm border-none"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Entry
        </button>

        {/* Navigation Links */}
        <nav className="flex-1 flex flex-col gap-1">
          {/* Home Link */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-body-sm text-[13px] border-none text-left cursor-pointer active:scale-95 transition-transform ${
              activeTab === 'home'
                ? 'bg-primary-container text-on-primary-container'
                : 'text-primary-fixed-dim hover:bg-on-primary-fixed-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: `'FILL' ${activeTab === 'home' ? 1 : 0}` }}>home</span>
            Home
          </button>

          {/* Books Catalog Link */}
          <button
            onClick={() => setActiveTab('books')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-body-sm text-[13px] border-none text-left cursor-pointer active:scale-95 transition-transform ${
              activeTab === 'books'
                ? 'bg-primary-container text-on-primary-container'
                : 'text-primary-fixed-dim hover:bg-on-primary-fixed-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: `'FILL' ${activeTab === 'books' ? 1 : 0}` }}>library_books</span>
            Books Catalog
          </button>

          {/* Student Management Link */}
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-body-sm text-[13px] border-none text-left cursor-pointer active:scale-95 transition-transform ${
              activeTab === 'students'
                ? 'bg-primary-container text-on-primary-container'
                : 'text-primary-fixed-dim hover:bg-on-primary-fixed-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: `'FILL' ${activeTab === 'students' ? 1 : 0}` }}>group</span>
            Student Management
          </button>

          {/* Transactions Link */}
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-body-sm text-[13px] border-none text-left cursor-pointer active:scale-95 transition-transform ${
              activeTab === 'transactions'
                ? 'bg-primary-container text-on-primary-container'
                : 'text-primary-fixed-dim hover:bg-on-primary-fixed-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: `'FILL' ${activeTab === 'transactions' ? 1 : 0}` }}>swap_horiz</span>
            Transactions
          </button>

          {/* History Link */}
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-body-sm text-[13px] border-none text-left cursor-pointer active:scale-95 transition-transform ${
              activeTab === 'history'
                ? 'bg-primary-container text-on-primary-container'
                : 'text-primary-fixed-dim hover:bg-on-primary-fixed-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: `'FILL' ${activeTab === 'history' ? 1 : 0}` }}>history</span>
            History
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-[240px] h-full overflow-hidden">
        {/* TopNavBar */}
        <header className="flex justify-between items-center h-12 px-4 bg-surface dark:bg-surface-dim text-primary dark:text-primary-fixed border-b border-outline-variant z-10 shrink-0">
          <div className="flex-1 max-w-md relative search-box-container">
            <div className="relative flex items-center w-full h-8 rounded-md bg-surface-container-low border border-outline-variant focus-within:border-primary overflow-hidden transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant ml-2 text-[18px]">search</span>
              <input 
                className="w-full h-full bg-transparent border-none focus:ring-0 text-[13px] font-body-sm px-2 text-on-surface placeholder:text-on-surface-variant focus:outline-none" 
                placeholder="Search catalog, students, or transactions..." 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                onFocus={() => setSearchFocused(true)}
              />
            </div>

            {searchFocused && searchQuery && (
              <div className="absolute left-0 right-0 top-9 bg-surface-container-lowest border border-outline-variant rounded-md shadow-lg max-h-[380px] overflow-y-auto z-50 p-2 text-left flex flex-col gap-3">
                {/* Books Group */}
                {globalBookMatches.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-on-surface-variant tracking-wider px-2 py-1 uppercase border-b border-surface-variant mb-1 font-sans">Books</div>
                    <div className="flex flex-col gap-0.5">
                      {globalBookMatches.map(b => (
                        <div 
                          key={b.id} 
                          onClick={() => {
                            setActiveTab('books');
                            setSearchQuery(b.title);
                            setSearchFocused(false);
                          }}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-surface-container-low rounded-md cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">menu_book</span>
                            <div className="truncate text-[12px]">
                              <span className="font-semibold text-on-surface">{b.title}</span>
                              <span className="text-[10px] text-on-surface-variant ml-1">by {b.author}</span>
                            </div>
                          </div>
                          <span className="text-[9px] bg-secondary-container text-on-secondary-container px-1 py-0.5 rounded shrink-0">{b.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Students Group */}
                {globalStudentMatches.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-on-surface-variant tracking-wider px-2 py-1 uppercase border-b border-surface-variant mb-1 font-sans">Students</div>
                    <div className="flex flex-col gap-0.5">
                      {globalStudentMatches.map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => {
                            const fullStudentObj = students.find(item => item.id === s.id);
                            if (fullStudentObj) {
                              setSelectedStudent(fullStudentObj);
                            }
                            setActiveTab('students');
                            setSearchQuery('');
                            setSearchFocused(false);
                          }}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-surface-container-low rounded-md cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">person</span>
                            <div className="truncate text-[12px]">
                              <span className="font-semibold text-on-surface">{s.name}</span>
                              <span className="text-[10px] text-on-surface-variant ml-1">ID: {s.id}</span>
                            </div>
                          </div>
                          <span className="text-[9px] text-on-surface-variant shrink-0">{s.department || 'Literature'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions Group */}
                {globalTxMatches.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-on-surface-variant tracking-wider px-2 py-1 uppercase border-b border-surface-variant mb-1 font-sans">Activities</div>
                    <div className="flex flex-col gap-0.5">
                      {globalTxMatches.map(tx => (
                        <div 
                          key={tx.id} 
                          onClick={() => {
                            setActiveTab('history');
                            setSearchQuery(tx.id);
                            setSearchFocused(false);
                          }}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-surface-container-low rounded-md cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">swap_horiz</span>
                            <div className="truncate text-[12px]">
                              <span className="font-semibold text-on-surface">{tx.id}</span>
                              <span className="text-[10px] text-on-surface-variant ml-1">({tx.title}) - {tx.studentName}</span>
                            </div>
                          </div>
                          <span className={`text-[9px] uppercase px-1 py-0.5 rounded font-bold border shrink-0 ${
                            tx.status === 'Completed' || tx.status === 'Returned'
                              ? 'bg-secondary-container/50 text-secondary border-secondary/20'
                              : tx.status === 'Overdue'
                                ? 'bg-error-container text-error border-error/20'
                                : 'bg-surface-variant text-on-surface-variant border-outline-variant/30'
                          }`}>{tx.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Matches */}
                {!hasGlobalMatches && (
                  <div className="text-center py-4 text-xs text-on-surface-variant">No results matching "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 bg-background w-full max-w-container_max_width mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={fadeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {renderActiveView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
