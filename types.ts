export const Categories = ["Bills", "Entertainment", "Food", "Shopping", "Fuel", "Groceries", "Health", "Office", "Travel", "Transfer", "Other"] as const;
export type Category = typeof Categories[number];

export interface Transaction {
  id: string;
  cardId: string;
  merchant: string;
  amount: number;
  date: string;
  category: Category;
}

export interface Card {
  id: string;
  name: string;
  last4: string;
  limit: number;
  gradient: string;
}

export interface ParsedSmsData {
    merchant: string;
    amount: number;
    cardLast4: string;
    category?: Category;
}
