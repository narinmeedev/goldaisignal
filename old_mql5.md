นี่คือไฟล์โค้ด **MQL5 ทั้ง 2 ชุดล่าสุด** ที่ผมทำการแก้ไขเพิ่มส่วน **ลบ Null-Terminator (`ArrayResize`)** ให้เรียบร้อยแล้วครับ 

คุณสามารถนำไปก๊อปปี้ทับในโปรแกรม **MetaEditor** กด Compile และเริ่มใช้งานได้ทันทีเลยครับ:

---

### 1. โค้ดสำหรับตัวสคริปต์ลากวางทดสอบด่วน (`TestSendSignal.mq5`)
*ใช้สำหรับลากวางใส่อินพุตราคาที่ต้องการจำลอง (เช่น `$4539.79`) เพื่อทดสอบการอัปเดตราคากลางบนบอร์ดในเสี้ยววินาที*

```mql5
//+------------------------------------------------------------------+
//|                                             TestSendSignal.mq5   |
//|                              Script สำหรับยิงทดสอบระบบแดชบอร์ดทันที |
//+------------------------------------------------------------------+
#property copyright "Gold AI Signal Lab"
#property version   "1.01"
#property script_show_inputs

input double TestPrice = 4539.79; // กรอกราคาที่ต้องการทดสอบอัปเดต (เช่น 4539.79)

void OnStart()
{
   char postData[];
   char resultData[];
   string resultHeaders;
   string serverURL = "http://127.0.0.1:3000/api/webhooks/tradingview";
   string headers = "Content-Type: application/json\r\n";
   
   // Payload สำหรับยิงจำลองสัญญาณส่งเข้าแดชบอร์ด
   string jsonPayload = StringFormat(
      "{\"secret\":\"GOLD_AI_SECRET\",\"symbol\":\"XAUUSD\",\"timeframe\":\"M15\",\"direction\":\"BUY\",\"price\":%f,\"strategy\":\"
<truncated 3468 bytes>
)
      {
         SendSignalToDashboard("SELL", currentPrice);
         lastAlertTimeSell = currentBarTimeSell;
      }
   }
}

// ฟังก์ชันสำหรับยิง WebRequest ส่งข้อมูล JSON ไปยัง Next.js Backend
void SendSignalToDashboard(string direction, double price)
{
   char postData[];
   char resultData[];
   string resultHeaders;
   
   // สร้าง Payload ตามสเปก API Webhook ของแอปเรา
   string jsonPayload = StringFormat(
      "{\"secret\":\"%s\",\"symbol\":\"%s\",\"timeframe\":\"%s\",\"direction\":\"%s\",\"price\":%f,\"strategy\":\"%s\"}",
      SecretKey, _Symbol, GetTimeframeString(), direction, price, StrategyName
   );
   
   // แปลงข้อมูลเป็น Byte array
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   
   // บรรทัดที่เพิ่มแก้ไข: ลบ Null-Terminator ออกก่อนส่งเพื่อป้องกันรหัส 500
   ArrayResize(postData, ArraySize(postData) - 1);
   
   // กำหนด Headers
   string headers = "Content-Type: application/json\r\n";
   
   // ส่ง WebRequest
   int timeout = 5000;
   int responseCode = WebRequest("POST", ServerURL, headers, timeout, postData, resultData, resultHeaders);
   
   if(responseCode == 200)
   {
      Print(">>> สัญญาณส่งไปยัง Gold AI Signal Lab สำเร็จ! Response: ", CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8));
   }
   else
   {
      Print(">>> ส่งสัญญาณล้มเหลว! Error Code: ", GetLastError(), " | HTTP Response Code: ", responseCode);
   }
}

// ฟังก์ชันแปลงหน่วย Timeframe เป็นข้อความส่งเข้า API
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
```
