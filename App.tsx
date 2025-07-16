
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ExpenseData, SubmissionStatus } from './types';
import { EXPENSE_CATEGORIES, CURRENCIES } from './constants';
import { parseTextFromNaturalLanguage, parseReceiptFromImage } from './services/geminiService';
import { submitExpense } from './services/n8nService';

import Input from './components/Input';
import Select from './components/Select';
import Button from './components/Button';
import Spinner from './components/Spinner';
import Modal from './components/Modal';

const emptyExpenseState: ExpenseData = {
  employeeName: 'Snehal Papnoi',
  employeeId: 'snehalpapnoi9@gmail.com',
  expenseCategory: '',
  project: '',
  expenseTitle: '',
  expenseDate: new Date().toISOString().split('T')[0],
  currency: 'INR',
  amount: '',
  comment: '',
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: React.ReactNode }> = ({ icon, title }) => (
    <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            {icon}
        </div>
        <h2 className="text-xl font-semibold text-gray-800 w-full">{title}</h2>
    </div>
);

const App: React.FC = () => {
  const [expenseData, setExpenseData] = useState<ExpenseData>(emptyExpenseState);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>(SubmissionStatus.IDLE);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [updatedFields, setUpdatedFields] = useState<Set<string>>(new Set());

  const resetForm = useCallback(() => {
    setExpenseData(emptyExpenseState);
    setReceiptFile(null);
    setReceiptPreview(null);
    setNaturalLanguageQuery('');
    setAiError(null);
  }, []);
  
  const removeReceipt = useCallback(() => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setAiError(null);
  }, []);

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExpenseData((prev) => ({
      ...prev,
      [name]: name === 'amount' ? (value ? parseFloat(value) : '') : value,
    }));
  };
  
  const handleAiParseSuccess = useCallback((parsedData: Partial<ExpenseData>) => {
    if (Object.keys(parsedData).length === 0) return;

    // Don't overwrite employee details if AI suggests them
    const { employeeName, employeeId, ...restOfParsedData } = parsedData;

    setExpenseData((prev) => ({ ...prev, ...restOfParsedData }));

    const keys = new Set(Object.keys(restOfParsedData));
    setUpdatedFields(keys);

    setTimeout(() => {
      setUpdatedFields(new Set());
    }, 2500); // Highlight for 2.5 seconds
  }, []);

  const handleNlpParse = async () => {
    setAiError(null);
    if (!naturalLanguageQuery.trim()) {
      setAiError("Please enter a description.");
      return;
    }
    if (naturalLanguageQuery.length > 500) {
      setAiError("Input is too long. Please keep it under 500 characters.");
      return;
    }

    setIsAiLoading(true);
    try {
      const parsedData = await parseTextFromNaturalLanguage(naturalLanguageQuery);
      handleAiParseSuccess(parsedData);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAiError(null);
      if (!file.type.startsWith('image/')) {
        setAiError("Only image files are supported.");
        e.target.value = '';
        return;
      }
      const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setAiError("File is too large. Please upload an image under 5MB.");
        e.target.value = '';
        return;
      }
      
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
        handleOcrParse(reader.result as string, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOcrParse = async (dataUrl: string, mimeType: string) => {
    const base64String = dataUrl.split(',')[1];
    if (!base64String) return;
    setIsAiLoading(true);
    setAiError(null);
    try {
      const parsedData = await parseReceiptFromImage(base64String, mimeType);
      handleAiParseSuccess(parsedData);
      
      if (parsedData && Object.keys(parsedData).length > 0) {
          const descriptionParts = [];
          if (parsedData.amount) descriptionParts.push(`Spent ${parsedData.amount} ${parsedData.currency || ''}`.trim());
          if (parsedData.expenseTitle) descriptionParts.push(`at ${parsedData.expenseTitle}`);
          if (parsedData.expenseDate) descriptionParts.push(`on ${parsedData.expenseDate}`);
          if (parsedData.project) descriptionParts.push(`for project ${parsedData.project}`);
          if (parsedData.expenseCategory) descriptionParts.push(`(category: ${parsedData.expenseCategory})`);
          let sentence = descriptionParts.join(' ') + '.';
          sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
          setNaturalLanguageQuery(sentence);
      } else {
          setNaturalLanguageQuery("AI parsed the receipt. Please review the fields below or describe the expense manually.");
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      setIsAiLoading(false);
    }
  };
  
  const validateForm = useCallback((): string | null => {
    const errors: string[] = [];
    if (!expenseData.expenseCategory) errors.push('Expense Category');
    if (!expenseData.project) errors.push('Project / Cost Center');
    if (!expenseData.expenseTitle) errors.push('Expense Title');
    if (!expenseData.expenseDate) errors.push('Expense Date');
    if (expenseData.amount === '' || expenseData.amount == null) {
        errors.push('Amount');
    }
    if (!expenseData.comment) errors.push('Comment');

    if (Number(expenseData.amount) > 500 && !receiptFile) {
        errors.push('Upload Receipt');
    }
    
    if (errors.length > 0) {
        return `Please complete all required fields: ${errors.join(', ')}.`;
    }
    return null;
  }, [expenseData, receiptFile]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
        setSubmissionError(validationError);
        setSubmissionStatus(SubmissionStatus.ERROR);
        return;
    }
    
    setSubmissionStatus(SubmissionStatus.SUBMITTING);
    setSubmissionError(null);
    try {
      await submitExpense(expenseData, receiptFile);
      setSubmissionStatus(SubmissionStatus.SUCCESS);
      resetForm();
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'An unknown submission error occurred.');
      setSubmissionStatus(SubmissionStatus.ERROR);
    }
  }, [expenseData, receiptFile, resetForm, validateForm]);
  
  const highlightClass = 'bg-yellow-200 text-gray-900 transition-colors duration-1000 ease-in-out';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto">
        <header className="relative text-center mb-10">
          <div className="flex justify-center items-center gap-3">
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight sm:text-5xl">🧾 Smart Expense Assistant</h1>
            <div className="group relative flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-gray-400 hover:text-blue-600 cursor-pointer">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <div className="absolute top-full left-1/2 z-20 mt-3 -translate-x-1/2 w-72 rounded-lg bg-gray-800 px-4 py-3 text-sm font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none">
                  <h4 className="font-semibold mb-1 text-base">How it works:</h4>
                  <ul className="list-decimal list-inside space-y-1 text-left">
                      <li>Upload a receipt or describe the expense.</li>
                      <li>Let AI auto-fill the form fields.</li>
                      <li>Review and edit if needed.</li>
                      <li>Submit and get confirmation.</li>
                  </ul>
                  <div className="absolute bottom-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-x-transparent border-b-8 border-b-gray-800"></div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-lg text-gray-700">Submit your expenses in seconds with AI-powered suggestions and receipt auto-parsing.</p>
        </header>

        <main className="bg-white rounded-2xl shadow-xl shadow-gray-200/60 p-6 sm:p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col space-y-2">
              <SectionHeader 
                icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>} 
                title={
                    <div className="flex items-center gap-1.5">
                        <span>
                            Upload Receipt
                            {Number(expenseData.amount) > 500 && <span className="text-red-500 ml-1">*</span>}
                        </span>
                        <div className="group relative flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 hover:text-blue-600 cursor-pointer">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                            </svg>
                            <div className="absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2 w-64 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none">
                                Receipts are required for expenses equal to or above ₹500.
                                <div className="absolute bottom-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-x-transparent border-b-8 border-b-gray-800"></div>
                            </div>
                        </div>
                    </div>
                }
               />
              <div className="w-full h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col justify-center items-center relative overflow-hidden bg-gray-50 hover:border-blue-500 transition-colors">
                {isAiLoading && <div className="absolute inset-0 bg-white/80 flex justify-center items-center z-10"><Spinner className="w-8 h-8 text-blue-600"/></div>}
                {receiptPreview ? (
                  <>
                    <img src={receiptPreview} alt="Receipt preview" className="h-full w-full object-cover"/>
                     <button
                        type="button"
                        onClick={removeReceipt}
                        className="absolute top-1.5 right-1.5 z-20 flex items-center justify-center w-6 h-6 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition-colors"
                        aria-label="Remove receipt"
                        disabled={isAiLoading}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mx-auto text-gray-400"> <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /> </svg>
                    <p className="mt-2 text-gray-500 text-sm">Click or drag to upload</p>
                  </div>
                )}
                 <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    onClick={(event) => { (event.target as HTMLInputElement).value = '' }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isAiLoading}
                    aria-label="Upload receipt"
                 />
              </div>
              <div className="text-center text-xs text-gray-600 space-y-0.5">
                <p>Supports image files up to 5MB.</p>
                <p className={Number(expenseData.amount) > 500 ? 'font-bold text-blue-600' : ''}>Required for amounts &gt; 500.</p>
                <p>We'll scan the image and auto-fill the details.</p>
              </div>
               <div className="flex-grow"></div>
               <div className="h-[2.25rem] invisible"></div>
            </div>

            <div className="flex flex-col space-y-2">
              <SectionHeader icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"> <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /> </svg>} title="Describe Expense" />
              <div className="relative w-full">
                <textarea
                  value={naturalLanguageQuery}
                  onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                  placeholder="e.g., Spent 1800 on client dinner at Hyatt on July 10, charge to Sales project"
                  className="w-full h-28 p-3 pb-6 bg-white text-gray-900 border border-gray-300 rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-white disabled:text-gray-600 resize-none"
                  disabled={isAiLoading}
                  maxLength={500}
                />
                <p className="absolute bottom-2 right-3 text-xs text-gray-400 pointer-events-none">
                  {naturalLanguageQuery.length} / 500
                </p>
              </div>
              <div className="text-center text-xs text-gray-600 space-y-0.5">
                <p>Describe the expense, and we'll fill the form.</p>
                <p>Review the fields after generating.</p>
              </div>
              <div className="flex-grow"></div>
              <Button onClick={handleNlpParse} isLoading={isAiLoading} className="w-full py-2.5">
                Generate from Text
              </Button>
            </div>
          </div>
          
          {aiError && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                <p className="font-bold">AI Error</p>
                <p>{aiError}</p>
              </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 pt-8 border-t border-gray-200 pb-28 sm:pb-6">
             <SectionHeader icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.5h-8.01a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5h6.99a1.5 1.5 0 0 1 1.5 1.5v2.25a1.5 1.5 0 0 1-1.5 1.5H10.5a.75.75 0 0 0-.75.75v3.75a.75.75 0 0 0 .75.75h2.25Zm-9.741-8.25a.75.75 0 0 0-1.06 0l-1.06 1.06a.75.75 0 0 0 0 1.06l4.5 4.5a.75.75 0 0 0 1.06 0l1.06-1.06a.75.75 0 0 0 0-1.06l-4.5-4.5Z" /></svg>} title="Review and Submit" />
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select id="expenseCategory" name="expenseCategory" label="Expense Category *" value={expenseData.expenseCategory} onChange={handleDataChange} required className={updatedFields.has('expenseCategory') ? highlightClass : ''}>
                    <option value="" disabled>Select a category</option>
                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
                <Input id="project" name="project" label="Project / Cost Center *" value={expenseData.project} onChange={handleDataChange} required className={updatedFields.has('project') ? highlightClass : ''}/>
             </div>

            <div>
              <label htmlFor="expenseTitle" className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <span>Expense Title *</span>
                <div className="group relative flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-400 hover:text-blue-600 cursor-pointer">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <div className="absolute top-full left-1/2 z-20 mt-3 -translate-x-1/2 w-80 max-w-sm rounded-lg bg-gray-800 px-4 py-3 text-sm font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none">
                    <ul className="space-y-1.5 text-left">
                        <li><strong>Flights:</strong> e.g., Flight (DEL-BOM), Flight (DEL-BOM-DEL)</li>
                        <li><strong>Taxi / Auto:</strong> e.g., Taxi (to/from Delhi Airport), Taxi for field visit</li>
                        <li><strong>Train / Bus:</strong> e.g., Train (NDLS-NGP), Bus (Delhi-Chandigarh)</li>
                        <li><strong>Hotel:</strong> e.g., Hotel (14th – 17th Sep)</li>
                        <li><strong>Meals:</strong> e.g., Meal (Lunch at client’s office), Team Dinner</li>
                        <li><strong>Internal:</strong> e.g., Office stationery, Laptop repair, Course - Excel</li>
                    </ul>
                    <div className="absolute bottom-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-8 border-x-transparent border-b-8 border-b-gray-800"></div>
                  </div>
                </div>
              </label>
              <div className="mt-1">
                <input
                  id="expenseTitle"
                  name="expenseTitle"
                  value={expenseData.expenseTitle}
                  onChange={handleDataChange}
                  required
                  placeholder="Formats in tool tip above"
                  className={`block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${updatedFields.has('expenseTitle') ? highlightClass : ''}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Input id="expenseDate" name="expenseDate" type="date" label="Expense Date *" value={expenseData.expenseDate} onChange={handleDataChange} required className={updatedFields.has('expenseDate') ? highlightClass : ''}/>
                <Select id="currency" name="currency" label="Currency *" value={expenseData.currency} onChange={handleDataChange} required className={updatedFields.has('currency') ? highlightClass : ''}>
                    {CURRENCIES.map(curr => <option key={curr} value={curr}>{curr}</option>)}
                </Select>
                 <Input id="amount" name="amount" type="number" label="Amount *" value={expenseData.amount} onChange={handleDataChange} required placeholder="0.00" step="0.01" className={updatedFields.has('amount') ? highlightClass : ''}/>
            </div>

            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700">Comment *</label>
              <textarea id="comment" name="comment" value={expenseData.comment} onChange={handleDataChange} rows={3} required className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${updatedFields.has('comment') ? highlightClass : ''}`}></textarea>
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 z-20 w-full bg-white p-4 border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] sm:relative sm:z-auto sm:w-auto sm:bg-transparent sm:p-0 sm:border-0 sm:shadow-none sm:pt-4">
                <Button type="submit" isLoading={submissionStatus === SubmissionStatus.SUBMITTING} className="w-full text-lg py-3 font-semibold">
                    Submit Expense
                </Button>
            </div>
          </form>
        </main>
      </div>
      <Modal
        isOpen={submissionStatus === SubmissionStatus.SUCCESS || submissionStatus === SubmissionStatus.ERROR}
        onClose={() => setSubmissionStatus(SubmissionStatus.IDLE)}
        title={submissionStatus === SubmissionStatus.SUCCESS ? "Success!" : "Submission Failed"}
      >
        <p className="text-sm text-gray-500">
          {submissionStatus === SubmissionStatus.SUCCESS
            ? "Your expense has been successfully submitted for processing."
            : submissionError || "An unexpected error occurred. Please try again."
          }
        </p>
      </Modal>
    </div>
  );
};

export default App;
