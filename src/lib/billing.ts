export const REGULAR_MONTHLY_PRICE_THB = 599;
export const PROMOTIONAL_MONTHLY_PRICE_THB = 199;
export const TRIAL_DURATION_DAYS = 7;
export const PAID_DURATION_DAYS = 30;

const parsePositiveInteger = (value?: string | number | null) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
};

export const getTrialDurationDays = (settingValue?: string | number | null) => {
  const parsed = parsePositiveInteger(settingValue);
  return Math.min(parsed ?? TRIAL_DURATION_DAYS, TRIAL_DURATION_DAYS);
};

export const getPaidDurationDays = (settingValue?: string | number | null) => {
  const parsed = parsePositiveInteger(settingValue);
  return Math.min(parsed ?? PAID_DURATION_DAYS, PAID_DURATION_DAYS);
};

export const getMonthlyPriceThb = (lockedPrice?: string | number | null) => {
  const parsed = typeof lockedPrice === 'number' ? lockedPrice : Number.parseFloat(String(lockedPrice ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PROMOTIONAL_MONTHLY_PRICE_THB;
};

export const formatBaht = (amount: number) => `฿${amount.toLocaleString('th-TH')}`;
