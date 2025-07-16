
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ExpenseData, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const expenseSchema = {
    type: Type.OBJECT,
    properties: {
        expenseCategory: { 
            type: Type.STRING,
            description: 'The category of the expense.',
            enum: EXPENSE_CATEGORIES,
        },
        project: { 
            type: Type.STRING,
            description: 'The project or cost center to charge the expense to.'
        },
        expenseTitle: { 
            type: Type.STRING,
            description: 'A concise title or description of the expense (e.g., Merchant name).'
        },
        expenseDate: { 
            type: Type.STRING,
            description: 'The date of the expense in YYYY-MM-DD format.'
        },
        currency: { 
            type: Type.STRING,
            description: 'The currency code of the expense (e.g., INR, USD).'
        },
        amount: { 
            type: Type.NUMBER,
            description: 'The total amount of the expense.'
        },
        comment: {
            type: Type.STRING,
            description: 'Any additional comments or notes about the expense.'
        }
    },
    required: ['expenseTitle', 'expenseDate', 'amount', 'currency', 'expenseCategory']
};


const parseJsonResponse = (response: GenerateContentResponse): Partial<ExpenseData> => {
    try {
        const text = response.text.trim();
        // The API might return a markdown code block `json ... `
        const jsonString = text.replace(/^```json\s*|```$/g, '');
        const parsed = JSON.parse(jsonString);
        
        // Sanitize data
        const sanitizedData: Partial<ExpenseData> = {};
        if (parsed.expenseCategory && EXPENSE_CATEGORIES.includes(parsed.expenseCategory)) {
            sanitizedData.expenseCategory = parsed.expenseCategory;
        }
        if (typeof parsed.project === 'string') sanitizedData.project = parsed.project;
        if (typeof parsed.expenseTitle === 'string') sanitizedData.expenseTitle = parsed.expenseTitle;
        if (typeof parsed.expenseDate === 'string') sanitizedData.expenseDate = parsed.expenseDate.split('T')[0]; // Ensure YYYY-MM-DD
        if (typeof parsed.currency === 'string') sanitizedData.currency = parsed.currency.toUpperCase();
        if (typeof parsed.amount === 'number') sanitizedData.amount = parsed.amount;
        if (typeof parsed.comment === 'string') sanitizedData.comment = parsed.comment;

        return sanitizedData;
    } catch (error) {
        console.error("Failed to parse Gemini JSON response:", error);
        throw new Error("Could not understand the AI's response. Please try again or enter manually.");
    }
};

export const parseTextFromNaturalLanguage = async (text: string): Promise<Partial<ExpenseData>> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Parse the following expense description: "${text}"`,
            config: {
                systemInstruction: `You are an intelligent assistant for parsing expense reports. Extract expense details from the user's text into a JSON object matching the provided schema. The 'amount' is a numerical value and might not have a currency symbol. Infer the 'currency' from symbols (e.g., ₹, Rs) or context; default to 'INR' if it's ambiguous or missing. For 'expenseDate', use YYYY-MM-DD format. If a value isn't found, omit its key from the JSON.`,
                responseMimeType: "application/json",
                responseSchema: expenseSchema,
            }
        });
        return parseJsonResponse(response);
    } catch (error) {
        console.error("Error calling Gemini API for NLP:", error);
        throw new Error("Failed to process your request. The AI service may be unavailable.");
    }
};

export const parseReceiptFromImage = async (base64Image: string, mimeType: string): Promise<Partial<ExpenseData>> => {
    const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
    };

    const textPart = {
        text: `Analyze this receipt. Extract the merchant name for 'expenseTitle', the date for 'expenseDate' (in YYYY-MM-DD format), the total amount, and the currency. Based on the items, suggest the most likely 'expenseCategory' from the allowed options. Return the data using the provided JSON schema.`
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                 systemInstruction: "You are an expert at extracting information from receipts. Return a JSON object matching the provided schema. If a value isn't found, omit it from the JSON.",
                 responseMimeType: "application/json",
                 responseSchema: expenseSchema
            }
        });
        return parseJsonResponse(response);
    } catch (error) {
        console.error("Error calling Gemini API for OCR:", error);
        throw new Error("Failed to read the receipt. The AI service may be unavailable.");
    }
};
