//+------------------------------------------------------------------+
//|                                     MT5_Webhook_Sender.mq5       |
//|                        Gold AI Signal Lab - Webhook & Sync       |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property version   "2.10"

//--- Inputs
input string   ServerURL        = "https://goldaisig.com/api/webhooks/tradingview";
input string   SyncURL          = "https://goldaisig.com/api/admin/candles/sync";
input string   LocalSyncURL     = "http://100.64.189.114:3000/api/admin/candles/sync";
input bool     EnableLocalSync  = true;
input string   SecretKey        = "GOLD_AI_SECRET";
input string   StrategyName   = "support_bounce";
input int      FastMA_Period  = 9;
input int      SlowMA_Period  = 21;
input int      CandleSyncSeconds = 60;
input int      CandleHistoryBars = 7000;

int handle_fastMA, handle_slowMA;
datetime lastAlertTimeBuy = 0, lastAlertTimeSell = 0;
datetime lastSyncTime = 0;
datetime lastPriceFeedTime = 0;
datetime lastM5BarSyncTime = 0;

bool IsGoldSymbol()
{
   string symbol = _Symbol;
   StringToUpper(symbol);
   return (StringFind(symbol, "XAU") >= 0 || StringFind(symbol, "GOLD") >= 0);
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(!IsGoldSymbol())
   {
      Print(">>> Gold AI Signal รองรับเฉพาะกราฟทองคำ (GOLD# / XAUUSD) เท่านั้น: ", _Symbol);
      Alert("Gold AI Signal: กรุณาติดตั้ง EA บนกราฟทองคำ (GOLD# หรือ XAUUSD) เท่านั้น");
      return(INIT_FAILED);
   }

   handle_fastMA = iMA(_Symbol, _Period, FastMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   handle_slowMA = iMA(_Symbol, _Period, SlowMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   
   EventSetTimer(5); // Check candle sync often so the web chart keeps moving
   lastM5BarSyncTime = iTime(_Symbol, PERIOD_M5, 0);
   
   // ทำการอัปเดตกราฟให้เว็บทันทีที่ลาก EA ลงกราฟ
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
}

//+------------------------------------------------------------------+
//| Timer function for syncing candles                               |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!IsGoldSymbol()) return;
   // อัปเดตกราฟ (แท่งเทียน) ให้ระบบเว็บทราบแบบถี่ เพื่อให้กราฟบนเว็บ realtime ใกล้ MT5
   if(TimeCurrent() - lastSyncTime >= CandleSyncSeconds) {
      SyncCandlesToWeb(false);
      lastSyncTime = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| Expert tick function (Signal Generation)                         |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!IsGoldSymbol()) return;
   double fastMA[2], slowMA[2];
   if(CopyBuffer(handle_fastMA, 0, 0, 2, fastMA) < 2) return;
   if(CopyBuffer(handle_slowMA, 0, 0, 2, slowMA) < 2) return;
   
   double currentPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   datetime currentBarTime = iTime(_Symbol, _Period, 0);
   
   // ส่งราคาปัจจุบัน (Live Tick) กลับไปให้หน้าจอ Dashboard ทุกๆ 10 วินาที
   if(TimeCurrent() - lastPriceFeedTime >= 10) {
      SendSignalToDashboard("NONE", currentPrice, "price_feed");
      lastPriceFeedTime = TimeCurrent();
   }

   datetime latestM5BarTime = iTime(_Symbol, PERIOD_M5, 0);
   if(latestM5BarTime > 0 && latestM5BarTime != lastM5BarSyncTime) {
      SyncCandlesToWeb(false);
      lastM5BarSyncTime = latestM5BarTime;
      lastSyncTime = TimeCurrent();
   }
   
   // Cross Up -> ยิงสัญญาณ BUY
   if(fastMA[1] <= slowMA[1] && fastMA[0] > slowMA[0])
   {
      if(currentBarTime != lastAlertTimeBuy)
      {
         SendSignalToDashboard("BUY", currentPrice, StrategyName);
         lastAlertTimeBuy = currentBarTime;
      }
   }
   
   // Cross Down -> ยิงสัญญาณ SELL
   if(fastMA[1] >= slowMA[1] && fastMA[0] < slowMA[0])
   {
      if(currentBarTime != lastAlertTimeSell)
      {
         SendSignalToDashboard("SELL", currentPrice, StrategyName);
         lastAlertTimeSell = currentBarTime;
      }
   }
}

//+------------------------------------------------------------------+
//| WebRequest: ส่งสัญญาณสด (Live Signal)                           |
//+------------------------------------------------------------------+
void SendSignalToDashboard(string direction, double price, string strategyType)
{
   char postData[], resultData[];
   string resultHeaders;
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick)) return;
   
   string jsonPayload = StringFormat(
      "{\"secret\":\"%s\",\"symbol\":\"%s\",\"timeframe\":\"%s\",\"direction\":\"%s\",\"price\":%f,\"bid\":%f,\"ask\":%f,\"spread\":%f,\"tickTimeMsc\":%I64d,\"strategy\":\"%s\",\"timestamp\":\"%s\"}",
      SecretKey, _Symbol, GetTimeframeString(), direction, price, tick.bid, tick.ask,
      tick.ask - tick.bid, tick.time_msc, strategyType, ToIsoUtc(TimeCurrent())
   );
   
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1); // Remove null terminator เพื่อป้องกัน Error ฝั่งเว็บ
   
   string headers = "Content-Type: application/json\r\n";
   int res = WebRequest("POST", ServerURL, headers, 5000, postData, resultData, resultHeaders);
   
   if(res == 200) Print(">>> ส่งสัญญาณ (", direction, ") เข้าระบบสำเร็จ!");
   else Print(">>> ส่งสัญญาณล้มเหลว Error: ", GetLastError());
}

