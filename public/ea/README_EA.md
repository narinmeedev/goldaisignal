# 🤖 คู่มือการติดตั้งและใช้งาน Gold AI Signal AutoTrader EA (MQL5)

ไฟล์ Expert Advisor (`GoldAISignal_AutoTrader.mq5`) ทำหน้าที่ **ซิงค์กราฟแท่งเทียนและราคาสดจาก MT5 เข้าสู่ระบบ Gold AI Signal** และ **ส่งคำสั่งซื้อขาย (OrderSend) เข้าพอร์ต MT5 อัตโนมัติแบบ Real-time**

---

## 🛠️ ขั้นตอนการติดตั้งบนโปรแกรม MetaTrader 5 (MT5)

### 1. อนุญาตการเชื่อมต่อ WebRequest บนโปรแกรม MT5
1. เปิดโปรแกรม **MetaTrader 5**
2. ไปที่เมนู **Tools** ➔ **Options** (หรือกด `Ctrl + O`)
3. เลือกแถบ **Expert Advisors**
4. ติ๊กถูกที่ช่อง **Allow WebRequest for listed URL:**
5. กดปุ่ม **`Add new URL`** (เครื่องหมาย `+`) แล้วใส่ URL ดังนี้:
   - หากรันบนเครื่องตนเอง (Localhost): `http://localhost:3000`
   - หากรันบนเซิร์ฟเวอร์จริง: `https://goldaisig.com`
6. ติ๊กถูกที่ช่อง **Allow Algo Trading**
7. กด **OK**

---

### 2. นำไฟล์ EA ไปวางในโฟลเดอร์ MT5
1. ดาวน์โหลดไฟล์ `GoldAISignal_AutoTrader.mq5`
2. เปิดโปรแกรม MT5 ไปที่เมนู **File** ➔ **Open Data Folder**
3. เข้าโฟลเดอร์ `MQL5` ➔ `Experts`
4. วางไฟล์ `GoldAISignal_AutoTrader.mq5` ลงในโฟลเดอร์นี้
5. กลับมาที่หน้าต่าง **Navigator** ใน MT5 คลิกขวาที่โฟลเดอร์ **Experts** ➔ กด **Refresh**
6. คุณจะเห็นไฟล์ **`GoldAISignal_AutoTrader`** ปรากฏขึ้น

---

### 3. ลาก EA ลงบนกราฟทองคำ (XAUUSD / GOLD)
1. เปิดกราฟ **XAUUSD (ทองคำ)** กรอบเวลา **M5**
2. ลากไฟล์ **`GoldAISignal_AutoTrader`** ลงบนกราฟ
3. ในหน้าต่างตั้งค่า แถบ **Inputs**:
   - `InpServerURL`: `http://localhost:3000` (หรือ `https://goldaisig.com`)
   - `InpSecret`: `GOLD_AI_SECRET`
   - `InpAutoTrade`: `true` (หากต้องการให้ออกออเดอร์อัตโนมัติ)
   - `InpLotSize`: `0.01` (หรือขนาด Lot ที่ต้องการ)
4. แถบ **Common**: ติ๊กถูกที่ **Allow Algo Trading**
5. กด **OK**

---

## ✨ คุณสมบัติเด่นของ EA ตัวนี้
- **Auto Candle & Price Sync**: อัปเดตราคาและแท่งเทียน M5 สดไปยังระบบเว็บทุกๆ 3 วินาที
- **Auto Pending Order Execution**: เมื่อมีแผนใหม่ (`BUY_LIMIT`, `SELL_LIMIT`, `BUY_STOP`, `SELL_STOP`) EA จะเปิดออเดอร์ตั้งรับเข้าพอร์ตทันที
- **Auto SL / TP Placement**: กำหนดจุดตัดขาดทุนกระชับ ($3.50 - $4.80) และจุดทำกำไรให้อัตโนมัติ
- **Auto Cancel Outdated Orders**: เมื่อแผนเดิมถูกยกเลิก หรือชน SL/TP EA จะลบออเดอร์เก่าทิ้งอัตโนมัติเพื่อป้องกันออเดอร์ค้าง
