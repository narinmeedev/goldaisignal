//+------------------------------------------------------------------+
//|                                     MT5_Webhook_Sender.mq5       |
//|                        Gold AI Signal Lab - Webhook & Sync       |
//|                    Supports IUX Markets (XAUUSD.iux) & All Gold  |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property link      "https://goldaisig.com"
#property version   "3.30"
#property description "EA for MetaTrader 5 - Syncs Realtime Candles and Market Structure Webhook Signals from IUX Markets (XAUUSD.iux) / Exness to Gold AI Signal Cloud & Localhost"

enum ENUM_SERVER_TARGET
{
   TARGET_CLOUD_ONLY,   // ☁️ Cloud Only (https://goldaisig.com)
   TARGET_BOTH,         // 🚀 Both Cloud & Local/Tailscale (ส่งพร้อมกันทั้งคู่)
   TARGET_LOCAL_ONLY    // 💻 Local/Tailscale Only (http://100.64.189.114:3000)
};

enum ENUM_SIGNAL_STRATEGY
{
   STRAT_BIGGY_SMART_SIGNAL, // 🏆 BiggySmartSignal (Market Structure + Doji Filter + Limit Entry)
   STRAT_EMA_CROSS           // ⚡ EMA Fast / Slow Cross
};

//--- Inputs
input group "=== 1. SERVER & DESTINATION (เลือกส่งเข้า Cloud / Tailscale VPN) ==="
input ENUM_SERVER_TARGET InpServerTarget     = TARGET_CLOUD_ONLY;             // ปลายทางที่ต้องการส่งข้อมูล (ค่าเริ่มต้น: Cloud)
input string             InpCloudBaseURL     = "https://goldaisig.com";       // Cloud Server URL (https://goldaisig.com)
input string             InpLocalBaseURL     = "http://100.64.189.114:3000"; // Local/Tailscale IP (http://100.64.189.114:3000)
input string             InpSecretKey        = "GOLD_AI_SECRET";              // Webhook Secret Key

input group "=== 2. SIGNAL STRATEGY & OPTIMAL LIMIT ENTRY ==="
input ENUM_SIGNAL_STRATEGY InpSignalStrategy = STRAT_BIGGY_SMART_SIGNAL;     // กลยุทธ์การตรวจจับสัญญาณ
input int                InpSwingLeftBars    = 3;                             // Swing Left Bars (สำหรับตรวจจับ HH/LH/LL/HL)
input bool               InpFilterDojiBuy    = true;                          // กรอง Doji ฝั่ง BUY (รอแท่งถัดไปยืนยัน)
input double             InpPullbackRatio    = 0.40;                          // สัดส่วนย่อ/เด้งรับ Limit Entry (0.40 = 40% ของแท่งสัญญาณ)
input double             InpSLBufferPoints   = 300.0;                         // ระยะเผื่อ SL นอกสวิง (Points)
input int                InpFastEMA_Period   = 20;                            // EMA Fast Period (Cloud Trend)
input int                InpSlowEMA_Period   = 50;                            // EMA Slow Period (Cloud Trend)

input group "=== 3. SYNC & DATA SETTINGS ==="
input int                InpCandleSyncSec    = 5;                             // ความถี่ในการซิงค์แท่งเทียน (วินาที)
input int                InpHistoryBars      = 300;                           // จำนวนแท่งเทียนประวัติที่ส่งครั้งแรก (300 bars)
input int                InpPriceFeedSec     = 5;                             // ส่ง Live Tick Price ทุกๆ (วินาที)

//--- Global Variables
int      handle_fastMA, handle_slowMA, handle_atr;
datetime lastAlertTimeBuy  = 0;
datetime lastAlertTimeSell = 0;
datetime lastSyncTime      = 0;
datetime lastPriceFeedTime = 0;
datetime lastM5BarSyncTime = 0;
datetime lastErrorLogTime  = 0;
string   lastCloudStatus   = "Waiting for initial sync...";
string   lastLocalStatus   = "Waiting for initial sync...";

// Market Structure State
double   prevHighPrice     = 0.0;
double   prevLowPrice      = 0.0;
bool     awaitingDojiBuy   = false;
double   dojiLLLevel       = 0.0;
datetime dojiBarTime       = 0;