//+------------------------------------------------------------------+
//| WebRequest: ส่งประวัติแท่งเทียน (Historical Candles)              |
//+------------------------------------------------------------------+
void SyncCandlesToWeb(bool fullHistory)
{
   ENUM_TIMEFRAMES periods[3] = {PERIOD_M5, PERIOD_M15, PERIOD_H1};
   string labels[3] = {"M5", "M15", "H1"};

   for(int tfIndex = 0; tfIndex < 3; tfIndex++)
   {
      char postData[], resultData[];
      string resultHeaders;

      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      int fullHistoryBars = tfIndex == 0 ? CandleHistoryBars : (tfIndex == 1 ? 2500 : 1000);
      int barsToCopy = fullHistory ? fullHistoryBars : 10;
      int copied = CopyRates(_Symbol, periods[tfIndex], 0, barsToCopy, rates);

      if(copied <= 0) continue;

      string json = "{\"secret\":\"" + SecretKey + "\",\"symbol\":\"" + _Symbol + "\",\"timeframe\":\"" + labels[tfIndex] + "\",\"candles\":[";

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

      StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
      ArrayResize(postData, ArraySize(postData) - 1); // Remove null terminator

      string headers = "Content-Type: application/json\r\n";
      
      // 1. ส่งข้อมูลเข้า Localhost (Qwen 3.5-9B Engine) หากเปิดใช้งาน
      if(EnableLocalSync && StringLen(LocalSyncURL) > 0)
      {
         uchar localResult[];
         string localHeaders;
         int localRes = WebRequest("POST", LocalSyncURL, headers, 3000, postData, localResult, localHeaders);
         if(localRes == 200)
         {
            Print(">>> 🤖 [LOCAL QWEN ENGINE] ส่งแท่งเทียนเข้า Qwen 3.5-9B บนเครื่องสำเร็จ!");
            string localResp = CharArrayToString(localResult, 0, WHOLE_ARRAY, CP_UTF8);
            UpdateChartTradePlan(localResp);
         }
      }

      // 2. ส่งข้อมูลเข้า Cloud (goldaisig.com)
      int res = WebRequest("POST", SyncURL, headers, 5000, postData, resultData, resultHeaders);

      if(res == 200) {
         Print(">>> ☁️ [CLOUD SERVER] อัปเดตแท่งเทียน ", copied, " แท่ง (", labels[tfIndex], ") ขึ้น goldaisig.com สำเร็จ!");
         string responseText = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
         
         if(StringFind(responseText, "\"command\":\"RECONNECT\"") >= 0 || StringFind(responseText, "\"command\":\"RESYNC\"") >= 0) {
            Print(">>> [SERVER COMMAND] ได้รับคำสั่งสั่ง RECONNECT / RESYNC จากเว็บหลังบ้าน! กำลังเริ่มโหลดรีเซ็ตบอทใหม่...");
            Alert("ได้รับคำสั่งให้เชื่อมต่อใหม่จากเซิร์ฟเวอร์เว็บ!");
            ChartSetSymbolPeriod(0, _Symbol, _Period);
         }
         
         // วาดเส้นแนวออเดอร์ Entry / SL / TP บนกราฟ MT5 อัตโนมัติเมื่อได้รับแผนจากเซิร์ฟเวอร์
         UpdateChartTradePlan(responseText);
      }
      else Print(">>> ☁️ [CLOUD SERVER] อัปเดตแท่งเทียน ", labels[tfIndex], " ล้มเหลว Error: ", GetLastError());
   }
}

//+------------------------------------------------------------------+
//| วาดเส้นออเดอร์และ Text ข้อความ Entry, SL, TP by AI บนกราฟ MT5    |
//+------------------------------------------------------------------+
void UpdateChartTradePlan(string json)
{
   int planPos = StringFind(json, "\"activePlan\":{");
   if(planPos < 0) return;

   double entry = ExtractJsonDouble(json, "\"entry\":");
   double sl = ExtractJsonDouble(json, "\"stopLoss\":");
   double tp = ExtractJsonDouble(json, "\"takeProfit\":");

   if(entry <= 0 || sl <= 0 || tp <= 0) return;

   // 1. Draw Entry Line & Text Label
   DrawChartLine("GoldAI_ENTRY", entry, clrDodgerBlue, STYLE_SOLID, 2, "🔹 Entry by AI: $" + DoubleToString(entry, 2));
   
   // 2. Draw SL Line & Text Label
   DrawChartLine("GoldAI_SL", sl, clrCrimson, STYLE_DASH, 2, "🔻 SL by AI: $" + DoubleToString(sl, 2));

   // 3. Draw TP Line & Text Label
   DrawChartLine("GoldAI_TP", tp, clrGold, STYLE_SOLID, 2, "🎯 TP by AI: $" + DoubleToString(tp, 2));

   // 4. Draw Overlay Information Badge on Top-Right Corner
   DrawChartCornerText("GoldAI_BADGE", "🤖 Gold AI Signal: Entry by AI $" + DoubleToString(entry, 2) + " | SL $" + DoubleToString(sl, 2) + " | TP $" + DoubleToString(tp, 2), clrYellow);
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

//+------------------------------------------------------------------+
//| แปลง Timeframe เป็นข้อความ                                        |
//+------------------------------------------------------------------+
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
