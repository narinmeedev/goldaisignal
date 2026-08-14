//+------------------------------------------------------------------+
//|                                  GoldAISignal_AutoTrader.mq5    |
//|                        Copyright 2026, Gold AI Signal Lab       |
//|                                     https://goldaisig.com        |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property link      "https://goldaisig.com"
#property version   "2.30"
#property description "Expert Advisor for MetaTrader 5 - Syncs Live Gold Candles & Auto-Executes AI Trade Plans"

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                 |
//+------------------------------------------------------------------+
input group "--- Server Connection ---"
input string   InpServerURL         = "http://localhost:3000"; // Server URL (localhost:3000 or https://goldaisig.com)
input string   InpSecret            = "GOLD_AI_SECRET";       // Webhook Secret Key

input group "--- Auto Trading Control ---"
input bool     InpAutoTrade         = true;                   // Enable Automatic Execution of AI Trade Plans
input double   InpLotSize           = 0.01;                   // Order Lot Size
input ulong    InpMagicNumber       = 888999;                 // Magic Number for EA Orders
input ulong    InpSlippage          = 30;                     // Slippage in Points
input int      InpSyncIntervalSec   = 3;                      // Candle & Price Sync Interval (Seconds)

input group "--- Custom Risk & Reward (TP / SL Override) ---"
input bool     InpUseCustomTPSL     = false;                  // Enable Custom TP / SL Override (true = Use Custom, false = Use AI Target)
input double   InpCustomTPDist      = 4.50;                   // Custom TP Distance in Dollars (e.g. 4.50 = $4.50 / 45 pips)
input double   InpCustomSLDist      = 3.50;                   // Custom SL Distance in Dollars (e.g. 3.50 = $3.50 / 35 pips)

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
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpSlippage);

   EventSetTimer(InpSyncIntervalSec);
   Print("[GoldAISignal EA] Initialized v2.30 successfully. Custom TP/SL: ", InpUseCustomTPSL ? "ENABLED" : "DISABLED");
   
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
   
   string hud = "=====================================================\n";
   hud += "       🏆 GOLD AI SIGNAL - AUTO TRADER EA (v2.30)     \n";
   hud += "=====================================================\n";
   hud += " 🌐 Server URL  : " + InpServerURL + "\n";
   hud += " ⚡ Live Status : " + m_lastStatus + "\n";
   hud += " 🕒 Last Sync   : " + lastTimeStr + " (Total: " + IntegerToString(m_totalSyncCount) + " syncs)\n";
   hud += "-----------------------------------------------------\n";
   
   if(m_activePlanType != "" && m_activeEntry > 0)
   {
      double finalSL = m_activeSL;
      double finalTP = m_activeTP;
      
      if(InpUseCustomTPSL)
      {
         if(m_activePlanType == "BUY" || m_activePlanType == "BUY_LIMIT" || m_activePlanType == "BUY_MARKET")
         {
            finalSL = m_activeEntry - InpCustomSLDist;
            finalTP = m_activeEntry + InpCustomTPDist;
         }
         else
         {
            finalSL = m_activeEntry + InpCustomSLDist;
            finalTP = m_activeEntry - InpCustomTPDist;
         }
      }
      
      double slDist = MathAbs(m_activeEntry - finalSL);
      double tpDist = MathAbs(finalTP - m_activeEntry);
      
      hud += " 📌 ACTIVE PLAN : " + m_activePlanTitle + "\n";
      hud += " 📊 ORDER TYPE  : " + m_activePlanType + "\n";
      hud += " 🎯 ENTRY TARGET: $" + DoubleToString(m_activeEntry, 2) + "\n";
      hud += " 🔴 STOP LOSS   : $" + DoubleToString(finalSL, 2) + " (Risk: $" + DoubleToString(slDist, 2) + ")" + (InpUseCustomTPSL ? " [Custom Override]" : "") + "\n";
      hud += " 🟢 TAKE PROFIT : $" + DoubleToString(finalTP, 2) + " (Reward: $" + DoubleToString(tpDist, 2) + ")" + (InpUseCustomTPSL ? " [Custom Override]" : "") + "\n";
   }
   else
   {
      hud += " 📌 ACTIVE PLAN : ⏳ Synchronizing & Calculating Live AI Setup...\n";
   }
   
   hud += "-----------------------------------------------------\n";
   hud += " 🤖 Auto Trading: " + (InpAutoTrade ? "🟢 ENABLED (Lot Size: " + DoubleToString(InpLotSize, 2) + ")" : "🔴 DISABLED") + "\n";
   hud += " ⚙️ Custom TP/SL: " + (InpUseCustomTPSL ? "🟢 ACTIVE (TP: $" + DoubleToString(InpCustomTPDist, 2) + " / SL: $" + DoubleToString(InpCustomSLDist, 2) + ")" : "⚪ OFF (Using AI Target)") + "\n";
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
//| Smart Order Execution Engine for MetaTrader 5                    |
//+------------------------------------------------------------------+
void ExecuteTradePlan(string planId, string planType, double entry, double sl, double tp)
{
   // Override SL & TP if Custom Override is enabled
   double finalSL = sl;
   double finalTP = tp;
   
   if(InpUseCustomTPSL)
   {
      if(planType == "BUY" || planType == "BUY_LIMIT" || planType == "BUY_MARKET")
      {
         finalSL = entry - InpCustomSLDist;
         finalTP = entry + InpCustomTPDist;
      }
      else if(planType == "SELL" || planType == "SELL_LIMIT" || planType == "SELL_MARKET")
      {
         finalSL = entry + InpCustomSLDist;
         finalTP = entry - InpCustomTPDist;
      }
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
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   
   if(planType == "BUY_LIMIT" || planType == "BUY" || planType == "BUY_MARKET")
   {
      if(ask <= entry + 0.50 && ask >= entry - 1.50)
      {
         Print("[GoldAISignal EA] Executing Market BUY at Ask: ", ask, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.Buy(InpLotSize, _Symbol, ask, finalSL, finalTP, "GoldAI: " + planId);
      }
      else if(ask > entry)
      {
         Print("[GoldAISignal EA] Placing BUY_LIMIT at ", entry, " Ask: ", ask, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.BuyLimit(InpLotSize, entry, _Symbol, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
      }
      else
      {
         Print("[GoldAISignal EA] Price dropped below entry. Executing Market BUY at Ask: ", ask);
         m_trade.Buy(InpLotSize, _Symbol, ask, finalSL, finalTP, "GoldAI: " + planId);
      }
   }
   else if(planType == "SELL_LIMIT" || planType == "SELL" || planType == "SELL_MARKET")
   {
      if(bid >= entry - 0.50 && bid <= entry + 1.50)
      {
         Print("[GoldAISignal EA] Executing Market SELL at Bid: ", bid, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.Sell(InpLotSize, _Symbol, bid, finalSL, finalTP, "GoldAI: " + planId);
      }
      else if(bid < entry)
      {
         Print("[GoldAISignal EA] Placing SELL_LIMIT at ", entry, " Bid: ", bid, " SL: ", finalSL, " TP: ", finalTP);
         m_trade.SellLimit(InpLotSize, entry, _Symbol, finalSL, finalTP, ORDER_TIME_GTC, 0, "GoldAI: " + planId);
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
