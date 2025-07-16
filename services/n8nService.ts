import { ExpenseData } from '../types';
import { N8N_WEBHOOK_URL } from '../constants';

export const submitExpense = async (data: ExpenseData, receiptFile: File | null): Promise<void> => {
  if (N8N_WEBHOOK_URL.includes('n8n.example.com')) {
     throw new Error("Submission failed. The n8n webhook URL has not been configured in 'constants.ts'.");
  }

  const formData = new FormData();

  // Append all text fields from the expense data
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

  // Append the timestamp
  formData.append('timestamp', new Date().toISOString());

  // Append the receipt file if it exists
  if (receiptFile) {
    formData.append('receipt', receiptFile, receiptFile.name);
  }
  
  // Append a status
  formData.append('status', 'Submitted');

  try {
    // The 'no-cors' mode is required to send data to a different domain (like n8n)
    // from a browser without triggering CORS errors. The browser sends the request
    // but doesn't allow the script to read the response.
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: formData,
      mode: 'no-cors',
      // Note: Do not set 'Content-Type' header when using FormData with fetch.
      // The browser will automatically set it to 'multipart/form-data' with the correct boundary.
    });

    // With 'no-cors', we can't check the response status (e.g., response.ok).
    // We assume the submission was successful if no network error was thrown.
    console.log('Expense submission sent successfully to n8n webhook.');

  } catch (error) {
    console.error('Error submitting expense to n8n:', error);
    throw new Error('Could not submit your expense. Please check your network connection and webhook configuration.');
  }
};
