export type AccountType = 'bank' | 'cash' | 'wallet' | 'credit_card' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryKind = 'income' | 'expense';
export type TransactionStatus = 'posted' | 'void';

export interface Account {
  accountId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalanceMinor: number;
  active: boolean;
  createdAt: string;
}

export interface Category {
  categoryId: string;
  name: string;
  kind: CategoryKind;
  active: boolean;
}

export interface Transaction {
  transactionId: string;
  occurredAt: string;
  type: TransactionType;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  currency: string;
  categoryId: string;
  note: string;
  clientRequestId: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionInput {
  occurredAt: string;
  type: TransactionType;
  fromAccountId?: string;
  toAccountId?: string;
  amountMinor: number;
  currency?: string;
  categoryId?: string;
  note?: string;
  clientRequestId: string;
}

export interface AccountSummary {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

export interface BootstrapPayload {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  balancesMinor: Record<string, number>;
  summary: AccountSummary;
}
