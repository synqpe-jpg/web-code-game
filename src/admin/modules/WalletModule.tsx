import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Scale,
  RotateCcw,
} from 'lucide-react';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatCard } from '../components/ui/StatCard';
import { FormModal } from '../components/ui/FormModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Step2VerificationModal } from '../components/ui/Step2VerificationModal';
import { RecentBalanceChangesWidget } from '../components/RecentBalanceChangesWidget';
import { adminDataService } from '../services/adminDataService';
import { WalletTransaction, MemberRecord } from '../types/adminTypes';
import { formatCore, formatFullDateTime, formatTimeAgo } from '../../utils/textUtils';

interface WalletModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const WalletModule: React.FC<WalletModuleProps> = ({ onShowToast }) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Manual Adjustment Form
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [adjAmount, setAdjAmount] = useState(100000);
  const [adjType, setAdjType] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [adjReason, setAdjReason] = useState('Điều chỉnh số dư ví thủ công');

  // Step 2 Security Verification (2FA Confirmation)
  const [step2Action, setStep2Action] = useState<{
    type: 'RESET_ALL' | 'ADJUST_BALANCE';
    title: string;
    actionTitle: string;
    details: string | React.ReactNode;
    payload?: any;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncAndLoad = async () => {
      setIsLoading(true);
      try {
        await adminDataService.fetchFromCloudflareKV();
      } catch {}
      if (isMounted) {
        setMembers(adminDataService.getMembers());
        loadTransactions();
        setIsLoading(false);
      }
    };

    syncAndLoad();

    // Instant cross-tab & KV sync listener
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('wcg_data_sync');
      channel.onmessage = (e) => {
        if (!isMounted) return;
        if (
          e.data?.type === 'TRANSACTIONS_UPDATED' ||
          e.data?.type === 'ORDERS_UPDATED' ||
          e.data?.type === 'MEMBERS_UPDATED' ||
          e.data?.type === 'KV_DATA_PULLED'
        ) {
          setMembers(adminDataService.getMembers());
          loadTransactions();
        }
      };
    }

    const onDataUpdated = () => {
      if (!isMounted) return;
      setMembers(adminDataService.getMembers());
      loadTransactions();
    };

    window.addEventListener('wcg_admin_data_updated', onDataUpdated);

    return () => {
      isMounted = false;
      channel?.close();
      window.removeEventListener('wcg_admin_data_updated', onDataUpdated);
    };
  }, [typeFilter]);

  const loadTransactions = () => {
    const filterObj: any = {};
    if (typeFilter !== 'ALL') filterObj.type = typeFilter;

    const data = adminDataService.getTransactions(filterObj);
    setTransactions(data);
  };

  const handleManualRefresh = async () => {
    setIsLoading(true);
    try {
      await adminDataService.fetchFromCloudflareKV();
      setMembers(adminDataService.getMembers());
      loadTransactions();
      onShowToast('Đã làm mới dữ liệu', 'Sổ cái giao dịch và ví thành viên đã được đồng bộ mới nhất từ Cloudflare D1.', 'success');
    } catch {
      onShowToast('Lỗi đồng bộ', 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatVnd = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Financial summary calculations
  const totalDeposits = transactions
    .filter((t) => t.type === 'DEPOSIT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalSpent = transactions
    .filter((t) => t.type === 'ORDER_PAYMENT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalRefunds = transactions
    .filter((t) => t.type === 'REFUND' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalMemberBalance = members.reduce((sum, m) => sum + (Number(m?.balance) || 0), 0);

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMemberId = selectedMemberId || (members.length > 0 ? members[0].id : '');
    if (!targetMemberId) {
      onShowToast('Lỗi', 'Vui lòng chọn thành viên.', 'error');
      return;
    }

    const targetMember = members.find((m) => m.id === targetMemberId);
    const amount = adjType === 'ADD' ? Math.abs(adjAmount) : -Math.abs(adjAmount);
    const currentBal = Number(targetMember?.balance) || 0;
    const newBal = Math.max(0, currentBal + amount);

    // Require Step 2 Verification code before executing
    setStep2Action({
      type: 'ADJUST_BALANCE',
      title: 'Xác Minh Bước 2: Điều Chỉnh Số Dư Ví',
      actionTitle: `Điều chỉnh số dư ví cho ${targetMember?.displayName || targetMemberId}`,
      details: (
        <div className="space-y-1">
          <p>
            Thành viên: <strong className="text-slate-900 dark:text-white">{targetMember?.displayName}</strong> ({targetMember?.email || targetMember?.id})
          </p>
          <p>
            Biến động:{' '}
            <strong className={amount >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-mono' : 'text-rose-600 dark:text-rose-400 font-mono'}>
              {amount >= 0 ? '+' : ''}{formatVnd(amount)}
            </strong>
          </p>
          <p>
            Số dư sau điều chỉnh:{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{formatVnd(newBal)}</strong>{' '}
            <span className="text-slate-400 text-[10px]">(Trước: {formatVnd(currentBal)})</span>
          </p>
          <p>
            Lý do: <em>{adjReason}</em>
          </p>
        </div>
      ),
      payload: {
        targetMemberId,
        amount,
        adjReason,
      },
    });
  };

  const handleOpenResetAllModal = () => {
    setStep2Action({
      type: 'RESET_ALL',
      title: 'Xác Minh Bước 2: Reset Dữ Liệu Ví & Doanh Thu',
      actionTitle: 'CẢNH BÁO NGUY HIỂM: Reset toàn bộ ví và tổng doanh thu về 0 đồng',
      details: (
        <div className="space-y-1 text-rose-700 dark:text-rose-300">
          <p>
            • Đưa số dư ví của <strong>TẤT CẢ ({members.length}) thành viên</strong> về <strong>0đ</strong>.
          </p>
          <p>• Xóa sạch toàn bộ lịch sử sổ cái giao dịch ví.</p>
          <p>• <strong>Reset tổng doanh thu bán hàng về 0 đồng</strong> trên toàn hệ thống (bao gồm Cloudflare Edge/KV/D1).</p>
          <p className="font-bold underline pt-1">Hành động này KHÔNG THỂ HOÀN TÁC!</p>
        </div>
      ),
    });
  };

  const handleStep2Success = async () => {
    if (!step2Action) return;

    if (step2Action.type === 'RESET_ALL') {
      await adminDataService.resetAllWalletsAndRevenueToZero('Xác thực bước 2 thành công: Reset toàn bộ ví và doanh thu về 0 đồng');
      setMembers(adminDataService.getMembers());
      setTransactions([]);
      setIsResetAllModalOpen(false);
      onShowToast('Thành công', 'Đã xác minh mật khẩu bước 2! Đã reset toàn bộ ví thành viên, sổ cái và tổng doanh thu về 0 đồng.', 'success');
    } else if (step2Action.type === 'ADJUST_BALANCE' && step2Action.payload) {
      const { targetMemberId, amount, adjReason } = step2Action.payload;
      const updated = adminDataService.adjustMemberBalance(targetMemberId, amount, adjReason);

      if (updated) {
        onShowToast(
          'Đã ghi nhận sổ cái',
          `Xác thực bước 2 thành công! Đã điều chỉnh cho ${updated.displayName}. Số dư mới: ${formatVnd(updated.balance)}.`,
          'success'
        );
        setIsAdjustModalOpen(false);
        setMembers(adminDataService.getMembers());
        loadTransactions();
      }
    }

    setStep2Action(null);
  };

  const handleExportCsv = () => {
    const header = 'ID,ReferenceID,MemberID,MemberEmail,Type,Amount,BalanceBefore,BalanceAfter,Status,Note,Timestamp\n';
    const rows = transactions
      .map(
        (t) =>
          `"${t.id}","${t.referenceId}","${t.memberId}","${t.memberEmail || ''}","${t.type}",${t.amount},${t.balanceBefore},${t.balanceAfter},"${t.status}","${t.note}","${t.createdAt}"`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `so_cai_tai_chinh_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Xuất sổ cái thành công', 'File CSV sổ cái tài chính đã tải về máy.', 'success');
  };

  const columns: Column<WalletTransaction>[] = [
    {
      key: 'referenceId',
      header: 'Mã GD / Tham Chiếu',
      sortable: true,
      render: (item) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200">{item?.referenceId || '—'}</span>
          <p className="text-[10px] text-slate-400">{item?.id || ''}</p>
        </div>
      ),
    },
    {
      key: 'memberEmail',
      header: 'Thành Viên',
      render: (item) => (
        <div className="text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200">
            {item?.memberEmail || item?.memberId || 'Khách vãng lai'}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Loại Giao Dịch',
      sortable: true,
      render: (item) => <StatusBadge status={item?.type || 'DEPOSIT'} size="sm" />,
    },
    {
      key: 'amount',
      header: 'Số Tiền Biến Động',
      sortable: true,
      align: 'right',
      render: (item) => {
        const amt = Number(item?.amount) || 0;
        return (
          <div className="text-right font-mono text-xs">
            <span
              className={`font-bold block ${
                amt >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {amt >= 0 ? '+' : ''}
              {formatCore(amt)}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatVnd(Math.abs(amt))}
            </span>
          </div>
        );
      },
    },
    {
      key: 'balanceAfter',
      header: 'Số Dư Sau Biến Động',
      align: 'right',
      render: (item) => (
        <div className="text-xs font-mono text-right">
          <p className="font-bold text-slate-800 dark:text-slate-200">
            {formatCore(Number(item?.balanceAfter) || 0)}
          </p>
          <p className="text-[10px] text-slate-400">
            Trước: {formatCore(Number(item?.balanceBefore) || 0)}
          </p>
        </div>
      ),
    },
    {
      key: 'note',
      header: 'Ghi Chú / Nội Dung',
      render: (item) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate block">
          {item?.note || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Thời Gian',
      sortable: true,
      render: (item) => (
        <div className="text-xs">
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block">
            {formatFullDateTime(item?.createdAt)}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
            {formatTimeAgo(item?.createdAt)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng Tiền Nạp (Deposit)"
          value={formatVnd(totalDeposits)}
          icon={ArrowDownLeft}
          color="emerald"
          subtext="Qua ngân hàng & SePay"
        />
        <StatCard
          title="Doanh Thu Đơn Hàng"
          value={formatVnd(totalSpent)}
          icon={ArrowUpRight}
          color="indigo"
          subtext="Thanh toán từ số dư ví"
        />
        <StatCard
          title="Tổng Hoàn Tiền (Refund)"
          value={formatVnd(totalRefunds)}
          icon={RefreshCw}
          color="amber"
          subtext="Các đơn khiếu nại"
        />
        <StatCard
          title="Tổng Số Dư Thành Viên"
          value={formatVnd(totalMemberBalance)}
          icon={Scale}
          color="purple"
          subtext="Khả dụng trên toàn hệ thống"
        />
      </div>

      {/* Real-time Recent Balance Changes Feed */}
      <RecentBalanceChangesWidget
        transactions={transactions}
        title="Biến Động Số Dư Gần Nhất"
        subtitle="Dòng tiền nạp rút SePay, mua code, hoàn tiền & biến động số dư thành viên theo thời gian thực"
        limit={8}
        compact={false}
        onAdjustWallet={() => {
          setSelectedMemberId(members[0]?.id || '');
          setIsAdjustModalOpen(true);
        }}
        onRefresh={handleManualRefresh}
      />

      {/* Ledger DataTable */}
      <DataTable
        data={transactions}
        columns={columns}
        keyExtractor={(item) => item?.id || `tx_${Math.random()}`}
        isLoading={isLoading}
        searchPlaceholder="Tìm theo mã GD, email thành viên, ghi chú..."
        searchKeys={['referenceId', 'memberEmail', 'note', 'type']}
        onRefresh={handleManualRefresh}
        onExportCsv={handleExportCsv}
        filters={[
          {
            key: 'type',
            label: 'Loại GD',
            selectedValue: typeFilter,
            options: [
              { label: 'Tất cả giao dịch', value: 'ALL' },
              { label: 'Nạp tiền (DEPOSIT)', value: 'DEPOSIT' },
              { label: 'Thanh toán đơn (ORDER_PAYMENT)', value: 'ORDER_PAYMENT' },
              { label: 'Hoàn tiền (REFUND)', value: 'REFUND' },
              { label: 'Admin điều chỉnh (ADMIN_ADJUST)', value: 'ADMIN_ADJUST' },
              { label: 'Thưởng đóng góp (REWARD)', value: 'REWARD' },
            ],
            onChange: setTypeFilter,
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenResetAllModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-sm hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer"
              title="Đặt toàn bộ số dư của tất cả các ví thành viên về 0 đồng và reset tổng doanh thu về 0"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Ví & Doanh Thu Về 0</span>
            </button>
            <button
              onClick={() => {
                setSelectedMemberId(members[0]?.id || '');
                setIsAdjustModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Điều Chỉnh Ví</span>
            </button>
          </div>
        }
      />

      {/* Manual Wallet Adjustment Modal */}
      <FormModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Điều Chỉnh Sổ Cái & Số Dư Ví"
        subtitle="Hệ thống tự động tính toán (Balance After = Balance Before + Amount) và lưu vết bất biến."
        maxWidth="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Chọn Thành Viên <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={selectedMemberId || (members.length > 0 ? members[0].id : '')}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.email}) - Số dư: {formatVnd(m.balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAdjType('ADD')}
              className={`rounded-xl py-2 text-xs font-bold transition-all ${
                adjType === 'ADD'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              + Nạp Tiền
            </button>
            <button
              type="button"
              onClick={() => setAdjType('SUBTRACT')}
              className={`rounded-xl py-2 text-xs font-bold transition-all ${
                adjType === 'SUBTRACT'
                  ? 'bg-rose-600 text-white shadow'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              - Khấu Trừ
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Số Tiền (VND) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={1000}
              step={1000}
              required
              value={adjAmount}
              onChange={(e) => setAdjAmount(Number(e.target.value))}
              className="mt-1 w-full font-mono text-sm font-bold rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Lý Do Giao Dịch <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="VD: Nạp tiền đối soát chuyển khoản MBBank"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Thực Hiện Giao Dịch</span>
            </button>
          </div>
        </form>
      </FormModal>

      {/* Step 2 Security Verification (2FA Confirmation) */}
      {step2Action && (
        <Step2VerificationModal
          isOpen={Boolean(step2Action)}
          onClose={() => setStep2Action(null)}
          onSuccess={handleStep2Success}
          title={step2Action.title}
          actionTitle={step2Action.actionTitle}
          actionDetails={step2Action.details}
          confirmButtonText={
            step2Action.type === 'RESET_ALL'
              ? 'Xác Nhận Reset Về 0'
              : 'Xác Nhận Thay Đổi Số Dư'
          }
          variant={step2Action.type === 'RESET_ALL' ? 'danger' : 'warning'}
        />
      )}
    </div>
  );
};
