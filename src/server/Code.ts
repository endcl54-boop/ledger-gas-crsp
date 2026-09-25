import { calculateBalances, summarize, validateTransaction } from './domain';
import type {
  Account,
  BootstrapPayload,
  Category,
  Transaction,
  TransactionInput,
} from '../shared/models';

const ACCOUNT_HEADERS = [
  'accountId',
  'name',
  'type',
  'currency',
  'openingBalanceMinor',
  'active',
  'createdAt',
];

const TRANSACTION_HEADERS = [
  'transactionId',
  'occurredAt',
  'type',
  'fromAccountId',
  'toAccountId',
  'amountMinor',
  'currency',
  'categoryId',
  'note',
  'clientRequestId',
  'status',
  'createdAt',
  'updatedAt',
];

const CATEGORY_HEADERS = ['categoryId', 'name', 'kind', 'active'];

const DEFAULT_CATEGORIES: Category[] = [
  { categoryId: 'salary', name: '薪金', kind: 'income', active: true },
  { categoryId: 'other-income', name: '其他收入', kind: 'income', active: true },
  { categoryId: 'food', name: '飲食', kind: 'expense', active: true },
  { categoryId: 'transport', name: '交通', kind: 'expense', active: true },
  { categoryId: 'shopping', name: '購物', kind: 'expense', active: true },
  { categoryId: 'utilities', name: '生活費', kind: 'expense', active: true },
  { categoryId: 'other-expense', name: '其他支出', kind: 'expense', active: true },
];

function spreadsheet_(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID 未設定。請先執行 setupLedger(spreadsheetId)。');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheet_(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  name: string,
  headers: string[],
): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = spreadsheet.getSheetByName(name) ?? spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function writeDefaults_(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  if (sheet.getLastRow() > 1) return;
  const rows = DEFAULT_CATEGORIES.map((category) => [
    category.categoryId,
    category.name,
    category.kind,
    category.active,
  ]);
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function readRows_(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
): Record<string, unknown>[] {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() as unknown[];
  return values
    .filter((row) => row.some((value) => value !== ''))
    .map((row) => {
      const item: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        item[String(header)] = row[index];
      });
      return item;
    });
}

function string_(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value === null || value === undefined ? '' : String(value);
}

