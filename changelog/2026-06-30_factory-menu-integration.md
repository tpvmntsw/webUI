# Factory Menu 整合

**日期**: 2026-06-30

## 變更摘要

將 Factory Menu 功能從 webUI-0624 移植到 webUI，支援透過密碼序列（MENU+1+9+9+9）開啟工廠設定選單，相容 PC 鍵盤與 DEV PANEL 按鈕觸發。

## 變更內容

### 功能新增

1. **Factory Menu 畫面**
   - 完整的工廠設定選單介面
   - 子選單：ADCADJUST、Picture mode、Whitebalance、SSC、SPECIALSET、Info.
   - 功能：SoftwareUpdate(USB)、USB data cloning、FACTORY RESET

2. **密碼序列觸發機制**
   - 目標序列：`MENU` → `1` → `9` → `9` → `9`
   - 1.5 秒內完成輸入即可觸發
   - 觸發後自動顯示 Factory Menu

3. **雙管道輸入支援**
   - **管道 A - PC 鍵盤**：監聽 `window.keydown` 事件，按 `m1999` 觸發
   - **管道 B - DEV PANEL**：透過 `onNavGlobal` hook 接收 NAV 事件

### Shell 核心擴充

1. **新增 `onNavGlobal` hook**
   - screenDef 可選擇性實作 `onNavGlobal(act)` 方法
   - 每個 NAV 事件都會呼叫所有已註冊畫面的 `onNavGlobal`（不管該畫面是否在最上層）
   - 用於背景監聽密碼序列等全域事件

## 影響檔案

- `shell.js` - 新增 `onNavGlobal` hook 呼叫邏輯
- `screens/factory-menu/factory-menu.js` - 新增 Factory Menu 畫面
- `index.html` - 載入 factory-menu script

## 測試步驟

1. 用瀏覽器開啟 `index.html`
2. **測試 DEV PANEL 觸發**：
   - 在 DEV PANEL 依序點擊 `MENU` → `1` → `9` → `9` → `9`
   - 確認 Factory Menu 顯示
3. **測試鍵盤觸發**：
   - 關閉 Factory Menu（按 BACK 或選 EXIT）
   - 在網頁上依序按鍵盤 `m` → `1` → `9` → `9` → `9`
   - 確認 Factory Menu 再次顯示
4. **測試選單導覽**：
   - 使用方向鍵（UP/DOWN）選擇項目
   - 使用 OK/RIGHT 進入子選單
   - 使用 BACK/LEFT 返回上層
5. **測試超時重設**：
   - 按下 `MENU` → `1` 後等待超過 1.5 秒
   - 再按 `9` → `9` → `9`
   - 確認不會觸發（因為超時重設了序列）
6. 執行 `node smoke-test.js` 確認 26 項測試全部通過

## 備註

- Factory Menu 使用 `layer: 'factory'`，位於 No Signal 之上、OSD Menu 之下
- 密碼序列緩衝區在 Factory Menu 關閉（onHide）時會自動清空
