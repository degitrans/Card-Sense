import React, { useState, useEffect } from 'react';
import { Card } from '../types';
import { XMarkIcon } from './icons';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCard: (card: Card) => void;
  cardToEdit?: Card | null;
  cards: Card[];
}

const gradients = [
  "from-blue-400 to-purple-500",
  "from-green-400 to-blue-500",
  "from-pink-500 to-orange-400",
  "from-indigo-500 to-purple-600",
  "from-teal-400 to-cyan-500",
  "from-rose-400 to-pink-500"
];

const AddCardModal: React.FC<AddCardModalProps> = ({ isOpen, onClose, onSaveCard, cardToEdit, cards }) => {
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');

  const isEditing = !!cardToEdit;

  useEffect(() => {
    if (isOpen) {
        if (isEditing) {
          setName(cardToEdit.name);
          setLast4(cardToEdit.last4);
          setLimit(cardToEdit.limit.toString());
        } else {
          // Reset form when opening for a new card
          setName('');
          setLast4('');
          setLimit('');
        }
        setError('');
    }
  }, [isOpen, cardToEdit, isEditing]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName || !last4 || !limit) {
      setError('All fields are required.');
      return;
    }
    if (!/^\d{4}$/.test(last4)) {
      setError('Last 4 digits must be exactly 4 numbers.');
      return;
    }
    if (parseFloat(limit) <= 0) {
      setError('Limit must be a positive number.');
      return;
    }
    
    const nameExists = cards.some(
      (card) => card.id !== cardToEdit?.id && card.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameExists) {
        setError('A card with this name already exists.');
        return;
    }

    const last4Exists = cards.some(
        (card) => card.id !== cardToEdit?.id && card.last4 === last4
    );
    if (last4Exists) {
        setError('A card with these last 4 digits already exists.');
        return;
    }

    const cardData = {
        id: isEditing ? cardToEdit.id : `card-${Date.now()}`,
        name: trimmedName,
        last4,
        limit: parseFloat(limit),
        gradient: isEditing ? cardToEdit.gradient : gradients[Math.floor(Math.random() * gradients.length)],
    }

    onSaveCard(cardData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-white border border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{isEditing ? 'Edit Card' : 'Add New Card'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Card Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Chase Freedom"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="last4" className="block text-sm font-medium text-gray-300 mb-2">Last 4 Digits</label>
            <input
              id="last4"
              type="text"
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 1234"
              maxLength={4}
              pattern="\d{4}"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="limit" className="block text-sm font-medium text-gray-300 mb-2">Monthly Limit ($)</label>
            <input
              id="limit"
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 5000"
            />
          </div>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-transform duration-200 ease-in-out transform hover:scale-105">
            {isEditing ? 'Save Changes' : 'Add Card'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddCardModal;
