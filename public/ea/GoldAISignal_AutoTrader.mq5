//+------------------------------------------------------------------+
//|                                  GoldAISignal_AutoTrader.mq5    |
//|                        Copyright 2026, Gold AI Signal Lab       |
//|                                     https://goldaisig.com        |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property link      "https://goldaisig.com"
#property version   "2.90"
#property description "Expert Advisor for MetaTrader 5 - Safe Scalp Engine with Auto Break-Even & Trailing Stop"

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                 |
//+------------------------------------------------------------------+
input group "--- Server Connection ---"
input string   InpServerURL                = "http://localhost:3000"; // Server URL (localhost:3000 or https://goldaisig.com)
input string   InpSecret                   = "GOLD_AI_SECRET";       // Webhook Secret Key

input group "--- Auto Trading Control ---"
input bool     InpAutoTrade                = true;                   // Enable Automatic Execution of AI Trade Plans
input double   InpLotSize                  = 0.01;                   // Order Lot Size
input ulong    InpMagicNumber              = 888999;                 // Magic Number for EA Orders
input ulong    InpSlippage                 = 30;                     // Slippage in Points
input int      InpSyncIntervalSec          = 3;                      // Candle & Price Sync Interval (Seconds)

input group "--- Visual Chart Lines (วาดเส้นแผนบนกราฟ) ---"
input bool     InpDrawChartLines           = true;                   // Draw Visual Entry, SL, and TP Lines on Chart (true = วาดเส้นแนวบนกราฟ, false = ไม่วาด)

input group "--- Direction Flip & Position Management ---"
input bool     InpAutoCloseOnFlip          = true;                   // Auto-Close Old Opposite Position when AI Flips Direction (true = เปิดปิดให้อัตโนมัติ, false = ปิด)
input bool     InpAutoModifyExistingOrders = true;                   // Auto-Update Existing Active Orders on Chart (true = เปิดอัปเดตตาม, false = ปิด)

input group "--- Custom Entry Offset (In Points / จุด) ---"
input int      InpEntryOffsetPoints        = 0;                      // Entry Offset in Points (e.g. 150 points = Shift Entry $1.50 deeper)

input group "--- Custom Risk & Scalp Targets (In Points / จุด) ---"
input bool     InpUseCustomTPSL            = false;                  // Enable Custom TP / SL Override (true = Use Custom Points, false = Use AI Target)
input int      InpCustomTPPoints           = 280;                    // Custom Safe Scalp TP in Points (e.g. 280 points = $2.80 / 28 pips)
input int      InpCustomSLPoints           = 300;                    // Custom Safe SL in Points (e.g. 300 points = $3.00 / 30 pips)

input group "--- Auto Break-Even (ล็อคหน้าทุนอัตโนมัติ) ---"
input bool     InpEnableBreakEven          = true;                   // Enable Auto Break-Even (ขยับ SL บังหน้าทุนเมื่อกำไรถึงเป้า)
input int      InpBreakEvenTriggerPoints   = 150;                    // Break-Even Trigger in Points (กำไรบวก 150 จุด = $1.50 ให้เริ่มล็อค)
input int      InpBreakEvenLockPoints      = 20;                     // Profit to Lock in Points (ล็อคกำไรขั้นต่ำ 20 จุด = $0.20 กันตกรถ)

input group "--- Trailing Stop (เลื่อน SL ล็อคกำไรตามเทรนด์) ---"
input bool     InpEnableTrailing           = true;                   // Enable Trailing Stop (เลื่อน SL ตามราคากำไรอัตโนมัติ)
input int      InpTrailingStartPoints      = 200;                    // Trailing Start in Points (เริ่มเลื่อนเมื่อกำไรบวก 200 จุด = $2.00)
input int      InpTrailingDistPoints       = 150;                    // Trailing Distance in Points (รักษาระยะห่าง 150 จุด = $1.50)

