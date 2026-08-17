export type TradeDirection = 'BUY' | 'SELL';

export type TradeGeometry = {
  direction?: TradeDirection | null;
  entry: number;
  stopLoss: number;
  takeProfit: number;
};

export const hasValidTradeGeometry = (plan: TradeGeometry, minimumDistance = 0.01) => {
  if (![plan.entry, plan.stopLoss, plan.takeProfit].every(Number.isFinite)) return false;
  const direction = plan.direction;
  if (direction === 'BUY') {
    return plan.stopLoss <= plan.entry - minimumDistance && plan.takeProfit >= plan.entry + minimumDistance;
  }
  if (direction === 'SELL') {
    return plan.stopLoss >= plan.entry + minimumDistance && plan.takeProfit <= plan.entry - minimumDistance;
  }
  return false;
};

