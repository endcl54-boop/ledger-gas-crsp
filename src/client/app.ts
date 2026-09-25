import type {
  Account,
  BootstrapPayload,
  Category,
  Transaction,
  TransactionType,
} from '../shared/models';

type RemoteFunction = (...args: unknown[]) => void;

type ApiRunner = GoogleScriptRunner & Record<string, RemoteFunction>;

const state: { accounts: Account[]; categories: Category[] } = {
  accounts: [],
  categories: [],
};

function call<T>(name: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const runner = google.script.run
      .withSuccessHandler((value) => resolve(value as T))
      .withFailureHandler((error) => reject(error)) as ApiRunner;
    runner[name](...args);
  });
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

function money(minor: number): string {
  return new Intl.NumberFormat('zh-HK', {
    style: 'currency',
    currency: 'HKD',
  }).format(minor / 100);
}

function setStatus(message: string): void {
  byId<HTMLDivElement>('status').textContent = message;
}

function fillSelect(
  select: HTMLSelectElement,
  items: Array<{ id: string; label: string }>,
  emptyLabel: string,
): void {
  select.replaceChildren();
  if (items.length === 0) {
    select.add(new Option(emptyLabel, ''));
    return;
  }
  for (const item of items) select.add(new Option(item.label, item.id));
}

function refreshFormFields(): void {
  const type = byId<HTMLSelectElement>('type').value as TransactionType;
  const fromLabel = byId<HTMLLabelElement>('from-label');
  const toLabel = byId<HTMLLabelElement>('to-label');
  const categoryLabel = byId<HTMLLabelElement>('category-label');
  const from = byId<HTMLSelectElement>('fromAccount');
  const to = byId<HTMLSelectElement>('toAccount');
  const category = byId<HTMLSelectElement>('category');

  fromLabel.hidden = type === 'income';
  toLabel.hidden = type === 'expense';
  categoryLabel.hidden = type === 'transfer';
  from.required = type !== 'income';
  to.required = type !== 'expense';
  category.required = type !== 'transfer';

  const kind = type === 'income' ? 'income' : 'expense';
  fillSelect(
    category,
    state.categories
      .filter((item) => item.kind === kind && item.active)
      .map((item) => ({ id: item.categoryId, label: item.name })),
    '沒有可用分類',
  );
}

function renderSummary(payload: BootstrapPayload): void {
  const total = Object.values(payload.balancesMinor).reduce((sum, value) => sum + value, 0);
  byId<HTMLElement>('summary').innerHTML = [
    `<div class="card"><span class="muted">總餘額</span><strong>${money(total)}</strong></div>`,
    `<div class="card"><span class="muted">本期收入</span><strong>${money(payload.summary.incomeMinor)}</strong></div>`,
    `<div class="card"><span class="muted">本期支出</span><strong>${money(payload.summary.expenseMinor)}</strong></div>`,
    `<div class="card"><span class="muted">本期淨額</span><strong>${money(payload.summary.netMinor)}</strong></div>`,
  ].join('');
}

function accountName(id: string): string {
  return state.accounts.find((account) => account.accountId === id)?.name ?? id;
}

function categoryName(id: string): string {
  return state.categories.find((category) => category.categoryId === id)?.name ?? '';
}

function transactionLabel(transaction: Transaction): string {
  if (transaction.type === 'income') return `收入 · ${categoryName(transaction.categoryId)}`;
  if (transaction.type === 'expense') return `支出 · ${categoryName(transaction.categoryId)}`;
  return `轉移 · ${accountName(transaction.fromAccountId)} → ${accountName(transaction.toAccountId)}`;
}

function renderTransactions(transactions: Transaction[]): void {
  if (transactions.length === 0) {
    byId<HTMLElement>('transactions').textContent = '尚未有交易紀錄';
    return;
  }
  const rows = transactions.map((transaction) => {
    const sign = transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '';
    return `<tr><td>${transaction.occurredAt}</td><td>${transactionLabel(transaction)}</td><td>${transaction.note ?? ''}</td><td class="amount">${sign}${money(transaction.amountMinor)}</td></tr>`;
  }).join('');
  byId<HTMLElement>('transactions').innerHTML = `<table><thead><tr><th>日期</th><th>類型</th><th>備註</th><th>金額</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderAccounts(payload: BootstrapPayload): void {
  state.accounts = payload.accounts;
  state.categories = payload.categories;
  const items = state.accounts.filter((item) => item.active).map((item) => ({ id: item.accountId, label: item.name }));
  fillSelect(byId<HTMLSelectElement>('fromAccount'), items, '沒有可用帳戶');
  fillSelect(byId<HTMLSelectElement>('toAccount'), items, '沒有可用帳戶');
  refreshFormFields();
}

async function load(): Promise<void> {
  try {
    const payload = await call<BootstrapPayload>('getBootstrap');
    renderAccounts(payload);
    renderSummary(payload);
    renderTransactions(payload.transactions);
    setStatus('');
  } catch (error) {
    setStatus(String(error instanceof Error ? error.message : error));
  }
}

async function submit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const submitButton = byId<HTMLButtonElement>('submit');
  const type = byId<HTMLSelectElement>('type').value as TransactionType;
  const amount = Number(byId<HTMLInputElement>('amount').value);
  submitButton.disabled = true;
  setStatus('儲存中…');

  try {
    await call('createTransaction', {
      occurredAt: byId<HTMLInputElement>('occurredAt').value,
      type,
      fromAccountId: type === 'income' ? undefined : byId<HTMLSelectElement>('fromAccount').value,
      toAccountId: type === 'expense' ? undefined : byId<HTMLSelectElement>('toAccount').value,
      amountMinor: Math.round(amount * 100),
      currency: 'HKD',
      categoryId: type === 'transfer' ? undefined : byId<HTMLSelectElement>('category').value,
      note: byId<HTMLTextAreaElement>('note').value.trim(),
      clientRequestId: crypto.randomUUID(),
    });
    byId<HTMLFormElement>('transaction-form').reset();
    byId<HTMLInputElement>('occurredAt').value = new Date().toISOString().slice(0, 10);
    refreshFormFields();
    await load();
    setStatus('已儲存');
  } catch (error) {
    setStatus(String(error instanceof Error ? error.message : error));
  } finally {
    submitButton.disabled = false;
  }
}

byId<HTMLSelectElement>('type').addEventListener('change', refreshFormFields);
byId<HTMLFormElement>('transaction-form').addEventListener('submit', submit);
byId<HTMLInputElement>('occurredAt').value = new Date().toISOString().slice(0, 10);
void load();