//+------------------------------------------------------------------+
//| Global Variables                                                 |
//+------------------------------------------------------------------+
CTrade         m_trade;
datetime       m_lastSyncTime = 0;
string         m_lastStatus = "Initializing...";
string         m_activePlanTitle = "";
string         m_activePlanType = "";
double         m_activeEntry = 0;
double         m_activeSL = 0;
double         m_activeTP = 0;
int            m_totalSyncCount = 0;

//+------------------------------------------------------------------+
//| Helper: Get Point Value for Gold Symbol                          |
//+------------------------------------------------------------------+
double GetPointValue()
{
   double p = _Point;
   if(p <= 0) p = 0.01;
   return p;
}

//+------------------------------------------------------------------+
//| Helper: Draw Visual Horizontal Line on MT5 Chart                |
//+------------------------------------------------------------------+
void DrawChartLine(string name, double price, color col, ENUM_LINE_STYLE style, int width, string label)
{
   if(price <= 0) return;
   
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   }
   else
   {
      ObjectMove(0, name, 0, 0, price);
   }
   
   ObjectSetInteger(0, name, OBJPROP_COLOR, col);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetString(0, name, OBJPROP_TEXT, label);
}

//+------------------------------------------------------------------+
//| Helper: Clear Visual Chart Lines                                 |
//+------------------------------------------------------------------+
void ClearChartLines()
{
   ObjectDelete(0, "GoldAI_Line_Entry");
   ObjectDelete(0, "GoldAI_Line_SL");
   ObjectDelete(0, "GoldAI_Line_TP");
}

//+------------------------------------------------------------------+
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpSlippage);

   EventSetTimer(InpSyncIntervalSec);
   Print("[GoldAISignal EA] Initialized v2.90 successfully. Break-Even: ", InpEnableBreakEven ? "ON" : "OFF", " Trailing: ", InpEnableTrailing ? "ON" : "OFF");
   
   UpdateChartHUD();
   SyncCandlesAndFetchPlan();
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert Deinitialization Function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment(""); // Clear chart HUD
   ClearChartLines(); // Clear visual lines
   Print("[GoldAISignal EA] Deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert Timer Function                                            |
//+------------------------------------------------------------------+
void OnTimer()
{
   SyncCandlesAndFetchPlan();
}

//+------------------------------------------------------------------+
//| Expert Tick Function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   ManageActivePositions();

   if(TimeCurrent() - m_lastSyncTime >= InpSyncIntervalSec)
   {
      SyncCandlesAndFetchPlan();
   }
}

