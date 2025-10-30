import { GoogleGenAI, Type } from "@google/genai";
import { ParsedSmsData, Categories } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const expenseSchema = {
    type: Type.OBJECT,
    properties: {
        merchant: {
            type: Type.STRING,
            description: "The name of the merchant or store where the purchase was made. E.g., 'Amazon', 'Starbucks', 'Walmart'."
        },
        amount: {
            type: Type.NUMBER,
            description: "The transaction amount as a number. E.g., 25.50, 100."
        },
        cardLast4: {
            type: Type.STRING,
            description: "The last 4 digits of the credit card used for the transaction. E.g., '1234', '9876'."
        },
        category: {
            type: Type.STRING,
            description: `Categorize the expense into one of the following: ${Categories.join(', ')}. Default to 'Other' if unsure.`,
            enum: Categories,
        }
    },
    required: ["merchant", "amount", "cardLast4", "category"]
};

export const parseSmsExpense = async (sms: string): Promise<ParsedSmsData | null> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Analyze the following SMS message and extract the expense details. The user wants to know the merchant, the amount spent, the last 4 digits of the credit card used, and a relevant category for the expense.
        
        SMS: "${sms}"
        
        Extract the information based on the provided JSON schema.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: expenseSchema,
        },
    });

    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText);
    
    if (parsedData && typeof parsedData.amount === 'number' && parsedData.merchant && parsedData.cardLast4) {
        return parsedData as ParsedSmsData;
    }
    return null;
  } catch (error) {
    console.error("Error parsing SMS with Gemini:", error);
    return null;
  }
};
