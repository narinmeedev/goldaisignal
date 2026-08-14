//+------------------------------------------------------------------+
//|                                  GoldAISignal_AutoTrader.mq5    |
//|                        Copyright 2026, Gold AI Signal Lab       |
//|                                     https://goldaisig.com        |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property link      "https://goldaisig.com"
#property version   "2.00"
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

//+------------------------------------------------------------------+
//| Global Variables                                                 |
//+------------------------------------------------------------------+
CTrade         m_trade;
datetime       m_lastSyncTime = 0;
string         m_lastPlanId = "";

//+------------------------------------------------------------------+
//| Expert Initialization Function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   m_trade.SetExpertMagicNumber(InpMagicNumber);
   m_trade.SetDeviationInPoints(InpSlippage);

   EventSetTimer(InpSyncIntervalSec);
   Print("[GoldAISignal EA] Initialized successfully. Sync interval: ", InpSyncIntervalSec, " seconds.");
   
   // Run first sync immediately
   SyncCandlesAndFetchPlan();
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert Deinitialization Function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
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
   // Fallback tick sync if timer is slow
   if(TimeCurrent() - m_lastSyncTime >= InpSyncIntervalSec)
   {
      SyncCandlesAndFetchPlan();
   }
}

//+------------------------------------------------------------------+
//| Helper: Escape JSON String                                       |
//+------------------------------------------------------------------+
string FormatCandleJSON(datetime time, double open, double high, double low, double close, long volume)
{
   string timeStr = TimeToString(time, TIME_DATE|TIME_SECONDS);
   // Convert "YYYY.MM.DD HH:MM:SS" to "YYYY-MM-DD HH:MM:SS"
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
   // Skip whitespace
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
      Print("[GoldAISignal EA] Failed to copy rates for ", _Symbol);
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
   // Remove null terminator at end
   if(ArraySize(postData) > 0 && postData[ArraySize(postData)-1] == 0)
      ArrayResize(postData, ArraySize(postData)-1);
      
   ResetLastError();
   int res = WebRequest("POST", url, headers, 5000, postData, resultData, resultHeaders);
   
   if(res == 200)
   {
      string responseJson = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      ProcessServerResponse(responseJson);
   }
   else
   {
      Print("[GoldAISignal EA] WebRequest failed. HTTP Status: ", res, " Error: ", GetLastError(), 
            " (Ensure ", InpServerURL, " is added to MT5 Tools -> Options -> Expert Advisors -> Allow WebRequest)");
   }
}

//+------------------------------------------------------------------+
//| Process Response & Execute Trades                                |
//+------------------------------------------------------------------+
void ProcessServerResponse(const string &json)
{
   if(!InpAutoTrade) return;
   
   // Extract activePlan block
   int activePlanPos = StringFind(json, "\"activePlan\":");
   if(activePlanPos < 0) return;
   
   int planBlockStart = StringFind(json, "{", activePlanPos);
   if(planBlockStart < 0) return;
   
   int planBlockEnd = StringFind(json, "}", planBlockStart);
   if(planBlockEnd < 0) return;
   
   string planBlock = StringSubstr(json, planBlockStart, planBlockEnd - planBlockStart + 1);
   
   string planId   = ExtractJSONValue(planBlock, "id");
   string planType = ExtractJSONValue(planBlock, "type");
   double entry    = StringToDouble(ExtractJSONValue(planBlock, "entry"));
   double stopLoss = StringToDouble(ExtractJSONValue(planBlock, "stopLoss"));
   double takeProf = StringToDouble(ExtractJSONValue(planBlock, "takeProfit"));
   string isClosedStr = ExtractJSONValue(planBlock, "isClosed");
   bool   isClosed = (isClosedStr == "true");
   
   if(planId == "" || entry <= 0 || stopLoss <= 0 || takeProf <= 0 || isClosed)
   {
      // If plan is closed or deleted, remove existing pending orders from EA
      CancelEAPendingOrders();
      return;
   }
   
   // If new plan or updated plan levels
   ExecuteTradePlan(planId, planType, entry, stopLoss, takeProf);
}

//+------------------------------------------------------------------+
//| Execute Order on MetaTrader 5                                    |
//+------------------------------------------------------------------+
void ExecuteTradePlan(string planId, string planType, double entry, double sl, double tp)
{
   // Check if we already have an open position or pending order for this EA
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket > 0 && OrderGetInteger(ORDER_MAGIC) == InpMagicNumber)
      {
         double currentEntry = OrderGetDouble(ORDER_PRICE_OPEN);
         double currentSL = OrderGetDouble(ORDER_SL);
         double currentTP = OrderGetDouble(ORDER_TP);
         
         // If entry, SL, or TP changed by > 0.05, modify order
         if(MathAbs(currentEntry - entry) > 0.05 || MathAbs(currentSL - sl) > 0.05 || MathAbs(currentTP - tp) > 0.05)
         {
            Print("[GoldAISignal EA] Modifying Order #", ticket, " to Entry: ", entry, " SL: ", sl, " TP: ", tp);
            m_trade.OrderModify(ticket, entry, sl, tp, ORDER_TIME_GTC, 0);
         }
         return; // Existing order maintained
      }
   }
   
   // If active position exists, do not stack new pending orders
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
      {
         return; // Position already open
      }
   }
   
   // Place new Pending Order
   ENUM_ORDER_TYPE orderType;
   if(planType == "BUY_LIMIT")       orderType = ORDER_TYPE_BUY_LIMIT;
   else if(planType == "SELL_LIMIT") orderType = ORDER_TYPE_SELL_LIMIT;
   else if(planType == "BUY_STOP")   orderType = ORDER_TYPE_BUY_STOP;
   else if(planType == "SELL_STOP")  orderType = ORDER_TYPE_SELL_STOP;
   else
   {
      Print("[GoldAISignal EA] Unsupported order type: ", planType);
      return;
   }
   
   Print("[GoldAISignal EA] Placing New Order: ", planType, " Entry: ", entry, " SL: ", sl, " TP: ", tp);
   if(m_trade.OrderOpen(_Symbol, orderType, InpLotSize, entry, entry, sl, tp, ORDER_TIME_GTC, 0, "GoldAI: " + planId))
   {
      Print("[GoldAISignal EA] Order placed successfully! Ticket: ", m_trade.ResultOrder());
      m_lastPlanId = planId;
   }
   else
   {
      Print("[GoldAISignal EA] Order placement failed. Code: ", m_trade.ResultRetcode(), " Desc: ", m_trade.ResultRetcodeDescription());
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