function boolean_(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function number_(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function accounts_(): Account[] {
  return readRows_(spreadsheet_().getSheetByName('Accounts')!).map((row) => ({
    accountId: string_(row.accountId),
    name: string_(row.name),
    type: string_(row.type) as Account['type'],
    currency: string_(row.currency) || 'HKD',
    openingBalanceMinor: number_(row.openingBalanceMinor),
    active: boolean_(row.active),
    createdAt: string_(row.createdAt),
  }));
}

function categories_(): Category[] {
  return readRows_(spreadsheet_().getSheetByName('Categories')!).map((row) => ({
    categoryId: string_(row.categoryId),
    name: string_(row.name),
    kind: string_(row.kind) as Category['kind'],
    active: boolean_(row.active),
  }));
}

function transactions_(): Transaction[] {
  return readRows_(spreadsheet_().getSheetByName('Transactions')!).map((row) => ({
    transactionId: string_(row.transactionId),
    occurredAt: string_(row.occurredAt),
    type: string_(row.type) as Transaction['type'],
    fromAccountId: string_(row.fromAccountId),
    toAccountId: string_(row.toAccountId),
    amountMinor: number_(row.amountMinor),
    currency: string_(row.currency) || 'HKD',
    categoryId: string_(row.categoryId),
    note: string_(row.note),
    clientRequestId: string_(row.clientRequestId),
    status: string_(row.status) as Transaction['status'],
    createdAt: string_(row.createdAt),
    updatedAt: string_(row.updatedAt),
  }));
}

function currentMonth_(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function doGet(): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Ledger');
}

function setupLedger(spreadsheetId: string): { spreadsheetId: string; sheets: string[] } {
  if (!spreadsheetId) throw new Error('spreadsheetId is required');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  ensureSheet_(spreadsheet, 'Accounts', ACCOUNT_HEADERS);
  ensureSheet_(spreadsheet, 'Transactions', TRANSACTION_HEADERS);
  const categories = ensureSheet_(spreadsheet, 'Categories', CATEGORY_HEADERS);
  ensureSheet_(spreadsheet, 'Meta', ['key', 'value']);
  writeDefaults_(categories);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
  return {
    spreadsheetId,
    sheets: ['Accounts', 'Transactions', 'Categories', 'Meta'],
  };
}

function getBootstrap(): BootstrapPayload {
  const accounts = accounts_();
  const categories = categories_();
  const transactions = transactions_();
  const month = currentMonth_();
  return {
    accounts,
    categories,
    transactions: transactions.slice(-100).reverse(),
    balancesMinor: calculateBalances(accounts, transactions),
    summary: summarize(transactions, month.from, month.to),
  };
}

function createAccount(input: {
  name: string;
  type: Account['type'];
  currency?: string;
  openingBalanceMinor?: number;
}): Account {
  if (!input.name?.trim()) throw new Error('帳戶名稱不能為空');
  const spreadsheet = spreadsheet_();
  const sheet = spreadsheet.getSheetByName('Accounts')!;
  const account: Account = {
    accountId: Utilities.getUuid(),
    name: input.name.trim(),
    type: input.type,
    currency: input.currency || 'HKD',
    openingBalanceMinor: input.openingBalanceMinor ?? 0,
    active: true,
    createdAt: new Date().toISOString(),
  };
  sheet.appendRow([
    account.accountId,
    account.name,
    account.type,
    account.currency,
    account.openingBalanceMinor,
    account.active,
    account.createdAt,
  ]);
  return account;
}

function createTransaction(input: TransactionInput): Transaction {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const accounts = accounts_();
    const categories = categories_();
    const errors = validateTransaction(input, accounts, categories);
    if (errors.length > 0) throw new Error(errors.join('; '));

    const existing = transactions_().find(
      (transaction) => transaction.clientRequestId === input.clientRequestId,
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const transaction: Transaction = {
      transactionId: Utilities.getUuid(),
      occurredAt: input.occurredAt,
      type: input.type,
      fromAccountId: input.fromAccountId ?? '',
      toAccountId: input.toAccountId ?? '',
      amountMinor: input.amountMinor,
      currency: input.currency ?? 'HKD',
      categoryId: input.categoryId ?? '',
      note: input.note ?? '',
      clientRequestId: input.clientRequestId,
      status: 'posted',
      createdAt: now,
      updatedAt: now,
    };

    spreadsheet_().getSheetByName('Transactions')!.appendRow([
      transaction.transactionId,
      transaction.occurredAt,
      transaction.type,
      transaction.fromAccountId,
      transaction.toAccountId,
      transaction.amountMinor,
      transaction.currency,
      transaction.categoryId,
      transaction.note,
      transaction.clientRequestId,
      transaction.status,
      transaction.createdAt,
      transaction.updatedAt,
    ]);
    CacheService.getScriptCache().remove('ledger-bootstrap');
    return transaction;
  } finally {
    lock.releaseLock();
  }
}

function voidTransaction(transactionId: string): boolean {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = spreadsheet_().getSheetByName('Transactions')!;
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const idColumn = headers.indexOf('transactionId');
    const statusColumn = headers.indexOf('status');
    const updatedColumn = headers.indexOf('updatedAt');
    for (let index = 1; index < values.length; index += 1) {
      if (String(values[index][idColumn]) !== transactionId) continue;
      sheet.getRange(index + 1, statusColumn + 1).setValue('void');
      sheet.getRange(index + 1, updatedColumn + 1).setValue(new Date().toISOString());
      CacheService.getScriptCache().remove('ledger-bootstrap');
      return true;
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

(globalThis as unknown as Record<string, unknown>).doGet = doGet;
(globalThis as unknown as Record<string, unknown>).setupLedger = setupLedger;
(globalThis as unknown as Record<string, unknown>).getBootstrap = getBootstrap;
(globalThis as unknown as Record<string, unknown>).createAccount = createAccount;
(globalThis as unknown as Record<string, unknown>).createTransaction = createTransaction;
(globalThis as unknown as Record<string, unknown>).voidTransaction = voidTransaction;
