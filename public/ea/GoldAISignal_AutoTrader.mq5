//+------------------------------------------------------------------+
//|                                  GoldAISignal_AutoTrader.mq5    |
//|                        Copyright 2026, Gold AI Signal Lab       |
//|                                     https://goldaisig.com        |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property link      "https://goldaisig.com"
#property version   "2.50"
#property description "Expert Advisor for MetaTrader 5 - Syncs Live Gold Candles & Auto-Executes AI Trade Plans"

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                 |
//+------------------------------------------------------------------+
input group "--- Server Connection ---"
input string   InpServerURL         = "http://localhost:3000"; // Server URL (localhost:3000 or https://goldaisig.com)
input string   InpSecret            = "GOLD_AI_SECRET";       // Webhook Secret Key

input group "--- Auto Trading Control ---"
input bool     InpAutoTrade         = false;                  // Keep OFF until forward validation passes
input double   InpLotSize           = 0.01;                   // Order Lot Size
input ulong    InpMagicNumber       = 888999;                 // Magic Number for EA Orders
input ulong    InpSlippage          = 30;                     // Slippage in Points
input int      InpSyncIntervalSec   = 3;                      // Candle & Price Sync Interval (Seconds)
input int      InpMaxSpreadPoints   = 80;                     // Reject when Ask-Bid exceeds this many points
input int      InpMaxEntrySlipPoints= 35;                     // Maximum market-entry deviation from planned Entry
input double   InpMinRiskReward     = 1.80;                   // Reject plans below this reward/risk ratio

input group "--- Custom Entry Offset (In Points / จุด) ---"
input int      InpEntryOffsetPoints = 0;                      // Entry Offset in Points (e.g. 150 points = Shift Entry $1.50 deeper)

input group "--- Custom Risk & Reward (In Points / จุด) ---"
input bool     InpUseCustomTPSL     = false;                  // Enable Custom TP / SL Override (true = Use Custom Points, false = Use AI Target)
input int      InpCustomTPPoints    = 450;                    // Custom TP Distance in Points (e.g. 450 points = $4.50 / 45 pips)
input int      InpCustomSLPoints    = 350;                    // Custom SL Distance in Points (e.g. 350 points = $3.50 / 35 pips)

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
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpSlippage);

   EventSetTimer(InpSyncIntervalSec);
   Print("[GoldAISignal EA] Initialized v2.50 successfully. Custom Points TP: ", InpCustomTPPoints, " SL: ", InpCustomSLPoints);
   
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
   if(TimeCurrent() - m_lastSyncTime >= InpSyncIntervalSec)
   {
      SyncCandlesAndFetchPlan();
   }
}

