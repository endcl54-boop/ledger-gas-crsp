import { describe, expect, it } from 'vitest';
import type { Account, Category, Transaction } from '../src/shared/models';
import { calculateBalances, summarize, validateTransaction } from '../src/server/domain';

const accounts: Account[] = [
  {
    accountId: 'bank',
    name: '銀行',
    type: 'bank',
    currency: 'HKD',
    openingBalanceMinor: 0,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    accountId: 'cash',
    name: '現金',
    type: 'cash',
    currency: 'HKD',
    openingBalanceMinor: 0,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const categories: Category[] = [
  { categoryId: 'salary', name: '薪金', kind: 'income', active: true },
  { categoryId: 'food', name: '飲食', kind: 'expense', active: true },
];

function transaction(partial: Partial<Transaction>): Transaction {
  return {
    transactionId: 'tx',
    occurredAt: '2026-09-25',
    type: 'expense',
    fromAccountId: '',
    toAccountId: '',
    amountMinor: 0,
    currency: 'HKD',
    categoryId: '',
    note: '',
    clientRequestId: 'request',
    status: 'posted',
    createdAt: '2026-09-25T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:00.000Z',
    ...partial,
  };
}

describe('ledger domain', () => {
  it('calculates income, expense and transfer balances correctly', () => {
    const transactions = [
      transaction({ type: 'income', toAccountId: 'bank', amountMinor: 100000, categoryId: 'salary' }),
      transaction({ type: 'expense', fromAccountId: 'bank', amountMinor: 1000, categoryId: 'food' }),
      transaction({ type: 'transfer', fromAccountId: 'bank', toAccountId: 'cash', amountMinor: 500 }),
    ];

    expect(calculateBalances(accounts, transactions)).toEqual({ bank: 98500, cash: 500 });
    expect(summarize(transactions)).toEqual({ incomeMinor: 100000, expenseMinor: 1000, netMinor: 99000 });
  });

  it('excludes void transactions from balances and summaries', () => {
    const transactions = [
      transaction({ type: 'income', toAccountId: 'bank', amountMinor: 1000, categoryId: 'salary', status: 'void' }),
    ];

    expect(calculateBalances(accounts, transactions)).toEqual({ bank: 0, cash: 0 });
    expect(summarize(transactions)).toEqual({ incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  });

  it('validates transfer accounts and category direction', () => {
    expect(validateTransaction({
      occurredAt: '2026-09-25',
      type: 'transfer',
      fromAccountId: 'bank',
      toAccountId: 'bank',
      amountMinor: 100,
      clientRequestId: 'r1',
    }, accounts, categories)).toContain('transfer accounts must differ');

    expect(validateTransaction({
      occurredAt: '2026-09-25',
      type: 'expense',
      fromAccountId: 'bank',
      amountMinor: 100,
      categoryId: 'salary',
      clientRequestId: 'r2',
    }, accounts, categories)).toContain('category kind must be expense');
  });
});
