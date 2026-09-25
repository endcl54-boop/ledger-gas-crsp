# Ledger GAS + TypeScript + Rust crsp

Google Apps Script 記帳本 Web App，使用：

- Google Apps Script V8
- TypeScript
- esbuild
- Google Sheet
- Rust `crsp`（`google-clasp-rs`）
- GitHub Actions CI/CD

目前 MVP 支援收入、支出、轉移及不同資產帳戶。

## 架構

```text
src/*.ts
   │ npm run build
   ▼
dist/*.js + dist/Index.html + dist/appsscript.json
   │ crsp push
   ▼
Google Apps Script Web App
   │
   ▼
Google Sheet
```

`crsp` 只負責 Apps Script 專案管理及部署，不負責 TypeScript 編譯。

## 本地需求

- Node.js 20+
- Rust stable + Cargo
- Google 帳戶
- 已啟用 Google Apps Script API
- `google-clasp-rs` 0.1.2
- Rust toolchain：stable（由 `rust-toolchain.toml` 鎖定）

## 安裝 crsp

```bash
cargo install google-clasp-rs --version 0.1.2
crsp --version
crsp login
crsp show-authorized-user
```

## 建立 Apps Script project

如果尚未有 Apps Script project：

```bash
crsp create-script \
  --type webapp \
  --title "Ledger" \
  --rootDir dist
```

這會建立本地 `.clasp.json`。本專案不把實際 `.clasp.json` 提交到 Git，請保留或複製為：

```bash
cp .clasp.json .clasp.json.example
```

`rootDir` 必須是 `dist`，因為 `npm run build` 會把 Apps Script 可部署檔案輸出到 `dist`。

## 建立 Google Sheet

建立一份專用 Google Sheet，取得網址中的 Spreadsheet ID，例如：

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

先建置並推送程式：

```bash
npm install
npm run check
npm test
npm run build
crsp show-file-status
crsp push
```

第一次初始化資料表，可在 Apps Script 編輯器執行：

```javascript
setupLedger('YOUR_SPREADSHEET_ID')
```

或使用 Apps Script Execution API 的 `crsp run-function`。初次設定建議使用編輯器，避免多做一個 API executable deployment。

初始化後會建立：

```text
Accounts
Transactions
Categories
Meta
```

## 第一次 Web App deployment

第一次請在 Apps Script 編輯器完成：

```text
Deploy
→ New deployment
→ Web app
→ Execute as: Me
→ Who has access: Only myself
```

記下固定的 `DEPLOYMENT_ID`。日後 GitHub Actions 使用 `crsp update-deployment` 更新同一個 deployment，不會每次產生新 URL。

## 日常開發

```bash
npm run check
npm test
npm run build
crsp push
```

查看 Apps Script log：

```bash
crsp tail-logs
```

查看 Web App deployment：

```bash
crsp list-deployments
crsp open-web-app <DEPLOYMENT_ID>
```

## GitHub CI

`.github/workflows/ci.yml` 會在 Pull Request 及各分支 push 執行：

1. Node.js 20
2. Rust stable
3. TypeScript type check
4. Vitest unit tests
5. Apps Script bundle build
6. 安裝並驗證固定版本 `crsp 0.1.2`

## GitHub Deploy secrets

在 GitHub repository 或 `production` Environment 建立以下 Secrets：

### `CRSP_AUTH_JSON`

本地執行：

```bash
cat ~/.clasprc.json
```

把完整內容存成 GitHub Secret。不要把它提交到 repository。

### `CRSP_PROJECT_JSON`

本地 `.clasp.json` 的完整內容，例如：

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "dist"
}
```

### `GAS_DEPLOYMENT_ID`

第一次 Web App deployment 的固定 deployment ID。

`.github/workflows/deploy.yml` 在 `main` push 或手動執行時會先檢查 repository variable：

```text
ENABLE_GAS_DEPLOY=true
```

只有啟用後才會執行：

```text
npm ci
npm run check
npm test
npm run build
crsp push --force
crsp update-deployment <GAS_DEPLOYMENT_ID>
```

這樣在 Google credentials 尚未設定時，main push 不會產生失敗的 production deploy。完成三個 Secrets 後，再建立 repository variable `ENABLE_GAS_DEPLOY=true`。

建議在 GitHub 的 `production` Environment 加入 required reviewer，避免每次合併都直接發布財務應用程式。

## MCP 模式

如果要讓 AI/IDE 透過 MCP 協助操作 Apps Script：

```bash
crsp start-mcp-server
```

MCP server 具備 push/pull/project 操作權限，只應在可信任的本機環境使用。

## GitHub 初始化

```bash
git init
git add .
git commit -m "chore: initialize ledger GAS CI project"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```
