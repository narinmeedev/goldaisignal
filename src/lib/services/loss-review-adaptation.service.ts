import { prisma } from '../prisma';

export interface LossReviewState {
  consecutiveLossCount: number;
  isAdaptiveGuardActive: boolean;
  guardLevel: 'NORMAL' | 'CAUTION' | 'STRICT_LOCK';
  lastLossDirection: 'BUY' | 'SELL' | null;
  forbiddenDirection: 'BUY' | 'SELL' | null;
  recommendedFocus: 'BUY' | 'SELL' | 'DEFENSIVE_WAIT' | 'FOLLOW_TREND';
  minConfidenceThreshold: number;
  diagnosisKey: string;
  diagnosisTitleTh: string;
  diagnosisDetailTh: string;
  tacticalActionTh: string;
  reviewedAt: string;
}

export interface LossReviewMarketContext {
  currentPrice: number;
  h1Bias: string;
  m15Bias: string;
  m5Bias: string;
  d1Bias: string;
  rsi14M5?: number;
  atr14M5?: number;
}

export class LossReviewAdaptationService {
  /**
   * Evaluates recent closed trades to detect consecutive Stop Loss streaks,
   * diagnose failure causes, and prescribe immediate tactical game changes.
   */
  static async analyze(
    symbol: string,
    context: LossReviewMarketContext
  ): Promise<LossReviewState> {
    const cleanSymbol = (symbol || '').toUpperCase();
    const isGold = cleanSymbol.includes('XAU') || cleanSymbol.includes('GOLD');
    const searchSymbols = isGold
      ? ['XAUUSD', 'GOLD', 'XAUUSD.iux', 'XAUUSD.a', 'XAUUSDm', 'XAUUSDc', 'XAUUSDc.iux', 'XAUUSD.c', 'GOLDc', 'XAUUSD.raw']
      : [symbol];

    // Fetch the last 8 closed trades
    const recentClosedTrades = await prisma.paperTrade.findMany({
      where: {
        symbol: { in: searchSymbols },
        result: { in: ['WIN', 'LOSS', 'BE'] },
      },
      orderBy: { closedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        direction: true,
        entry: true,
        exitPrice: true,
        stopLoss: true,
        takeProfit1: true,
        result: true,
        rrResult: true,
        notes: true,
        closedAt: true,
      },
    });

    // Count consecutive losses from most recent closed trade backwards
    let consecutiveLossCount = 0;
    const lossStreakTrades: typeof recentClosedTrades = [];

    for (const trade of recentClosedTrades) {
      if (trade.result === 'LOSS') {
        consecutiveLossCount++;
        lossStreakTrades.push(trade);
      } else if (trade.result === 'WIN') {
        break; // Win breaks the streak
      }
      // BE (Break-Even) doesn't add to loss count but doesn't fully clear caution if right after loss
    }

    const isAdaptiveGuardActive = consecutiveLossCount >= 2;
    const guardLevel: 'NORMAL' | 'CAUTION' | 'STRICT_LOCK' =
      consecutiveLossCount >= 3
        ? 'STRICT_LOCK'
        : consecutiveLossCount === 2
          ? 'CAUTION'
          : 'NORMAL';

    const lastLoss = lossStreakTrades[0] || null;
    const lastLossDirection = (lastLoss?.direction as 'BUY' | 'SELL') || null;

    // Default Normal State
    if (!isAdaptiveGuardActive) {
      return {
        consecutiveLossCount,
        isAdaptiveGuardActive: false,
        guardLevel: 'NORMAL',
        lastLossDirection,
        forbiddenDirection: null,
        recommendedFocus: 'FOLLOW_TREND',
        minConfidenceThreshold: 80,
        diagnosisKey: 'NORMAL_OPERATION',
        diagnosisTitleTh: '🟢 ระบบทำงานในสภาวะปกติ (Win Rate เสถียร)',
        diagnosisDetailTh: 'ระบบทำการประเมินโครงสร้างราคา Price Action ตามปกติ ไม่พบการโดน SL ซ้ำซ้อน',
        tacticalActionTh: 'ออกออเดอร์ตาม 4 กลยุทธ์ Price Action หลัก (Support Bounce, Resistance Rejection, Retest)',
        reviewedAt: new Date().toISOString(),
      };
    }

    // 🧠 AI Post-Mortem Diagnosis (วินิจฉัยสาเหตุความผิดพลาด)
    let diagnosisKey = 'ZONE_INVALIDATION';
    let diagnosisTitleTh = '⚠️ แนวรับ/แนวต้านเดิมถูกทำลาย (Structure Invalidation)';
    let diagnosisDetailTh = `พบการโดน SL ติดต่อกัน ${consecutiveLossCount} ไม้ โซนราคาเดิมที่ใช้อ้างอิงไม่สามารถพยุงราคาได้`;
    let forbiddenDirection: 'BUY' | 'SELL' | null = null;
    let recommendedFocus: 'BUY' | 'SELL' | 'DEFENSIVE_WAIT' | 'FOLLOW_TREND' = 'DEFENSIVE_WAIT';
    let tacticalActionTh = 'ยกเลิกโซน M5 เก่าทั้งหมด และปรับไปอ้างอิงแนวรับ-ต้านหลัก H1/H4 เท่านั้น';
    let minConfidenceThreshold = 88;

    const allLossesSameDirection = lossStreakTrades.length >= 2 &&
      lossStreakTrades.every((t) => t.direction === lastLossDirection);

    const isBearishTrend = context.h1Bias === 'BEARISH' || (context.m15Bias === 'BEARISH' && context.m5Bias === 'BEARISH');
    const isBullishTrend = context.h1Bias === 'BULLISH' || (context.m15Bias === 'BULLISH' && context.m5Bias === 'BULLISH');

    // Case 1: Counter-Trend Trap (สวนเทรนด์ใหญ่จนโดนลาก)
    if (lastLossDirection === 'BUY' && isBearishTrend) {
      diagnosisKey = 'COUNTER_TREND_BUY_TRAP';
      diagnosisTitleTh = '🚨 ผิดพลาดจากการดัก BUY สวนแรงเทขาย (Counter-Trend Trap)';
      diagnosisDetailTh = 'ระบบตรวจสอบพบว่าไม้ที่แพ้เกิดจากการพยายามเข้า BUY ในขณะที่โครงสร้าง H1/M15 กำลังเทขายอย่างรุนแรง ทำให้แนวรับย่อยรับไม่อยู่';
      forbiddenDirection = 'BUY';
      recommendedFocus = 'SELL';
      tacticalActionTh = '🔒 ล็อคห้ามเข้า BUY ชั่วคราว! ปรับกลยุทธ์เป็น "ดัก SELL เมื่อราคาเด้งทดสอบแนวต้าน (Pullback SELL)" เท่านั้น';
      minConfidenceThreshold = 90;
    } else if (lastLossDirection === 'SELL' && isBullishTrend) {
      diagnosisKey = 'COUNTER_TREND_SELL_TRAP';
      diagnosisTitleTh = '🚨 ผิดพลาดจากการดัก SELL สวนแรงซื้อ (Counter-Trend Trap)';
      diagnosisDetailTh = 'ระบบตรวจสอบพบว่าไม้ที่แพ้เกิดจากการพยายามเข้า SELL ในขณะที่โครงสร้าง H1/M15 กำลังยกตัวขึ้นรุนแรง ทำให้แนวต้านย่อยถูกทะลุ';
      forbiddenDirection = 'SELL';
      recommendedFocus = 'BUY';
      tacticalActionTh = '🔒 ล็อคห้ามเข้า SELL ชั่วคราว! ปรับกลยุทธ์เป็น "ดัก BUY เมื่อราคาย่อทดสอบแนวรับ (Pullback BUY)" เท่านั้น';
      minConfidenceThreshold = 90;
    }
    // Case 2: Whipsaw Choppy Market (ตลาดไซด์เวย์สับขาหลอกในกรอบแคบ)
    else if (lossStreakTrades.length >= 2 && lossStreakTrades.some((t) => t.direction !== lastLossDirection)) {
      diagnosisKey = 'WHIPSAW_CHOP';
      diagnosisTitleTh = '⚡ ตลาด Sideway สับขาหลอกในกรอบแคบ (Whipsaw Range)';
      diagnosisDetailTh = 'ระบบพบการแพ้สลับฝั่ง (ทั้ง Buy และ Sell) เนื่องจากตลาดไม่มีเทรนด์ชัดเจนและสวิงแคบจนชน SL ทั้งสองฝั่ง';
      forbiddenDirection = null;
      recommendedFocus = 'DEFENSIVE_WAIT';
      tacticalActionTh = '🛡️ บังคับเข้าเฉพาะจุดขอบกรอบนอกสุด (Key Boundary Limit Orders) และห้ามเปิด Market Order เด็ดขาด';
      minConfidenceThreshold = 92;
    }
    // Case 3: Consecutive Losses in Same Direction
    else if (allLossesSameDirection) {
      if (lastLossDirection === 'SELL' && isBearishTrend) {
        // ในเทรนด์ขาลง แต่แพ้ Sell เพราะไปเข้าที่ก้นแนวรับ
        diagnosisKey = 'LATE_SELL_PULLBACK_REQUIRED';
        diagnosisTitleTh = '⚠️ เข้า SELL ล่าช้าที่ก้นแนวรับ (Late Sell Trap)';
        diagnosisDetailTh = 'เทรนด์ใหญ่เป็นขาลง แต่ไม้ที่แพ้เกิดจากการไล่ SELL ที่ก้นคลื่น ทำให้โดนเด้งรีบาวด์ชน SL';
        forbiddenDirection = null; // ไม่ห้าม SELL แต่ห้าม Sell ที่ก้น
        recommendedFocus = 'SELL';
        tacticalActionTh = '🔒 ห้ามไล่ SELL ที่ก้นคลื่นเด็ดขาด! ให้เปลี่ยนเป็นตั้ง "SELL_LIMIT ดักที่ยอดหัวคลื่นแนวต้าน H1/M15 (Pullback SELL)" เท่านั้น';
        minConfidenceThreshold = 92;
      } else if (lastLossDirection === 'BUY' && isBullishTrend) {
        // ในเทรนด์ขาขึ้น แต่แพ้ Buy เพราะไปเข้าที่ยอดต้าน
        diagnosisKey = 'LATE_BUY_PULLBACK_REQUIRED';
        diagnosisTitleTh = '⚠️ เข้า BUY ล่าช้าที่ยอดแนวต้าน (Late Buy Trap)';
        diagnosisDetailTh = 'เทรนด์ใหญ่เป็นขาขึ้น แต่ไม้ที่แพ้เกิดจากการไล่ BUY ที่ยอดคลื่น ทำให้โดนย่อตัวชน SL';
        forbiddenDirection = null;
        recommendedFocus = 'BUY';
        tacticalActionTh = '🔒 ห้ามไล่ BUY ที่ยอดคลื่นเด็ดขาด! ให้เปลี่ยนเป็นตั้ง "BUY_LIMIT ดักที่ก้นคลื่นแนวรับ H1/M15 (Pullback BUY)" เท่านั้น';
        minConfidenceThreshold = 92;
      } else {
        diagnosisKey = 'PERSISTENT_DIRECTIONAL_FAIL';
        diagnosisTitleTh = `⚠️ ฝั่ง ${lastLossDirection} เสียเปรียบต่อเนื่อง (Directional Failure)`;
        diagnosisDetailTh = `ระบบพบการโดน SL ฝั่ง ${lastLossDirection} ติดกัน ${consecutiveLossCount} ไม้ โมเมนตัมฝั่งนี้หมดกำลัง`;
        forbiddenDirection = lastLossDirection;
        recommendedFocus = lastLossDirection === 'BUY' ? 'SELL' : 'BUY';
        tacticalActionTh = `🔒 ระงับฝั่ง ${lastLossDirection} ทันที! เปลี่ยนโฟกัสไปดักฝั่ง ${recommendedFocus} ตามทิศทางราคาล่าสุด`;
        minConfidenceThreshold = 90;
      }
    }

    if (guardLevel === 'STRICT_LOCK') {
      minConfidenceThreshold = 92;
      tacticalActionTh += ' | ⛔ โหมดระวังสูงสุด: เพิ่มระยะ SL บังทุนเร็วขึ้นที่ +.50 (250 จุด)';
    }

    return {
      consecutiveLossCount,
      isAdaptiveGuardActive: true,
      guardLevel,
      lastLossDirection,
      forbiddenDirection,
      recommendedFocus,
      minConfidenceThreshold,
      diagnosisKey,
      diagnosisTitleTh,
      diagnosisDetailTh,
      tacticalActionTh,
      reviewedAt: new Date().toISOString(),
    };
  }
}
