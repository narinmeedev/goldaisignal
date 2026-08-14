import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  let fileContent = '';
  try {
    const primaryPath = path.join(process.cwd(), 'public', 'ea', 'GoldAISignal_AutoTrader.mq5');
    if (fs.existsSync(primaryPath)) {
      fileContent = fs.readFileSync(primaryPath, 'utf-8');
    }
  } catch {}

  if (!fileContent || !fileContent.includes('2.60')) {
    fileContent = `//+------------------------------------------------------------------+
//|                                  GoldAISignal_AutoTrader.mq5    |
//|                        Copyright 2026, Gold AI Signal Lab       |
//|                                     https://goldaisig.com        |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property link      "https://goldaisig.com"
#property version   "2.60"
#property description "Expert Advisor for MetaTrader 5 - Syncs Live Gold Candles & Auto-Executes AI Trade Plans"

#include <Trade\\Trade.mqh>

input group "--- Server Connection ---"
input string   InpServerURL                = "http://localhost:3000";
input string   InpSecret                   = "GOLD_AI_SECRET";

input group "--- Auto Trading Control ---"
input bool     InpAutoTrade                = true;
input double   InpLotSize                  = 0.01;
input ulong    InpMagicNumber              = 888999;
input ulong    InpSlippage                 = 30;
input int      InpSyncIntervalSec          = 3;

input group "--- Existing Order Management (เปิด/ปิด อัปเดตออเดอร์เดิม) ---"
input bool     InpAutoModifyExistingOrders = true;

input group "--- Custom Entry Offset (In Points / จุด) ---"
input int      InpEntryOffsetPoints        = 0;

input group "--- Custom Risk & Reward (In Points / จุด) ---"
input bool     InpUseCustomTPSL            = false;
input int      InpCustomTPPoints           = 450;
input int      InpCustomSLPoints           = 350;

CTrade         m_trade;
datetime       m_lastSyncTime = 0;
string         m_lastStatus = "Initializing...";
string         m_activePlanTitle = "";
string         m_activePlanType = "";
double         m_activeEntry = 0;
double         m_activeSL = 0;
double         m_activeTP = 0;
int            m_totalSyncCount = 0;

double GetPointValue() {
   double p = _Point;
   if(p <= 0) p = 0.01;
   return p;
}

int OnInit() {
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpSlippage);
   EventSetTimer(InpSyncIntervalSec);
   UpdateChartHUD();
   SyncCandlesAndFetchPlan();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   EventKillTimer();
   Comment("");
}

void OnTimer() { SyncCandlesAndFetchPlan(); }
void OnTick() { if(TimeCurrent() - m_lastSyncTime >= InpSyncIntervalSec) SyncCandlesAndFetchPlan(); }

void UpdateChartHUD() {
   string lastTimeStr = (m_lastSyncTime > 0) ? TimeToString(m_lastSyncTime, TIME_DATE|TIME_SECONDS) : "Waiting for first sync...";
   double pointVal = GetPointValue();
   double entryOffsetDist = InpEntryOffsetPoints * pointVal;
   double customTPDist = InpCustomTPPoints * pointVal;
   double customSLDist = InpCustomSLPoints * pointVal;
   
   string hud = "=====================================================\\n";
   hud += "       🏆 GOLD AI SIGNAL - AUTO TRADER EA (v2.60)     \\n";
   hud += "=====================================================\\n";
   hud += " 🌐 Server URL  : " + InpServerURL + "\\n";
   hud += " ⚡ Live Status : " + m_lastStatus + "\\n";
   hud += " 🕒 Last Sync   : " + lastTimeStr + " (Total: " + IntegerToString(m_totalSyncCount) + " syncs)\\n";
   hud += "-----------------------------------------------------\\n";
   
   if(m_activePlanType != "" && m_activeEntry > 0) {
      bool isBuy = (m_activePlanType == "BUY" || m_activePlanType == "BUY_LIMIT" || m_activePlanType == "BUY_MARKET");
      double finalEntry = m_activeEntry;
      if(InpEntryOffsetPoints > 0) finalEntry = isBuy ? (m_activeEntry - entryOffsetDist) : (m_activeEntry + entryOffsetDist);
      
      double finalSL = m_activeSL;
      double finalTP = m_activeTP;
      
      if(InpUseCustomTPSL) {
         finalSL = isBuy ? (finalEntry - customSLDist) : (finalEntry + customSLDist);
         finalTP = isBuy ? (finalEntry + customTPDist) : (finalEntry - customTPDist);
      }
      
      double slPoints = MathAbs(finalEntry - finalSL) / pointVal;
      double tpPoints = MathAbs(finalTP - finalEntry) / pointVal;
      
      hud += " 📌 ACTIVE PLAN : " + m_activePlanTitle + "\\n";
      hud += " 📊 ORDER TYPE  : " + m_activePlanType + "\\n";
      hud += " 🎯 ENTRY TARGET: $" + DoubleToString(finalEntry, 2) + (InpEntryOffsetPoints > 0 ? " [Offset: " + IntegerToString(InpEntryOffsetPoints) + " จุด]" : "") + "\\n";
      hud += " 🔴 STOP LOSS   : $" + DoubleToString(finalSL, 2) + " (" + IntegerToString((int)MathRound(slPoints)) + " จุด)" + (InpUseCustomTPSL ? " [Custom Points]" : "") + "\\n";
      hud += " 🟢 TAKE PROFIT : $" + DoubleToString(finalTP, 2) + " (" + IntegerToString((int)MathRound(tpPoints)) + " จุด)" + (InpUseCustomTPSL ? " [Custom Points]" : "") + "\\n";
   } else {
      hud += " 📌 ACTIVE PLAN : ⏳ Synchronizing & Calculating Live AI Setup...\\n";
   }
   
   hud += "-----------------------------------------------------\\n";
   hud += " 🤖 Auto Trading  : " + (InpAutoTrade ? "🟢 ENABLED (Lot Size: " + DoubleToString(InpLotSize, 2) + ")" : "🔴 DISABLED") + "\\n";
   hud += " 🔄 Modify Orders: " + (InpAutoModifyExistingOrders ? "🟢 ON (Auto-Update Existing Orders)" : "🔴 OFF (Keep Original Orders)") + "\\n";
   hud += " 📐 Entry Offset  : " + (InpEntryOffsetPoints > 0 ? "🟢 ACTIVE (" + IntegerToString(InpEntryOffsetPoints) + " จุด / $" + DoubleToString(entryOffsetDist, 2) + ")" : "⚪ 0 จุด (Exact AI Entry)") + "\\n";
   hud += " ⚙️ Custom TP/SL  : " + (InpUseCustomTPSL ? "🟢 ACTIVE (TP: " + IntegerToString(InpCustomTPPoints) + " จุด / SL: " + IntegerToString(InpCustomSLPoints) + " จุด)" : "⚪ OFF (AI Target)") + "\\n";
   hud += " 🔑 Magic Number  : " + IntegerToString(InpMagicNumber) + "\\n";
   hud += "=====================================================";
   
   Comment(hud);
}

string FormatCandleJSON(datetime time, double open, double high, double low, double close, long volume) {
   string timeStr = TimeToString(time, TIME_DATE|TIME_SECONDS);
   StringReplace(timeStr, ".", "-");
   return StringFormat("{\\"time\\":\\"%s\\",\\"open\\":%.2f,\\"high\\":%.2f,\\"low\\":%.2f,\\"close\\":%.2f,\\"volume\\":%i}", timeStr, open, high, low, close, volume);
}

string ExtractJSONValue(const string &json, const string &key) {
   string searchKey = "\\"" + key + "\\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return "";
   int start = pos + StringLen(searchKey);
   while(start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\\t')) start++;
   ushort firstChar = StringGetCharacter(json, start);
   if(firstChar == '"') {
      start++;
      int end = StringFind(json, "\\"", start);
      if(end < 0) return "";
      return StringSubstr(json, start, end - start);
   } else {
      int end = start;
      while(end < StringLen(json)) {
         ushort c = StringGetCharacter(json, end);
         if(c == ',' || c == '}' || c == ']' || c == ' ' || c == '\\r' || c == '\\n') break;
         end++;
      }
      return StringSubstr(json, start, end - start);
   }
}

void SyncCandlesAndFetchPlan() {
   m_lastSyncTime = TimeCurrent();
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M5, 0, 20, rates);
   if(copied <= 0) { m_lastStatus = "🔴 ERROR: CopyRates failed for " + _Symbol; UpdateChartHUD(); return; }
   string candlesArrayStr = "";
   for(int i = copied - 1; i >= 0; i--) {
      string cJson = FormatCandleJSON(rates[i].time, rates[i].open, rates[i].high, rates[i].low, rates[i].close, rates[i].tick_volume);
      candlesArrayStr += cJson;
      if(i > 0) candlesArrayStr += ",";
   }
   string payload = StringFormat("{\\"secret\\":\\"%s\\",\\"symbol\\":\\"%s\\",\\"timeframe\\":\\"M5\\",\\"candles\\":[%s]}", InpSecret, _Symbol, candlesArrayStr);
   string url = InpServerURL + "/api/admin/candles/sync";
   string headers = "Content-Type: application/json\\r\\n";
   char postData[]; char resultData[]; string resultHeaders;
   StringToCharArray(payload, postData, 0, StringLen(payload), CP_UTF8);
   if(ArraySize(postData) > 0 && postData[ArraySize(postData)-1] == 0) ArrayResize(postData, ArraySize(postData)-1);
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, postData, resultData, resultHeaders);
   if(res == 200) {
      m_totalSyncCount++;
      m_lastStatus = "🟢 LIVE CONNECTED & SYNCING (HTTP 200 OK)";
      string responseJson = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      ProcessServerResponse(responseJson);
   } else {
      m_lastStatus = "🔴 ERROR: HTTP " + IntegerToString(res) + " (Err Code: " + IntegerToString(GetLastError()) + ")";
      UpdateChartHUD();
   }
}

void ProcessServerResponse(const string &json) {
   int activePlanPos = StringFind(json, "\\"activePlan\\":");
   if(activePlanPos >= 0) {
      int planBlockStart = StringFind(json, "{", activePlanPos);
      int planBlockEnd = (planBlockStart >= 0) ? StringFind(json, "}", planBlockStart) : -1;
      if(planBlockStart >= 0 && planBlockEnd > planBlockStart) {
         string planBlock = StringSubstr(json, planBlockStart, planBlockEnd - planBlockStart + 1);
         string planId   = ExtractJSONValue(planBlock, "id");
         string planTitle= ExtractJSONValue(planBlock, "title");
         string planType = ExtractJSONValue(planBlock, "type");
         double entry    = StringToDouble(ExtractJSONValue(planBlock, "entry"));
         double stopLoss = StringToDouble(ExtractJSONValue(planBlock, "stopLoss"));
         double takeProf = StringToDouble(ExtractJSONValue(planBlock, "takeProfit"));
         string isClosedStr = ExtractJSONValue(planBlock, "isClosed");
         bool   isClosed = (isClosedStr == "true");
         if(planId != "" && entry > 0 && !isClosed) {
            m_activePlanTitle = planTitle; m_activePlanType = planType;
            m_activeEntry = entry; m_activeSL = stopLoss; m_activeTP = takeProf;
            if(InpAutoTrade) ExecuteTradePlan(planId, planType, entry, stopLoss, takeProf);
         } else {
            m_activePlanTitle = "Waiting for Market Setup"; m_activePlanType = "";
            m_activeEntry = 0; m_activeSL = 0; m_activeTP = 0;
            CancelEAPendingOrders();
         }
      }
   }
   UpdateChartHUD();
}

void ExecuteTradePlan(string planId, string planType, double rawEntry, double rawSL, double rawTP) {
   bool isBuy = (planType == "BUY" || planType == "BUY_LIMIT" || planType == "BUY_MARKET");
   double pointVal = GetPointValue();
   double entryOffsetDist = InpEntryOffsetPoints * pointVal;
   double customTPDist = InpCustomTPPoints * pointVal;
   double customSLDist = InpCustomSLPoints * pointVal;
   
   double entry = rawEntry;
   if(InpEntryOffsetPoints > 0) entry = isBuy ? (rawEntry - entryOffsetDist) : (rawEntry + entryOffsetDist);
   
   double finalSL = rawSL;
   double finalTP = rawTP;
   if(InpUseCustomTPSL) {
      finalSL = isBuy ? (entry - customSLDist) : (entry + customSLDist);
      finalTP = isBuy ? (entry + customTPDist) : (entry - customTPDist);
   } else if(InpEntryOffsetPoints > 0) {
      double slDist = MathAbs(rawEntry - rawSL);
      double tpDist = MathAbs(rawTP - rawEntry);
      finalSL = isBuy ? (entry - slDist) : (entry + slDist);
      finalTP = isBuy ? (entry - tpDist) : (entry + tpDist);
   }

   for(int i = OrdersTotal() - 1; i >= 0; i--) {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber) {
         double currentEntry = OrderGetDouble(ORDER_PRICE_OPEN);
         double currentSL = OrderGetDouble(ORDER_SL);
         double currentTP = OrderGetDouble(ORDER_TP);
         if(InpAutoModifyExistingOrders) {
            if(MathAbs(currentEntry - entry) > 0.05 || MathAbs(currentSL - finalSL) > 0.05 || MathAbs(currentTP - finalTP) > 0.05) {
               m_trade.OrderModify(ticket, entry, finalSL, finalTP, ORDER_TIME_GTC, 0);
            }
         }
         return;
      }
   }
   
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber) {
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         double currentSL = PositionGetDouble(POSITION_SL);
         double currentTP = PositionGetDouble(POSITION_TP);
         if(InpAutoModifyExistingOrders) {
            if(MathAbs(currentSL - finalSL) > 0.05 || MathAbs(currentTP - finalTP) > 0.05) {
               m_trade.PositionModify(ticket, finalSL, finalTP);
            }
         }
         return;
      }
   }
   
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   if(isBuy) {
      if(ask <= entry + 0.50 && ask >= entry - 1.50) m_trade.Buy(InpLotSize, _Symbol, ask, finalSL, finalTP, "GoldAI: " + planId);
      else if(ask > entry) m_trade.BuyLimit(InpLotSize, entry, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
      else m_trade.Buy(InpLotSize, _Symbol, ask, finalSL, finalTP, "GoldAI: " + planId);
   } else {
      if(bid >= entry - 0.50 && bid <= entry + 1.50) m_trade.Sell(InpLotSize, _Symbol, bid, finalSL, finalTP, "GoldAI: " + planId);
      else if(bid < entry) m_trade.SellLimit(InpLotSize, entry, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
      else m_trade.Sell(InpLotSize, _Symbol, bid, finalSL, finalTP, "GoldAI: " + planId);
   }
}

void CancelEAPendingOrders() {
   for(int i = OrdersTotal() - 1; i >= 0; i--) {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber) m_trade.OrderDelete(ticket);
   }
}
`;
  }

  return new NextResponse(fileContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="GoldAISignal_AutoTrader.mq5"',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
