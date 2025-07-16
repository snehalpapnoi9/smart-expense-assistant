
export enum ExpenseCategory {
  FOOD_EXPENSE = 'Food Expense',
  TRAVEL = 'Travel',
  ACCOMMODATION = 'Accommodation',
  OTHER_OFFICE_EXPENSES = 'Other office expenses',
}

export interface ExpenseData {
  expenseCategory: ExpenseCategory | '';
  project: string;
  expenseTitle: string;
  expenseDate: string;
  currency: string;
  amount: number | '';
  comment: string;
  employeeName: string; // Added for Google Sheet
  employeeId: string;   // Added for Google Sheet
}

export enum SubmissionStatus {
  IDLE = 'idle',
  SUBMITTING = 'submitting',
  SUCCESS = 'success',
  ERROR = 'error',
}