//+------------------------------------------------------------------+
//| Render On-Screen HUD Panel on MT5 Chart                          |
//+------------------------------------------------------------------+
void UpdateChartHUD()
{
   string lastTimeStr = (m_lastSyncTime > 0) ? TimeToString(m_lastSyncTime, TIME_DATE|TIME_SECONDS) : "Waiting for first sync...";
   double pointVal = GetPointValue();
   double entryOffsetDist = InpEntryOffsetPoints * pointVal;
   double customTPDist = InpCustomTPPoints * pointVal;
   double customSLDist = InpCustomSLPoints * pointVal;
   
   string hud = "=====================================================\n";
   hud += "       🏆 GOLD AI SIGNAL - AUTO TRADER EA (v2.50)     \n";
   hud += "=====================================================\n";
   hud += " 🌐 Server URL  : " + InpServerURL + "\n";
   hud += " ⚡ Live Status : " + m_lastStatus + "\n";
   hud += " 🕒 Last Sync   : " + lastTimeStr + " (Total: " + IntegerToString(m_totalSyncCount) + " syncs)\n";
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
         double originalSLDist = MathAbs(m_activeEntry - m_activeSL);
         double originalTPDist = MathAbs(m_activeTP - m_activeEntry);
         finalSL = isBuy ? (finalEntry - originalSLDist) : (finalEntry + originalSLDist);
         finalTP = isBuy ? (finalEntry + originalTPDist) : (finalEntry - originalTPDist);
      }
      
      double slPoints = MathAbs(finalEntry - finalSL) / pointVal;
      double tpPoints = MathAbs(finalTP - finalEntry) / pointVal;
      
      hud += " 📌 ACTIVE PLAN : " + m_activePlanTitle + "\n";
      hud += " 📊 ORDER TYPE  : " + m_activePlanType + "\n";
      hud += " 🎯 ENTRY TARGET: $" + DoubleToString(finalEntry, 2) + (InpEntryOffsetPoints > 0 ? " [Offset: " + IntegerToString(InpEntryOffsetPoints) + " จุด]" : "") + "\n";
      hud += " 🔴 STOP LOSS   : $" + DoubleToString(finalSL, 2) + " (" + IntegerToString((int)MathRound(slPoints)) + " จุด)" + (InpUseCustomTPSL ? " [Custom Points]" : "") + "\n";
      hud += " 🟢 TAKE PROFIT : $" + DoubleToString(finalTP, 2) + " (" + IntegerToString((int)MathRound(tpPoints)) + " จุด)" + (InpUseCustomTPSL ? " [Custom Points]" : "") + "\n";
   }
   else
   {
      hud += " 📌 ACTIVE PLAN : ⏳ Synchronizing & Calculating Live AI Setup...\n";
   }
   
   hud += "-----------------------------------------------------\n";
   hud += " 🤖 Auto Trading: " + (InpAutoTrade ? "🟢 ENABLED (Lot Size: " + DoubleToString(InpLotSize, 2) + ")" : "🔴 DISABLED") + "\n";
   hud += " 📐 Entry Offset: " + (InpEntryOffsetPoints > 0 ? "🟢 ACTIVE (" + IntegerToString(InpEntryOffsetPoints) + " จุด / $" + DoubleToString(entryOffsetDist, 2) + ")" : "⚪ 0 จุด (Exact AI Entry)") + "\n";
   hud += " ⚙️ Custom TP/SL: " + (InpUseCustomTPSL ? "🟢 ACTIVE (TP: " + IntegerToString(InpCustomTPPoints) + " จุด / SL: " + IntegerToString(InpCustomSLPoints) + " จุด)" : "⚪ OFF (AI Target)") + "\n";
   hud += " 🔑 Magic Number: " + IntegerToString(InpMagicNumber) + "\n";
   hud += "=====================================================";
   
   Comment(hud);
}

//+------------------------------------------------------------------+
//| Helper: Escape JSON String                                       |
//+------------------------------------------------------------------+
string FormatCandleJSON(datetime time, double open, double high, double low, double close, long volume)
{
   string timeStr = TimeToString(time, TIME_DATE|TIME_SECONDS);
   StringReplace(timeStr, ".", "-");
   
   return StringFormat("{\"time\":\"%s\",\"open\":%.2f,\"high\":%.2f,\"low\":%.2f,\"close\":%.2f,\"volume\":%i}",
                       timeStr, open, high, low, close, volume);
}

//+------------------------------------------------------------------+
//| Helper: Simple JSON Value Extractor                              |
//+------------------------------------------------------------------+
string ExtractJSONValue(const string &json, const string &key)
{
   string searchKey = "\"" + key + "\":";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return "";
   
   int start = pos + StringLen(searchKey);
   while(start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\t'))
      start++;
      
   ushort firstChar = StringGetCharacter(json, start);
   if(firstChar == '"')
   {
      start++;
      int end = StringFind(json, "\"", start);
      if(end < 0) return "";
      return StringSubstr(json, start, end - start);
   }
   else
   {
      int end = start;
      while(end < StringLen(json))
      {
         ushort c = StringGetCharacter(json, end);
         if(c == ',' || c == '}' || c == ']' || c == ' ' || c == '\r' || c == '\n')
            break;
         end++;
      }
      return StringSubstr(json, start, end - start);
   }
}

//+------------------------------------------------------------------+
//| Core Function: Sync Candles to Server & Read Active Trade Plan   |
//+------------------------------------------------------------------+
void SyncCandlesAndFetchPlan()
{
   m_lastSyncTime = TimeCurrent();
   
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_M5, 0, 20, rates);
   if(copied <= 0)
   {
      m_lastStatus = "🔴 ERROR: CopyRates failed for " + _Symbol;
      UpdateChartHUD();
      return;
   }
   
   // Build JSON Payload
   string candlesArrayStr = "";
   for(int i = copied - 1; i >= 0; i--)
   {
      string cJson = FormatCandleJSON(rates[i].time, rates[i].open, rates[i].high, rates[i].low, rates[i].close, rates[i].tick_volume);
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
         }
      }
   }
   
   UpdateChartHUD();
}