//+------------------------------------------------------------------+
//| Position Protection: Auto Break-Even & Trailing Stop Engine      |
//+------------------------------------------------------------------+
void ManageActivePositions()
{
   if(!InpEnableBreakEven && !InpEnableTrailing) return;
   
   double pointVal = GetPointValue();
   double beTriggerDist  = InpBreakEvenTriggerPoints * pointVal;
   double beLockDist     = InpBreakEvenLockPoints * pointVal;
   double trailStartDist = InpTrailingStartPoints * pointVal;
   double trailDist      = InpTrailingDistPoints * pointVal;
   
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         ulong  ticket       = PositionGetInteger(POSITION_TICKET);
         long   posType      = PositionGetInteger(POSITION_TYPE);
         double openPrice    = PositionGetDouble(POSITION_PRICE_OPEN);
         double currentSL    = PositionGetDouble(POSITION_SL);
         double currentTP    = PositionGetDouble(POSITION_TP);
         double currentPrice = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         
         if(posType == POSITION_TYPE_BUY)
         {
            double profitDist = currentPrice - openPrice;
            
            // 1. Auto Break-Even Check
            if(InpEnableBreakEven && profitDist >= beTriggerDist)
            {
               double targetSL = openPrice + beLockDist;
               if(currentSL < targetSL - 0.01)
               {
                  Print("[GoldAISignal EA] 🛡️ Auto Break-Even Triggered! Moving BUY #", ticket, " SL to $", targetSL);
                  m_trade.PositionModify(ticket, targetSL, currentTP);
                  currentSL = targetSL;
               }
            }
            
            // 2. Trailing Stop Check
            if(InpEnableTrailing && profitDist >= trailStartDist)
            {
               double targetSL = currentPrice - trailDist;
               if(targetSL > currentSL + 0.10)
               {
                  Print("[GoldAISignal EA] 📈 Trailing Stop: Moving BUY #", ticket, " SL to $", targetSL);
                  m_trade.PositionModify(ticket, targetSL, currentTP);
               }
            }
         }
         else if(posType == POSITION_TYPE_SELL)
         {
            double profitDist = openPrice - currentPrice;
            
            // 1. Auto Break-Even Check
            if(InpEnableBreakEven && profitDist >= beTriggerDist)
            {
               double targetSL = openPrice - beLockDist;
               if(currentSL > targetSL + 0.01 || currentSL == 0)
               {
                  Print("[GoldAISignal EA] 🛡️ Auto Break-Even Triggered! Moving SELL #", ticket, " SL to $", targetSL);
                  m_trade.PositionModify(ticket, targetSL, currentTP);
                  currentSL = targetSL;
               }
            }
            
            // 2. Trailing Stop Check
            if(InpEnableTrailing && profitDist >= trailStartDist)
            {
               double targetSL = currentPrice + trailDist;
               if(targetSL < currentSL - 0.10 || currentSL == 0)
               {
                  Print("[GoldAISignal EA] 📉 Trailing Stop: Moving SELL #", ticket, " SL to $", targetSL);
                  m_trade.PositionModify(ticket, targetSL, currentTP);
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Render On-Screen HUD Panel & Visual Lines on MT5 Chart           |
//+------------------------------------------------------------------+
void UpdateChartHUD()
{
   string lastTimeStr = (m_lastSyncTime > 0) ? TimeToString(m_lastSyncTime, TIME_DATE|TIME_SECONDS) : "Waiting for first sync...";
   double pointVal = GetPointValue();
   double entryOffsetDist = InpEntryOffsetPoints * pointVal;
   double customTPDist = InpCustomTPPoints * pointVal;
   double customSLDist = InpCustomSLPoints * pointVal;
   
   string hud = "=====================================================\n";
   hud += "       🏆 GOLD AI SIGNAL - AUTO TRADER EA (v2.90)     \n";
   hud += "=====================================================\n";
   hud += " 🌐 Server URL  : " + InpServerURL + "\n";
   hud += " ⚡ Live Status : " + m_lastStatus + "\n";
   hud += " 🕒 Last Sync   : " + lastTimeStr + " (Total: " + IntegerToString(m_totalSyncCount) + " syncs)\n";
   hud += " 🛡️ Break-Even  : " + (InpEnableBreakEven ? ("ON (+" + IntegerToString(InpBreakEvenTriggerPoints) + " pts)") : "OFF") + "\n";
   hud += " 📈 Trailing    : " + (InpEnableTrailing ? ("ON (+" + IntegerToString(InpTrailingStartPoints) + " pts)") : "OFF") + "\n";
   hud += "-----------------------------------------------------\n";
   
   if(m_activePlanType != "" && m_activeEntry > 0)
   {
      bool isBuy = (m_activePlanType == "BUY" || m_activePlanType == "BUY_LIMIT" || m_activePlanType == "BUY_MARKET");
      
      // Calculate Entry with Offset
      double finalEntry = m_activeEntry;
      if(InpEntryOffsetPoints > 0)
      {
         finalEntry = isBuy ? (m_activeEntry - entryOffsetDist) : (m_activeEntry + entryOffsetDist);
      }
      
      // Calculate SL & TP
      double finalSL = m_activeSL;
      double finalTP = m_activeTP;
      
      if(InpUseCustomTPSL)
      {
         finalSL = isBuy ? (finalEntry - customSLDist) : (finalEntry + customSLDist);
         finalTP = isBuy ? (finalEntry + customTPDist) : (finalEntry - customTPDist);
      }
      else if(InpEntryOffsetPoints > 0)
      {
         double slDist = MathAbs(m_activeEntry - m_activeSL);
         double tpDist = MathAbs(m_activeTP - m_activeEntry);
         finalSL = isBuy ? (finalEntry - slDist) : (finalEntry + slDist);
         finalTP = isBuy ? (finalEntry + tpDist) : (finalEntry - tpDist);
      }

      hud += " 📌 Active Plan : " + m_activePlanTitle + "\n";
      hud += " 📊 Plan Type   : " + m_activePlanType + "\n";
      hud += " 🎯 Entry Target: $" + DoubleToString(finalEntry, 2);
      if(InpEntryOffsetPoints > 0) hud += " (Offset: -" + IntegerToString(InpEntryOffsetPoints) + " pts)";
      hud += "\n";
      hud += " 🔴 Stop Loss   : $" + DoubleToString(finalSL, 2);
      if(InpUseCustomTPSL) hud += " (Custom: " + IntegerToString(InpCustomSLPoints) + " pts)";
      hud += "\n";
      hud += " 🟢 Take Profit : $" + DoubleToString(finalTP, 2);
      if(InpUseCustomTPSL) hud += " (Custom: " + IntegerToString(InpCustomTPPoints) + " pts)";
      hud += "\n";
      
      // Draw Real-Time Visual Lines on Chart
      if(InpDrawChartLines)
      {
         DrawChartLine("GoldAI_Line_Entry", finalEntry, clrDeepSkyBlue, STYLE_SOLID, 2, "GoldAI ENTRY $" + DoubleToString(finalEntry, 2));
         DrawChartLine("GoldAI_Line_SL", finalSL, clrCrimson, STYLE_DASH, 2, "GoldAI SL $" + DoubleToString(finalSL, 2));
         DrawChartLine("GoldAI_Line_TP", finalTP, clrLimeGreen, STYLE_SOLID, 2, "GoldAI TP $" + DoubleToString(finalTP, 2));
      }
      else
      {
         ClearChartLines();
      }
   }
   else
   {
      hud += " 📌 Active Plan : Waiting for High-Probability Setup\n";
      hud += " 📊 Strategy    : Multi-Timeframe Trend & Support/Resistance\n";
      ClearChartLines();
   }
   
   hud += "-----------------------------------------------------\n";
   hud += " ⚙️ AutoTrade   : " + (InpAutoTrade ? "ENABLED (Lot: " + DoubleToString(InpLotSize, 2) + ")" : "DISABLED") + "\n";
   hud += " ⚙️ Flip Close  : " + (InpAutoCloseOnFlip ? "ENABLED (Smart Flip Close)" : "DISABLED") + "\n";
   hud += " ⚙️ Modify Auto : " + (InpAutoModifyExistingOrders ? "ENABLED (Live Order Adjust)" : "DISABLED") + "\n";
   hud += "=====================================================\n";
   
   Comment(hud);
}

//+------------------------------------------------------------------+
//| Extract Value from Simple JSON string                            |
//+------------------------------------------------------------------+
string ExtractJSONValue(const string &json, const string &key)
{
   string searchKey = "\"" + key + "\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return "";
   
   int start = pos + StringLen(searchKey);
   while(start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\t'))
      start++;
      
   if(start >= StringLen(json)) return "";
   
   ushort firstChar = StringGetCharacter(json, start);
   if(firstChar == '"')
   {
      start++;
      int end = StringFind(json, "\"", start);
      if(end > start)
         return StringSubstr(json, start, end - start);
      return "";
   }
   else
   {
      int end = start;
      while(end < StringLen(json))
      {
         ushort c = StringGetCharacter(json, end);
         if(c == ',' || c == '}' || c == ']' || c == '\n' || c == '\r' || c == ' ')
            break;
         end++;
      }
      return StringSubstr(json, start, end - start);
   }
}

//+------------------------------------------------------------------+
//| Sync Candles & Fetch Active Plan from Server                     |
//+------------------------------------------------------------------+
void SyncCandlesAndFetchPlan()
{
   m_lastSyncTime = TimeCurrent();
   
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M5, 0, 30, rates);
   if(copied <= 0)
   {
      m_lastStatus = "Error: Failed to copy M5 rates (Code " + IntegerToString(GetLastError()) + ")";
      UpdateChartHUD();
      return;
   }
   
   string candlesArrayStr = "";
   for(int i = copied - 1; i >= 0; i--)
   {
      string timeStr = TimeToString(rates[i].time, TIME_DATE|TIME_SECONDS);
      StringReplace(timeStr, ".", "-");
      timeStr = StringSubstr(timeStr, 0, 10) + "T" + StringSubstr(timeStr, 11, 8) + "Z";
      
      string cJson = StringFormat("{\"time\":\"%s\",\"open\":%.2f,\"high\":%.2f,\"low\":%.2f,\"close\":%.2f,\"volume\":%d}",
                                  timeStr, rates[i].open, rates[i].high, rates[i].low, rates[i].close, rates[i].tick_volume);
      candlesArrayStr += cJson;
      if(i > 0) candlesArrayStr += ",";
   }
   
   string payload = StringFormat("{\"secret\":\"%s\",\"symbol\":\"%s\",\"timeframe\":\"M5\",\"candles\":[%s]}",
                                 InpSecret, _Symbol, candlesArrayStr);
                                 
   string url = InpServerURL + "/api/admin/candles/sync";
   string headers = "Content-Type: application/json\r\n";
   char postData[];
   char resultData[];
   string resultHeaders;
   
   StringToCharArray(payload, postData, 0, StringLen(payload), CP_UTF8);
   if(ArraySize(postData) > 0 && postData[ArraySize(postData)-1] == 0)
      ArrayResize(postData, ArraySize(postData)-1);
      
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, postData, resultData, resultHeaders);
   
   if(res == 200)
   {
      m_totalSyncCount++;
      m_lastStatus = "🟢 LIVE CONNECTED & SYNCING (HTTP 200 OK)";
      string responseJson = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      ProcessServerResponse(responseJson);
   }
   else
   {
      m_lastStatus = "🔴 ERROR: HTTP " + IntegerToString(res) + " (Err Code: " + IntegerToString(GetLastError()) + ")";
      UpdateChartHUD();
      Print("[GoldAISignal EA] WebRequest failed. HTTP Status: ", res, " Error: ", GetLastError(), 
            " (Ensure ", InpServerURL, " is added to MT5 Tools -> Options -> Expert Advisors -> Allow WebRequest)");
   }
}

//+------------------------------------------------------------------+
//| Process Response & Execute Trades                                |
//+------------------------------------------------------------------+
void ProcessServerResponse(const string &json)
{
   // Extract activePlan block
   int activePlanPos = StringFind(json, "\"activePlan\":");
   if(activePlanPos >= 0)
   {
      int planBlockStart = StringFind(json, "{", activePlanPos);
      int planBlockEnd = (planBlockStart >= 0) ? StringFind(json, "}", planBlockStart) : -1;
      
      if(planBlockStart >= 0 && planBlockEnd > planBlockStart)
      {
         string planBlock = StringSubstr(json, planBlockStart, planBlockEnd - planBlockStart + 1);
         
         string planId   = ExtractJSONValue(planBlock, "id");
         string planTitle= ExtractJSONValue(planBlock, "title");
         string planType = ExtractJSONValue(planBlock, "type");
         double entry    = StringToDouble(ExtractJSONValue(planBlock, "entry"));
         double stopLoss = StringToDouble(ExtractJSONValue(planBlock, "stopLoss"));
         double takeProf = StringToDouble(ExtractJSONValue(planBlock, "takeProfit"));
         string isClosedStr = ExtractJSONValue(planBlock, "isClosed");
         bool   isClosed = (isClosedStr == "true");
         
         if(planId != "" && entry > 0 && !isClosed)
         {
            m_activePlanTitle = planTitle;
            m_activePlanType  = planType;
            m_activeEntry     = entry;
            m_activeSL        = stopLoss;
            m_activeTP        = takeProf;
            
            if(InpAutoTrade)
            {
               ExecuteTradePlan(planId, planType, entry, stopLoss, takeProf);
            }
         }
         else
         {
            m_activePlanTitle = "Waiting for Market Setup";
            m_activePlanType  = "";
            m_activeEntry     = 0;
            m_activeSL        = 0;
            m_activeTP        = 0;
            CancelEAPendingOrders();
            ClearChartLines();
         }
      }
   }
   else
   {
      m_activePlanTitle = "Waiting for Market Setup";
      m_activePlanType  = "";
      m_activeEntry     = 0;
      m_activeSL        = 0;
      m_activeTP        = 0;
      CancelEAPendingOrders();
      ClearChartLines();
   }
   
   UpdateChartHUD();
}

//+------------------------------------------------------------------+
//| Smart Order Execution & Direction Flip Auto-Close Engine         |
//+------------------------------------------------------------------+
void ExecuteTradePlan(string planId, string planType, double rawEntry, double rawSL, double rawTP)
{
   bool isBuy = (planType == "BUY" || planType == "BUY_LIMIT" || planType == "BUY_MARKET");
   double pointVal = GetPointValue();
   double entryOffsetDist = InpEntryOffsetPoints * pointVal;
   double customTPDist = InpCustomTPPoints * pointVal;
   double customSLDist = InpCustomSLPoints * pointVal;
   
   // Calculate Adjusted Entry with InpEntryOffsetPoints
   double entry = rawEntry;
   if(InpEntryOffsetPoints > 0)
   {
      entry = isBuy ? (rawEntry - entryOffsetDist) : (rawEntry + entryOffsetDist);
   }
   
   // Override SL & TP if Custom Points Override is enabled
   double finalSL = rawSL;
   double finalTP = rawTP;
   
   if(InpUseCustomTPSL)
   {
      finalSL = isBuy ? (entry - customSLDist) : (entry + customSLDist);
      finalTP = isBuy ? (entry + customTPDist) : (entry - customTPDist);
   }
   else if(InpEntryOffsetPoints > 0)
   {
      double slDist = MathAbs(rawEntry - rawSL);
      double tpDist = MathAbs(rawTP - rawEntry);
      finalSL = isBuy ? (entry - slDist) : (entry + slDist);
      finalTP = isBuy ? (entry + tpDist) : (entry - tpDist);
   }

   // 1. Check Pending Orders: Cancel old pending order if direction flipped
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
      {
         long orderType = OrderGetInteger(ORDER_TYPE);
         bool orderIsBuy = (orderType == ORDER_TYPE_BUY_LIMIT || orderType == ORDER_TYPE_BUY_STOP || orderType == ORDER_TYPE_BUY);
         
         if(isBuy != orderIsBuy)
         {
            Print("[GoldAISignal EA] AI Direction Flipped to ", planType, "! Deleting old pending order #", ticket);
            m_trade.OrderDelete(ticket);
         }
         else if(InpAutoModifyExistingOrders)
         {
            double currentEntry = OrderGetDouble(ORDER_PRICE_OPEN);
            double currentSL = OrderGetDouble(ORDER_SL);
            double currentTP = OrderGetDouble(ORDER_TP);
            if(MathAbs(currentEntry - entry) > 0.05 || MathAbs(currentSL - finalSL) > 0.05 || MathAbs(currentTP - finalTP) > 0.05)
            {
               Print("[GoldAISignal EA] Modifying Existing Pending Order #", ticket, " -> Entry: ", entry, " SL: ", finalSL, " TP: ", finalTP);
               m_trade.OrderModify(ticket, entry, finalSL, finalTP, ORDER_TIME_GTC, 0);
            }
            return;
         }
      }
   }
   
   // 2. Check Open Positions: Auto-Close if direction flipped (InpAutoCloseOnFlip)
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         long posType = PositionGetInteger(POSITION_TYPE);
         bool posIsBuy = (posType == POSITION_TYPE_BUY);
         ulong ticket = PositionGetInteger(POSITION_TICKET);
         
         if(isBuy != posIsBuy)
         {
            if(InpAutoCloseOnFlip)
            {
               Print("[GoldAISignal EA] AI Direction Flipped to ", planType, "! Auto-closing opposite position #", ticket);
               m_trade.PositionClose(ticket);
               // Proceed to open new flipped order below
            }
            else
            {
               Print("[GoldAISignal EA] Opposite position active #", ticket, " (InpAutoCloseOnFlip is OFF, keeping position)");
               return;
            }
         }
         else
         {
            if(InpAutoModifyExistingOrders)
            {
               double currentSL = PositionGetDouble(POSITION_SL);
               double currentTP = PositionGetDouble(POSITION_TP);
               if(MathAbs(currentSL - finalSL) > 0.05 || MathAbs(currentTP - finalTP) > 0.05)
               {
                  Print("[GoldAISignal EA] Modifying Open Position #", ticket, " -> SL: ", finalSL, " TP: ", finalTP);
                  m_trade.PositionModify(ticket, finalSL, finalTP);
               }
            }
            return; // Position active in matching direction
         }
      }
   }
   
   // 3. Smart execution: Handle Limit vs Market Order based on current Ask/Bid
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   if(isBuy)
   {
      if(ask <= entry + 0.50 && ask >= entry - 1.50)
      {
         Print("[GoldAISignal EA] Executing Market BUY at Ask: ", ask, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.Buy(InpLotSize, _Symbol, ask, finalSL, finalTP, "GoldAI: " + planId);
      }
      else if(ask > entry)
      {
         Print("[GoldAISignal EA] Placing BUY_LIMIT at ", entry, " Ask: ", ask, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.BuyLimit(InpLotSize, entry, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
      }
      else
      {
         Print("[GoldAISignal EA] Price dropped below entry. Executing Market BUY at Ask: ", ask);
         m_trade.Buy(InpLotSize, _Symbol, ask, finalSL, finalTP, "GoldAI: " + planId);
      }
   }
   else
   {
      if(bid >= entry - 0.50 && bid <= entry + 1.50)
      {
         Print("[GoldAISignal EA] Executing Market SELL at Bid: ", bid, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.Sell(InpLotSize, _Symbol, bid, finalSL, finalTP, "GoldAI: " + planId);
      }
      else if(bid < entry)
      {
         Print("[GoldAISignal EA] Placing SELL_LIMIT at ", entry, " Bid: ", bid, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.SellLimit(InpLotSize, entry, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
      }
      else
      {
         Print("[GoldAISignal EA] Price surged above entry. Executing Market SELL at Bid: ", bid);
         m_trade.Sell(InpLotSize, _Symbol, bid, finalSL, finalTP, "GoldAI: " + planId);
      }
   }
}

//+------------------------------------------------------------------+
//| Cancel EA Pending Orders when plan expires / closes              |
//+------------------------------------------------------------------+
void CancelEAPendingOrders()
{
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
      {
         Print("[GoldAISignal EA] Cancelling outdated pending order #", ticket);
         m_trade.OrderDelete(ticket);
      }
   }
}
//+------------------------------------------------------------------+
