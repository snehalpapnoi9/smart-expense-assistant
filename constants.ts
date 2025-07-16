import { ExpenseCategory } from './types';

// IMPORTANT: Replace this with your actual n8n webhook URL
export const N8N_WEBHOOK_URL = 'https://snehalpapnoi9.app.n8n.cloud/webhook/41a87729-88be-4791-86ef-708e5d1ee553';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  ExpenseCategory.FOOD_EXPENSE,
  ExpenseCategory.TRAVEL,
  ExpenseCategory.ACCOMMODATION,
  ExpenseCategory.OTHER_OFFICE_EXPENSES,
];

export const CURRENCIES: string[] = ['INR', 'USD', 'EUR', 'GBP'];