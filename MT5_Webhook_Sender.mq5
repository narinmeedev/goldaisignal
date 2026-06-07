//+------------------------------------------------------------------+
//|                                     MT5_Webhook_Sender.mq5       |
//|                        Gold AI Signal Lab - Webhook & Sync       |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property version   "1.02"

//--- Inputs
input string   ServerURL      = "http://localhost:3000/api/webhooks/tradingview";
input string   SyncURL        = "http://localhost:3000/api/admin/candles/sync";
input string   SecretKey      = "GOLD_AI_SECRET";
input string   StrategyName   = "support_bounce";
input int      FastMA_Period  = 9;
input int      SlowMA_Period  = 21;

int handle_fastMA, handle_slowMA;
datetime lastAlertTimeBuy = 0, lastAlertTimeSell = 0;
datetime lastSyncTime = 0;
datetime lastPriceFeedTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   handle_fastMA = iMA(_Symbol, _Period, FastMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   handle_slowMA = iMA(_Symbol, _Period, SlowMA_Period, 0, MODE_EMA, PRICE_CLOSE);
   
   EventSetTimer(60); // Check for sync every 60 seconds
   
   // ทำการอัปเดตกราฟให้เว็บทันทีที่ลาก EA ลงกราฟ
   SyncCandlesToWeb();
   
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
   // อัปเดตกราฟ (แท่งเทียน) ให้ระบบเว็บทราบ ทุกๆ 1 ชั่วโมง
   if(TimeCurrent() - lastSyncTime >= 3600) {
      SyncCandlesToWeb();
      lastSyncTime = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| Expert tick function (Signal Generation)                         |
//+------------------------------------------------------------------+
void OnTick()
{
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
   
   string jsonPayload = StringFormat(
      "{\"secret\":\"%s\",\"symbol\":\"%s\",\"timeframe\":\"%s\",\"direction\":\"%s\",\"price\":%f,\"strategy\":\"%s\"}",
      SecretKey, _Symbol, GetTimeframeString(), direction, price, strategyType
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
void SyncCandlesToWeb()
{
   char postData[], resultData[];
   string resultHeaders;
   
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(_Symbol, PERIOD_H1, 0, 150, rates); // ดึง 150 แท่ง ของ H1 เพื่อใช้วิเคราะห์แนวรับต้าน
   
   if(copied > 0) {
      string json = "{\"symbol\":\"" + _Symbol + "\",\"timeframe\":\"H1\",\"candles\":[";
      
      for(int i = 0; i < copied; i++) {
         string timeStr = TimeToString(rates[i].time, TIME_DATE|TIME_MINUTES);
         StringReplace(timeStr, " ", "T");
         timeStr += ":00Z";
         
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
      int res = WebRequest("POST", SyncURL, headers, 5000, postData, resultData, resultHeaders);
      
      if(res == 200) Print(">>> อัปเดตแท่งเทียน 150 แท่ง (H1) เข้าระบบ Zones สำเร็จ!");
      else Print(">>> อัปเดตแท่งเทียนล้มเหลว Error: ", GetLastError());
   }
}

//+------------------------------------------------------------------+
//| แปลง Timeframe เป็นข้อความ                                        |
//+------------------------------------------------------------------+
string GetTimeframeString()
{
   switch(_Period)
   {
      case PERIOD_M15: return "M15";
      case PERIOD_H1:  return "H1";
      case PERIOD_H4:  return "H4";
      default:         return "M15";
   }
}