//+------------------------------------------------------------------+
//| Smart Order Execution Engine (Points-Based Calculation)          |
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

   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick))
   {
      Print("[GoldAISignal EA] NO_TRADE: cannot read synchronized broker tick.");
      return;
   }

   double spreadPoints = (tick.ask - tick.bid) / pointVal;
   double riskDistance = MathAbs(entry - finalSL);
   double rewardDistance = MathAbs(finalTP - entry);
   double riskReward = riskDistance > 0 ? rewardDistance / riskDistance : 0;
   bool validGeometry = isBuy
      ? (finalSL < entry && finalTP > entry)
      : (finalSL > entry && finalTP < entry);

   if(spreadPoints <= 0 || spreadPoints > InpMaxSpreadPoints)
   {
      Print("[GoldAISignal EA] NO_TRADE: spread ", DoubleToString(spreadPoints, 0),
            " points exceeds limit ", InpMaxSpreadPoints);
      CancelEAPendingOrders();
      return;
   }
   if(!validGeometry || riskReward < InpMinRiskReward)
   {
      Print("[GoldAISignal EA] NO_TRADE: invalid plan geometry or RR 1:", DoubleToString(riskReward, 2));
      CancelEAPendingOrders();
      return;
   }

   // 1. Modify existing pending order if entry/SL/TP changed
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
      {
         double currentEntry = OrderGetDouble(ORDER_PRICE_OPEN);
         double currentSL = OrderGetDouble(ORDER_SL);
         double currentTP = OrderGetDouble(ORDER_TP);
         
         if(MathAbs(currentEntry - entry) > 0.05 || MathAbs(currentSL - finalSL) > 0.05 || MathAbs(currentTP - finalTP) > 0.05)
         {
            Print("[GoldAISignal EA] Modifying Order #", ticket, " to Entry: ", entry, " SL: ", finalSL, " TP: ", finalTP);
            m_trade.OrderModify(ticket, entry, finalSL, finalTP, ORDER_TIME_GTC, 0);
         }
         return;
      }
   }
   
   // 2. Skip if active position already open for this magic number
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         return; // Position active
      }
   }
   
   // 3. Smart execution: Handle Limit vs Market Order based on current Ask/Bid
   double ask = tick.ask;
   double bid = tick.bid;
   double maxEntrySlippage = InpMaxEntrySlipPoints * pointVal;
   
   if(isBuy)
   {
      if((planType == "BUY_MARKET" || planType == "BUY") && MathAbs(ask - entry) <= maxEntrySlippage)
      {
         Print("[GoldAISignal EA] Executing Market BUY at Ask: ", ask, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.Buy(InpLotSize, _Symbol, ask, finalSL, finalTP, "GoldAI: " + planId);
      }
      else if(planType == "BUY_LIMIT" && ask > entry)
      {
         Print("[GoldAISignal EA] Placing BUY_LIMIT at ", entry, " Ask: ", ask, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.BuyLimit(InpLotSize, entry, _Symbol, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
      }
      else
      {
         Print("[GoldAISignal EA] NO_TRADE: BUY entry missed or invalid order type. No chase order sent.");
      }
   }
   else
   {
      if((planType == "SELL_MARKET" || planType == "SELL") && MathAbs(bid - entry) <= maxEntrySlippage)
      {
         Print("[GoldAISignal EA] Executing Market SELL at Bid: ", bid, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.Sell(InpLotSize, _Symbol, bid, finalSL, finalTP, "GoldAI: " + planId);
      }
      else if(planType == "SELL_LIMIT" && bid < entry)
      {
         Print("[GoldAISignal EA] Placing SELL_LIMIT at ", entry, " Bid: ", bid, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.SellLimit(InpLotSize, entry, _Symbol, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
      }
      else
      {
         Print("[GoldAISignal EA] NO_TRADE: SELL entry missed or invalid order type. No chase order sent.");
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
