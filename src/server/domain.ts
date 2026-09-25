import type {
  Account,
  AccountSummary,
  Category,
  Transaction,
  TransactionInput,
} from '../shared/models';

export function validateTransaction(
  input: TransactionInput,
  accounts: Account[],
  categories: Category[],
): string[] {
  const errors: string[] = [];
  const amount = input.amountMinor;
  const fromId = input.fromAccountId ?? '';
  const toId = input.toAccountId ?? '';

  if (!input.occurredAt) errors.push('occurredAt is required');
  if (!input.clientRequestId) errors.push('clientRequestId is required');
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    errors.push('amountMinor must be a positive integer');
  }

  const accountById = new Map(accounts.map((account) => [account.accountId, account]));
  const from = fromId ? accountById.get(fromId) : undefined;
  const to = toId ? accountById.get(toId) : undefined;

  if (fromId && !from) errors.push('fromAccountId does not exist');
  if (toId && !to) errors.push('toAccountId does not exist');
  if (from && !from.active) errors.push('from account is inactive');
  if (to && !to.active) errors.push('to account is inactive');

  if (input.type === 'income') {
    if (fromId) errors.push('income must not have fromAccountId');
    if (!toId) errors.push('income requires toAccountId');
  }

  if (input.type === 'expense') {
    if (!fromId) errors.push('expense requires fromAccountId');
    if (toId) errors.push('expense must not have toAccountId');
  }

  if (input.type === 'transfer') {
    if (!fromId || !toId) errors.push('transfer requires both accounts');
    if (fromId && fromId === toId) errors.push('transfer accounts must differ');
  }

  if (input.type !== 'transfer') {
    const categoryId = input.categoryId ?? '';
    const category = categories.find((item) => item.categoryId === categoryId);
    if (!category) {
      errors.push('income and expense require a valid category');
    } else if (category.kind !== input.type) {
      errors.push(`category kind must be ${input.type}`);
    }
  }

  return errors;
}

export function calculateBalances(
  accounts: Account[],
  transactions: Transaction[],
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const account of accounts) {
    balances[account.accountId] = account.openingBalanceMinor;
  }

  for (const transaction of transactions) {
    if (transaction.status !== 'posted') continue;
    const amount = transaction.amountMinor;

    if (transaction.type === 'income' && transaction.toAccountId) {
      balances[transaction.toAccountId] = (balances[transaction.toAccountId] ?? 0) + amount;
    }

    if (transaction.type === 'expense' && transaction.fromAccountId) {
      balances[transaction.fromAccountId] = (balances[transaction.fromAccountId] ?? 0) - amount;
    }

    if (transaction.type === 'transfer') {
      if (transaction.fromAccountId) {
        balances[transaction.fromAccountId] =
          (balances[transaction.fromAccountId] ?? 0) - amount;
      }
      if (transaction.toAccountId) {
        balances[transaction.toAccountId] =
          (balances[transaction.toAccountId] ?? 0) + amount;
      }
    }
  }

  return balances;
}

export function summarize(
  transactions: Transaction[],
  fromDate?: string,
  toDate?: string,
): AccountSummary {
  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const transaction of transactions) {
    if (transaction.status !== 'posted') continue;
    if (fromDate && transaction.occurredAt < fromDate) continue;
    if (toDate && transaction.occurredAt > toDate) continue;

    if (transaction.type === 'income') incomeMinor += transaction.amountMinor;
    if (transaction.type === 'expense') expenseMinor += transaction.amountMinor;
  }

  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
  };
}
