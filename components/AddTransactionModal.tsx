import React, { useState, useEffect } from 'react';
import { Card, Category, Categories, Transaction } from '../types';
import { XMarkIcon } from './icons';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTransaction: (data: Partial<Transaction> & { cardId: string; merchant: string; amount: number; category: Category }) => void;
  cards: Card[];
  transactionToEdit?: Transaction | null;
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ isOpen, onClose, onSaveTransaction, cards, transactionToEdit }) => {
  const [cardId, setCardId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [error, setError] = useState('');

  const isEditing = !!transactionToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing) {
        setCardId(transactionToEdit.cardId);
        setMerchant(transactionToEdit.merchant);
        setAmount(transactionToEdit.amount.toString());
        setCategory(transactionToEdit.category);
      } else {
        setCardId(cards.length > 0 ? cards[0].id : '');
        setMerchant('');
        setAmount('');
        setCategory('Other');
      }
      setError('');
    }
  }, [isOpen, cards, transactionToEdit, isEditing]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId || !merchant || !amount) {
      setError('All fields are required.');
      return;
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    
    onSaveTransaction({
      id: isEditing ? transactionToEdit.id : undefined,
      cardId,
      merchant,
      amount: numericAmount,
      category,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-white border border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{isEditing ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon />
          </button>
        </div>
        {cards.length > 0 ? (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="cardId" className="block text-sm font-medium text-gray-300 mb-2">Card</label>
                    <select
                        id="cardId"
                        value={cardId}
                        onChange={(e) => setCardId(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {cards.map(card => (
                            <option key={card.id} value={card.id}>
                                {card.name} (**** {card.last4})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="merchant" className="block text-sm font-medium text-gray-300 mb-2">Merchant</label>
                    <input
                    id="merchant"
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Amazon, Starbucks"
                    />
                </div>
                <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">Amount ($)</label>
                    <input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 45.50"
                    />
                </div>
                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                    <select
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value as Category)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {Categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {error && <p className="text-red-400 text-sm pt-2">{error}</p>}
                
                <div className="pt-2">
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-transform duration-200 ease-in-out transform hover:scale-105">
                        {isEditing ? 'Save Changes' : 'Add Transaction'}
                    </button>
                </div>
            </form>
        ) : (
            <div className="text-center text-gray-400">
                <p>Please add a card first before adding a transaction.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AddTransactionModal;