//+------------------------------------------------------------------+
//| Check Gold Symbol (Supports XAUUSD.iux, XAUUSD, XAUUSDc, GOLD)  |
//+------------------------------------------------------------------+
bool IsGoldSymbol()
{
   string sym = _Symbol;
   StringToUpper(sym);
   return (StringFind(sym, "XAU") >= 0 || StringFind(sym, "GOLD") >= 0);
}

//+------------------------------------------------------------------+
//| Helper: Get Point Value                                          |
//+------------------------------------------------------------------+
double GetPointValue()
{
   double p = _Point;
   if(p <= 0) p = (_Digits == 3) ? 0.001 : 0.01;
   return p;
}

//+------------------------------------------------------------------+
//| Helper: Update On-Screen HUD Comment                             |
//+------------------------------------------------------------------+
void UpdateHudComment()
{
   string hud = "====================================================\n";
   hud += "🤖 GOLD AI SIGNAL - WEBHOOK & SYNC ENGINE (v3.30)\n";
   hud += "====================================================\n";
   hud += "📍 Symbol: " + _Symbol + " | Timeframe: " + GetTimeframeString() + " (Digits: " + IntegerToString(_Digits) + ")\n";
   hud += "📡 Target Mode: " + (InpServerTarget == TARGET_BOTH ? "BOTH (Cloud & Tailscale)" : (InpServerTarget == TARGET_CLOUD_ONLY ? "CLOUD ONLY" : "TAILSCALE LOCAL ONLY")) + "\n";
   
   if(InpServerTarget == TARGET_CLOUD_ONLY || InpServerTarget == TARGET_BOTH)
   {
      hud += "☁️ Cloud Server: " + InpCloudBaseURL + "\n";
      hud += "   ↳ Status: " + lastCloudStatus + "\n";
   }
   if(InpServerTarget == TARGET_LOCAL_ONLY || InpServerTarget == TARGET_BOTH)
   {
      hud += "💻 Tailscale Server: " + InpLocalBaseURL + "\n";
      hud += "   ↳ Status: " + lastLocalStatus + "\n";
   }
   hud += "⏱️ Last Sync Time: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\n";
   hud += "💡 Strategy: " + (InpSignalStrategy == STRAT_BIGGY_SMART_SIGNAL ? "BiggySmartSignal Pro + Limit Entry" : "EMA Cross") + "\n";
   hud += "====================================================";
   Comment(hud);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(!IsGoldSymbol())
   {
      Print(">>> ❌ Gold AI Signal รองรับเฉพาะกราฟทองคำ (XAUUSD.iux / XAUUSD / XAUUSDc / GOLD): ", _Symbol);
      return(INIT_FAILED);
   }

   handle_fastMA = iMA(_Symbol, _Period, InpFastEMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   handle_slowMA = iMA(_Symbol, _Period, InpSlowEMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   handle_atr    = iATR(_Symbol, _Period, 14);
   
   EventSetTimer(InpCandleSyncSec);
   lastM5BarSyncTime = iTime(_Symbol, PERIOD_M5, 0);
   
   Print(">>> 🚀 [Gold AI Signal Webhook Sender v3.30] Started on ", _Symbol, " (Digits: ", _Digits, ", Point: ", DoubleToString(GetPointValue(), _Digits), ")");
   if(InpServerTarget == TARGET_CLOUD_ONLY || InpServerTarget == TARGET_BOTH)
      Print(">>> ☁️ Target Cloud URL: ", InpCloudBaseURL);
   if(InpServerTarget == TARGET_LOCAL_ONLY || InpServerTarget == TARGET_BOTH)
      Print(">>> 💻 Target Local/Tailscale URL: ", InpLocalBaseURL);

   UpdateHudComment();

   // ซิงค์แท่งเทียนทันทีเมื่อเริ่มทำงาน
   SyncCandlesToWeb(true);
   lastSyncTime = TimeCurrent();
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   IndicatorRelease(handle_fastMA);
   IndicatorRelease(handle_slowMA);
   IndicatorRelease(handle_atr);
   Comment("");
}

//+------------------------------------------------------------------+
//| Timer function for syncing candles                               |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!IsGoldSymbol()) return;
   
   if(TimeCurrent() - lastSyncTime >= InpCandleSyncSec)
   {
      SyncCandlesToWeb(false);
      lastSyncTime = TimeCurrent();
      UpdateHudComment();
   }
}

//+------------------------------------------------------------------+
//| Helper: Find Pivot High in historical bars                       |
//+------------------------------------------------------------------+
bool CheckPivotHigh(int leftBars, double &pivotPrice)
{
   double centerHigh = iHigh(_Symbol, _Period, 1);
   double currentHigh = iHigh(_Symbol, _Period, 0);
   if(currentHigh > centerHigh) return false;
   
   for(int i = 2; i <= leftBars + 1; i++)
   {
      if(iHigh(_Symbol, _Period, i) >= centerHigh) return false;
   }
   pivotPrice = centerHigh;
   return true;
}

//+------------------------------------------------------------------+
//| Helper: Find Pivot Low in historical bars                        |
//+------------------------------------------------------------------+
bool CheckPivotLow(int leftBars, double &pivotPrice)
{
   double centerLow = iLow(_Symbol, _Period, 1);
   double currentLow = iLow(_Symbol, _Period, 0);
   if(currentLow < centerLow) return false;
   
   for(int i = 2; i <= leftBars + 1; i++)
   {
      if(iLow(_Symbol, _Period, i) <= centerLow) return false;
   }
   pivotPrice = centerLow;
   return true;
}

//+------------------------------------------------------------------+
//| Expert tick function (Signal Generation & Price Feed)            |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!IsGoldSymbol()) return;
   
   double currentBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double currentAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double currentPrice = currentBid;
   datetime currentBarTime = iTime(_Symbol, _Period, 0);
   
   // 1. ส่ง Live Price Feed กลับไปให้หน้าจอ Dashboard
   if(TimeCurrent() - lastPriceFeedTime >= InpPriceFeedSec)
   {
      SendSignalToWeb("NONE", currentPrice, "price_feed", 0, 0, 0);
      lastPriceFeedTime = TimeCurrent();
      UpdateHudComment();
   }

   // 2. ตรวจสอบแท่งเทียนใหม่ M5
   datetime latestM5BarTime = iTime(_Symbol, PERIOD_M5, 0);
   if(latestM5BarTime > 0 && latestM5BarTime != lastM5BarSyncTime)
   {
      SyncCandlesToWeb(false);
      lastM5BarSyncTime = latestM5BarTime;
      lastSyncTime = TimeCurrent();
      UpdateHudComment();
   }

   // 3. กลยุทธ์การออกสัญญาณ (BiggySmartSignal / EMA Cross)
   if(InpSignalStrategy == STRAT_BIGGY_SMART_SIGNAL)
   {
      double ph = 0.0;
      double pl = 0.0;
      
      double c0 = iClose(_Symbol, _Period, 0);
      double o0 = iOpen(_Symbol, _Period, 0);
      double h0 = iHigh(_Symbol, _Period, 0);
      double l0 = iLow(_Symbol, _Period, 0);
      double c1 = iClose(_Symbol, _Period, 1);
      
      double candleSpan = h0 - l0;
      double curUpperWick = h0 - MathMax(c0, o0);
      double curLowerWick = MathMin(c0, o0) - l0;
      bool isBearishWickDoji = (curUpperWick > curLowerWick);
      double ptVal = GetPointValue();

      // 🔴 SELL: Pivot High Rejection + Optimal Limit Entry
      if(CheckPivotHigh(InpSwingLeftBars, ph))
      {
         bool testFailed = (h0 <= ph);
         bool isBearish  = (c0 < o0) || (c0 < c1);
         
         if(testFailed && isBearish && currentBarTime != lastAlertTimeSell)
         {
            double limitEntry = c0 + (candleSpan * InpPullbackRatio);
            if(limitEntry > h0) limitEntry = h0;
            
            double sl = MathMax(ph, h0) + (InpSLBufferPoints * ptVal);
            double risk = MathAbs(limitEntry - sl);
            double tp = limitEntry - (risk * 1.5);
            
            SendSignalToWeb("SELL", c0, "BiggySmartSignal_SELL", sl, tp, limitEntry);
            lastAlertTimeSell = currentBarTime;
            prevHighPrice = ph;
         }
      }

      // 🟢 BUY: Pivot Low Reversal + Doji Followup + Optimal Limit Entry
      if(CheckPivotLow(InpSwingLeftBars, pl))
      {
         bool isLL = (prevLowPrice == 0.0) ? true : (pl <= prevLowPrice);
         
         if(isLL)
         {
            if(!InpFilterDojiBuy || !isBearishWickDoji)
            {
               if(currentBarTime != lastAlertTimeBuy)
               {
                  double limitEntry = c0 - (candleSpan * InpPullbackRatio);
                  if(limitEntry < l0) limitEntry = l0;
                  
                  double sl = MathMin(pl, l0) - (InpSLBufferPoints * ptVal);
                  double risk = MathAbs(limitEntry - sl);
                  double tp = limitEntry + (risk * 1.5);
                  
                  SendSignalToWeb("BUY", c0, "BiggySmartSignal_BUY", sl, tp, limitEntry);
                  lastAlertTimeBuy = currentBarTime;
                  awaitingDojiBuy = false;
               }
            }
            else
            {
               awaitingDojiBuy = true;
               dojiLLLevel     = pl;
               dojiBarTime     = currentBarTime;
            }
         }
         prevLowPrice = pl;
      }

      // ตรวจสอบ Doji Follow-up Bar
      if(awaitingDojiBuy && currentBarTime > dojiBarTime)
      {
         bool holdLL = (l0 >= dojiLLLevel) || (c0 >= dojiLLLevel);
         bool isBounce = (curUpperWick > 0 || curLowerWick > 0 || c0 > o0);
         
         if(holdLL && isBounce && currentBarTime != lastAlertTimeBuy)
         {
            double limitEntry = c0 - (candleSpan * InpPullbackRatio);
            if(limitEntry < l0) limitEntry = l0;
            
            double sl = MathMin(dojiLLLevel, l0) - (InpSLBufferPoints * ptVal);
            double risk = MathAbs(limitEntry - sl);
            double tp = limitEntry + (risk * 1.5);
            
            SendSignalToWeb("BUY", c0, "BiggySmartSignal_DojiFollowup", sl, tp, limitEntry);
            lastAlertTimeBuy = currentBarTime;
            awaitingDojiBuy = false;
         }
         else if(l0 < dojiLLLevel)
         {
            awaitingDojiBuy = false;
         }
      }
   }
   else
   {
      // --- EMA Cross Logic ---
      double fastMA[2], slowMA[2];
      if(CopyBuffer(handle_fastMA, 0, 0, 2, fastMA) >= 2 && CopyBuffer(handle_slowMA, 0, 0, 2, slowMA) >= 2)
      {
         if(fastMA[1] <= slowMA[1] && fastMA[0] > slowMA[0] && currentBarTime != lastAlertTimeBuy)
         {
            SendSignalToWeb("BUY", currentPrice, "EMA_Cross_BUY", 0, 0, currentPrice);
            lastAlertTimeBuy = currentBarTime;
         }
         if(fastMA[1] >= slowMA[1] && fastMA[0] < slowMA[0] && currentBarTime != lastAlertTimeSell)
         {
            SendSignalToWeb("SELL", currentPrice, "EMA_Cross_SELL", 0, 0, currentPrice);
            lastAlertTimeSell = currentBarTime;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| WebRequest Helper: ส่งข้อมูล JSON ไปยัง URL ปลายทาง (ไม่มี Modal Alert)|
//+------------------------------------------------------------------+
bool PostJson(string url, string jsonBody, string &responseOut, string label)
{
   char postData[], resultData[];
   string resultHeaders;
   
   StringToCharArray(jsonBody, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1); // ตัด null terminator ทิ้ง
   
   string headers = "Content-Type: application/json\r\n";
   ResetLastError();
   int res = WebRequest("POST", url, headers, 10000, postData, resultData, resultHeaders);
   
   if(res == 200 || res == 202)
   {
      responseOut = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      return true;
   }
   
   int err = GetLastError();
   // แสดง error log ในแถบ Experts ทุกๆ 30 วินาทีเพื่อไม่ให้รก log และไม่ใช้ Alert() popup กวนใจ
   if(TimeCurrent() - lastErrorLogTime >= 30)
   {
      if(res == -1)
      {
         if(err == 4014)
         {
            Print(">>> ❌ [", label, " Error 4014: ERR_WEBREQUEST_NOT_ALLOWED] กรุณาไปที่ Tools -> Options -> Expert Advisors และเพิ่ม URL: ", url);
         }
         else
         {
            Print(">>> ❌ [", label, " WebRequest Failed] Error code: ", err, " URL: ", url);
         }
      }
      else
      {
         string errBody = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
         Print(">>> ⚠️ [", label, " Server Returned HTTP ", res, "] ", errBody, " URL: ", url);
      }
      lastErrorLogTime = TimeCurrent();
   }
   return false;
}

//+------------------------------------------------------------------+
//| ส่งสัญญาณสด (Live Signal / Tick) ไปยัง Cloud / Tailscale         |
//+------------------------------------------------------------------+
void SendSignalToWeb(string direction, double price, string strategyType, double sl = 0, double tp = 0, double limitEntry = 0)
{
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double spread = (ask - bid);

   string jsonPayload = StringFormat(
      "{\"secret\":\"%s\",\"symbol\":\"%s\",\"timeframe\":\"%s\",\"direction\":\"%s\",\"price\":%." + IntegerToString(_Digits) + "f,\"limit_entry\":%." + IntegerToString(_Digits) + "f,\"bid\":%." + IntegerToString(_Digits) + "f,\"ask\":%." + IntegerToString(_Digits) + "f,\"spread\":%." + IntegerToString(_Digits) + "f,\"sl\":%." + IntegerToString(_Digits) + "f,\"tp\":%." + IntegerToString(_Digits) + "f,\"strategy\":\"%s\",\"timestamp\":\"%s\"}",
      InpSecretKey, _Symbol, GetTimeframeString(), direction, price, (limitEntry > 0 ? limitEntry : price), bid, ask, spread, sl, tp, strategyType, ToIsoUtc(TimeCurrent())
   );

   string resp = "";
   
   // 1. ส่งเข้า Cloud Server
   if(InpServerTarget == TARGET_CLOUD_ONLY || InpServerTarget == TARGET_BOTH)
   {
      string cloudWebhookUrl = InpCloudBaseURL + "/api/webhooks/tradingview";
      if(PostJson(cloudWebhookUrl, jsonPayload, resp, "CLOUD_SIGNAL"))
      {
         if(direction != "NONE")
            Print(">>> ☁️ [CLOUD] ส่งสัญญาณ ", _Symbol, " (", direction, " @ ", DoubleToString(price, _Digits), ") สำเร็จ!");
      }
   }

   // 2. ส่งเข้า Local/Tailscale Server
   if(InpServerTarget == TARGET_LOCAL_ONLY || InpServerTarget == TARGET_BOTH)
   {
      string localWebhookUrl = InpLocalBaseURL + "/api/webhooks/tradingview";
      if(PostJson(localWebhookUrl, jsonPayload, resp, "LOCAL_SIGNAL"))
      {
         if(direction != "NONE")
            Print(">>> 💻 [LOCAL] ส่งสัญญาณ ", _Symbol, " (", direction, " @ ", DoubleToString(price, _Digits), ") สำเร็จ!");
      }
   }
}

//+------------------------------------------------------------------+
//| ส่งประวัติแท่งเทียน (Historical Candles) ไปยัง Cloud / Tailscale  |
//+------------------------------------------------------------------+
void SyncCandlesToWeb(bool fullHistory)
{
   ENUM_TIMEFRAMES periods[3] = {PERIOD_M5, PERIOD_M15, PERIOD_H1};
   string labels[3] = {"M5", "M15", "H1"};

   for(int tfIndex = 0; tfIndex < 3; tfIndex++)
   {
      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      int barsToCopy = fullHistory ? InpHistoryBars : 10;
      int copied = CopyRates(_Symbol, periods[tfIndex], 0, barsToCopy, rates);

      if(copied <= 0) continue;

      string json = "{\"secret\":\"" + InpSecretKey + "\",\"symbol\":\"" + _Symbol + "\",\"timeframe\":\"" + labels[tfIndex] + "\",\"candles\":[";

      for(int i = 0; i < copied; i++) {
         string timeStr = ToIsoUtc(rates[i].time);

         json += "{";
         json += "\"time\":\"" + timeStr + "\",";
         json += "\"open\":" + DoubleToString(rates[i].open, _Digits) + ",";
         json += "\"high\":" + DoubleToString(rates[i].high, _Digits) + ",";
         json += "\"low\":" + DoubleToString(rates[i].low, _Digits) + ",";
         json += "\"close\":" + DoubleToString(rates[i].close, _Digits) + ",";
         json += "\"volume\":" + IntegerToString(rates[i].tick_volume);
         json += "}";

         if(i < copied - 1) json += ",";
      }
      json += "]}";

      string resp = "";
      
      // 1. ซิงค์เข้า Cloud
      if(InpServerTarget == TARGET_CLOUD_ONLY || InpServerTarget == TARGET_BOTH)
      {
         string cloudSyncUrl = InpCloudBaseURL + "/api/admin/candles/sync";
         if(PostJson(cloudSyncUrl, json, resp, "CLOUD_CANDLES_" + labels[tfIndex]))
         {
            lastCloudStatus = "✅ OK (" + labels[tfIndex] + " " + IntegerToString(copied) + " bars synced)";
            UpdateChartTradePlan(resp);
         }
         else
         {
            lastCloudStatus = "❌ Error connecting to " + InpCloudBaseURL;
         }
      }

      // 2. ซิงค์เข้า Local/Tailscale
      if(InpServerTarget == TARGET_LOCAL_ONLY || InpServerTarget == TARGET_BOTH)
      {
         string localSyncUrl = InpLocalBaseURL + "/api/admin/candles/sync";
         if(PostJson(localSyncUrl, json, resp, "LOCAL_CANDLES_" + labels[tfIndex]))
         {
            lastLocalStatus = "✅ OK (" + labels[tfIndex] + " " + IntegerToString(copied) + " bars synced)";
            UpdateChartTradePlan(resp);
         }
         else
         {
            lastLocalStatus = "❌ Error connecting to " + InpLocalBaseURL;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| วาดเส้นออเดอร์และ Text ข้อความ Entry, SL, TP by AI บนกราฟ MT5    |
//+------------------------------------------------------------------+
void UpdateChartTradePlan(string json)
{
   if(StringFind(json, "\"activePlan\":{") < 0) return;

   double entry = ExtractJsonDouble(json, "\"entry\":");
   double sl    = ExtractJsonDouble(json, "\"stopLoss\":");
   double tp    = ExtractJsonDouble(json, "\"takeProfit\":");

   if(entry <= 0 || sl <= 0 || tp <= 0) return;

   DrawChartLine("GoldAI_ENTRY", entry, clrDodgerBlue, STYLE_SOLID, 2, "🔹 Entry: $" + DoubleToString(entry, _Digits));
   DrawChartLine("GoldAI_SL", sl, clrCrimson, STYLE_DASH, 2, "🔻 SL: $" + DoubleToString(sl, _Digits));
   DrawChartLine("GoldAI_TP", tp, clrGold, STYLE_SOLID, 2, "🎯 TP: $" + DoubleToString(tp, _Digits));

   DrawChartCornerText("GoldAI_BADGE", "🤖 Gold AI (" + _Symbol + "): Entry $" + DoubleToString(entry, _Digits) + " | SL $" + DoubleToString(sl, _Digits) + " | TP $" + DoubleToString(tp, _Digits), clrYellow);
}

double ExtractJsonDouble(string json, string key)
{
   int pos = StringFind(json, key);
   if(pos < 0) return 0.0;
   pos += StringLen(key);
   string valStr = "";
   for(int i = pos; i < StringLen(json); i++) {
      ushort ch = StringGetCharacter(json, i);
      if((ch >= '0' && ch <= '9') || ch == '.') {
         valStr += ShortToString(ch);
      } else if(StringLen(valStr) > 0) {
         break;
      }
   }
   return StringToDouble(valStr);
}

void DrawChartLine(string name, double price, color clr, ENUM_LINE_STYLE style, int width, string text)
{
   if(ObjectFind(0, name) < 0) {
      ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
   } else {
      ObjectMove(0, name, 0, 0, price);
   }
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
}

void DrawChartCornerText(string name, string text, color clr)
{
   if(ObjectFind(0, name) < 0) {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   }
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 20);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 30);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, name, OBJPROP_FONT, "Arial Bold");
}

datetime ToUtc(datetime serverTime)
{
   int serverOffset = (int)(TimeTradeServer() - TimeGMT());
   return serverTime - serverOffset;
}

string ToIsoUtc(datetime serverTime)
{
   string timeStr = TimeToString(ToUtc(serverTime), TIME_DATE|TIME_SECONDS);
   StringReplace(timeStr, ".", "-");
   StringReplace(timeStr, " ", "T");
   timeStr += "Z";
   return timeStr;
}

string GetTimeframeString()
{
   switch(_Period)
   {
      case PERIOD_M5:  return "M5";
      case PERIOD_M15: return "M15";
      case PERIOD_H1:  return "H1";
      case PERIOD_H4:  return "H4";
      default:         return "M15";
   }
}
