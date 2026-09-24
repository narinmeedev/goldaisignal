import { prisma } from '../prisma';

export interface ExecutionGateDecision {
  allowed: boolean;
  reasonTh: string;
  cooldownRemainingMinutes: number;
  circuitBreakerActive: boolean;
  requiresM5CandleClose: boolean;
}

export class TradeExecutionGateService {
  private static readonly POST_LOSS_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown after SL
  private static readonly CONSECUTIVE_LOSS_CIRCUIT_BREAKER_MS = 30 * 60 * 1000; // 30 minutes after >= 2 SLs
  private static readonly MIN_TIME_BETWEEN_TRADES_MS = 5 * 60 * 1000; // 5 minutes minimum between any trades

  /**
   * Evaluates whether a new trade can be opened or if it must be blocked by safety gates.
   */
  static async evaluateGate(symbol: string, currentPrice: number): Promise<ExecutionGateDecision> {
    const cleanSymbol = (symbol || '').toUpperCase();
    const isGold = cleanSymbol.includes('XAU') || cleanSymbol.includes('GOLD');
    const searchSymbols = isGold
      ? ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSDc', 'XAUUSDc.iux', 'XAUUSD.c', 'GOLDc', 'XAUUSD.raw']
      : [symbol];

    const now = Date.now();

    // 1. Check if there is already an active OPEN trade
    const activeRunningTrade = await prisma.paperTrade.findFirst({
      where: {
        symbol: { in: searchSymbols },
        result: { in: ['OPEN', 'TESTING'] },
      },
      orderBy: { openedAt: 'desc' },
    });

    if (activeRunningTrade) {
      return {
        allowed: false,
        reasonTh: 'มีออเดอร์กำลังเปิดอยู่ (Strict 1-Position Policy)',
        cooldownRemainingMinutes: 0,
        circuitBreakerActive: false,
        requiresM5CandleClose: false,
      };
    }

    // 2. Fetch the most recent closed trades
    const recentClosedTrades = await prisma.paperTrade.findMany({
      where: {
        symbol: { in: searchSymbols },
        result: { in: ['WIN', 'LOSS', 'BE'] },
      },
      orderBy: { closedAt: 'desc' },
      take: 5,
    });

    if (!recentClosedTrades.length) {
      return {
        allowed: true,
        reasonTh: 'พร้อมออกออเดอร์ตามเงื่อนไข (ไม่มีประวัติการแพ้ล่าสุด)',
        cooldownRemainingMinutes: 0,
        circuitBreakerActive: false,
        requiresM5CandleClose: true,
      };
    }

    const lastTrade = recentClosedTrades[0];
    const lastClosedAt = lastTrade.closedAt ? new Date(lastTrade.closedAt).getTime() : 0;
    const timeSinceLastClose = now - lastClosedAt;

    // Count consecutive losses
    let consecutiveLosses = 0;
    for (const t of recentClosedTrades) {
      if (t.result === 'LOSS') {
        consecutiveLosses++;
      } else if (t.result === 'WIN') {
        break;
      }
    }

    // 3. Consecutive Loss Circuit Breaker (แพ้ติดกัน >= 2 ไม้)
    if (consecutiveLosses >= 2) {
      const remainingCircuitBreaker = this.CONSECUTIVE_LOSS_CIRCUIT_BREAKER_MS - timeSinceLastClose;
      if (remainingCircuitBreaker > 0) {
        const minsLeft = Math.ceil(remainingCircuitBreaker / 60000);
        return {
          allowed: false,
          reasonTh: `🚨 ระบบเปิด Circuit Breaker พักรบแก้เกมส์ (${minsLeft} นาที) เนื่องจากโดน SL ติดกัน ${consecutiveLosses} ไม้ เพื่อรอตลาดสร้างโครงสร้างใหม่`,
          cooldownRemainingMinutes: minsLeft,
          circuitBreakerActive: true,
          requiresM5CandleClose: true,
        };
      }
    }

    // 4. Single Loss Cooldown (หลังโดน SL 1 ไม้ ต้องพัก 15 นาที)
    if (lastTrade.result === 'LOSS') {
      const remainingCooldown = this.POST_LOSS_COOLDOWN_MS - timeSinceLastClose;
      if (remainingCooldown > 0) {
        const minsLeft = Math.ceil(remainingCooldown / 60000);
        return {
          allowed: false,
          reasonTh: `⏳ อยู่ในช่วงพักรบ Cooldown หลังชน SL (${minsLeft} นาที) เพื่อป้องกันการเข้าซ้ำในจังหวะตลาดสวิงหลอก`,
          cooldownRemainingMinutes: minsLeft,
          circuitBreakerActive: false,
          requiresM5CandleClose: true,
        };
      }
    }

    // 5. Anti-Spam Minimum Spacing (ห้ามเปิดออเดอร์ถี่เกินไปภายใน 5 นาที)
    const remainingSpacing = this.MIN_TIME_BETWEEN_TRADES_MS - timeSinceLastClose;
    if (remainingSpacing > 0) {
      const minsLeft = Math.ceil(remainingSpacing / 60000);
      return {
        allowed: false,
        reasonTh: `⏳ กำลังรอแท่งเทียนแท่งถัดไป (${minsLeft} นาที) ป้องกันการเปิดออเดอร์ถี่เกินไป`,
        cooldownRemainingMinutes: minsLeft,
        circuitBreakerActive: false,
        requiresM5CandleClose: true,
      };
    }

    return {
      allowed: true,
      reasonTh: 'ผ่านเกณฑ์ความปลอดภัยทุกข้อ พร้อมเข้าเทรดเมื่อแท่ง M5 ปิดยืนยัน',
      cooldownRemainingMinutes: 0,
      circuitBreakerActive: false,
      requiresM5CandleClose: true,
    };
  }
}
