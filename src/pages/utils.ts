// ==================== 常量 ====================

export const EXPENSE_CATEGORIES = [
  '车贷', '房租', '水电', '停车', '充电',
  '宠物消费', '日常饮食', '高消饮食', '日用品购物', '消费品购物',
  '自动续费', '看病', '亚马逊相关支出', '其他借款', '其他',
] as const;

export const INCOME_CATEGORIES = ['工资', '亚马逊回款', '其他'] as const;

export const AMAZON_EXPENSE = '亚马逊相关支出';
export const AMAZON_INCOME = '亚马逊回款';

// ==================== 工具函数 ====================

export function nowBJ(): string { return new Date().toISOString(); }

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmt(n: number): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(num)) return '¥0.00';
  const sign = num < 0 ? '-' : '';
  return sign + '¥' + Math.abs(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtShort(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万';
  return fmt(n);
}

export function mk(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getCurMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
