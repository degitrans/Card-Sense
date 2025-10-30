import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Transaction, ParsedSmsData, Category, Categories } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { parseSmsExpense } from './services/geminiService';
import AddCardModal from './components/AddCardModal';
import AddTransactionModal from './components/AddTransactionModal';
import { 
    PlusIcon, CreditCardIcon, SparklesIcon, ListBulletIcon, PencilIcon, BillIcon, EntertainmentIcon, 
    FoodIcon, ShoppingIcon, FuelIcon, GroceriesIcon, HealthIcon, OfficeIcon, TravelIcon, TransferIcon, 
    OtherIcon, ChartPieIcon, BellIcon, TrashIcon
} from './components/icons';

const CATEGORY_CONFIG: { [key in Category]: { color: string; icon: React.FC<{className?: string}> } } = {
    Bills: { color: 'bg-red-500', icon: BillIcon },
    Entertainment: { color: 'bg-pink-500', icon: EntertainmentIcon },
    Food: { color: 'bg-yellow-500', icon: FoodIcon },
    Shopping: { color: 'bg-purple-500', icon: ShoppingIcon },
    Fuel: { color: 'bg-orange-500', icon: FuelIcon },
    Groceries: { color: 'bg-green-500', icon: GroceriesIcon },
    Health: { color: 'bg-blue-500', icon: HealthIcon },
    Office: { color: 'bg-indigo-500', icon: OfficeIcon },
    Travel: { color: 'bg-teal-500', icon: TravelIcon },
    Transfer: { color: 'bg-gray-500', icon: TransferIcon },
    Other: { color: 'bg-gray-400', icon: OtherIcon },
};

interface PieChartProps {
    data: { name: string; value: number; color: string }[];
}

const PieChart: React.FC<PieChartProps> = ({ data }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const total = data.reduce((acc, entry) => acc + entry.value, 0);
    if (total === 0) return <div className="w-32 h-32 bg-gray-700 rounded-full"></div>;

    let accumulatedOffset = 0;

    return (
        <svg viewBox="0 0 120 120" className="w-32 h-32 transform -rotate-90">
            {data.map((entry, index) => {
                const percentage = entry.value / total;
                const strokeDasharray = `${circumference * percentage} ${circumference}`;
                const offset = (accumulatedOffset / total) * circumference;
                accumulatedOffset += entry.value;

                return (
                    <circle
                        key={index}
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="transparent"
                        strokeWidth="20"
                        className={entry.color.replace('bg-', 'stroke-')}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={-offset}
                    />
                );
            })}
        </svg>
    );
};

const App: React.FC = () => {
  const [cards, setCards] = useLocalStorage<Card[]>('cards', []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);
  const [sentNotifications, setSentNotifications] = useLocalStorage<{[key: string]: boolean}>('sentNotifications', {});
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [smsInput, setSmsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCardFilter, setSelectedCardFilter] = useState<string>('all');
  
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [dragInfo, setDragInfo] = useState({ isDragging: false, startX: 0, dragOffset: 0 });
  const isDraggingRef = useRef(dragInfo.isDragging);
  isDraggingRef.current = dragInfo.isDragging;

  const [notificationPermission, setNotificationPermission] = useState('default');
  
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        alert("This browser does not support desktop notification");
        return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      showTemporaryMessage(setSuccessMessage, "Notifications enabled!");
    }
  }

  useEffect(() => {
    if (cards.length > 0) {
        setActiveCardIndex(cards.length - 1);
    }
  }, [cards.length]);

  const monthlySummary = useMemo(() => {
    const summary = new Map<Category, number>();
    Categories.forEach(cat => summary.set(cat, 0));
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let total = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
          const currentTotal = summary.get(tx.category) || 0;
          summary.set(tx.category, currentTotal + tx.amount);
          total += tx.amount;
      }
    });

    const pieData = Array.from(summary.entries())
        .filter(([, amount]) => amount > 0)
        .map(([category, amount]) => ({
            name: category,
            value: amount,
            percentage: total > 0 ? (amount / total) * 100 : 0,
            color: CATEGORY_CONFIG[category].color,
        }))
        .sort((a,b) => b.value - a.value);

    return { pieData, total };
  }, [transactions]);

  const cardExpenses = useMemo(() => {
    const expenses = new Map<string, number>();
    cards.forEach(card => expenses.set(card.id, 0));
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
          const currentTotal = expenses.get(tx.cardId) || 0;
          expenses.set(tx.cardId, currentTotal + tx.amount);
      }
    });
    return expenses;
  }, [cards, transactions]);
  
  const filteredTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (selectedCardFilter === 'all') {
      return sorted;
    }
    return sorted.filter(tx => tx.cardId === selectedCardFilter);
  }, [transactions, selectedCardFilter]);

  const handleSaveCard = (card: Card) => {
    const cardIndex = cards.findIndex(c => c.id === card.id);
    if (cardIndex > -1) {
      const updatedCards = [...cards];
      updatedCards[cardIndex] = card;
      setCards(updatedCards);
    } else {
      setCards([...cards, card]);
    }
  };

  const handleOpenEditModal = (card: Card) => {
    setCardToEdit(card);
    setIsCardModalOpen(true);
  }

  const handleOpenAddCardModal = () => {
    setCardToEdit(null);
    setIsCardModalOpen(true);
  }
  
  const handleOpenAddTxModal = () => {
    setTransactionToEdit(null);
    setIsTxModalOpen(true);
  };

  const handleOpenEditTxModal = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = (data: Partial<Transaction> & { cardId: string; merchant: string; amount: number; category: Category }) => {
    if (data.id) { // Editing existing transaction
      setTransactions(prev => prev.map(tx => tx.id === data.id ? { ...tx, ...data } : tx));
      showTemporaryMessage(setSuccessMessage, `Updated transaction for ${data.merchant}.`);
    } else { // Adding new transaction
      const newTransaction: Transaction = {
          id: `tx-${Date.now()}`,
          cardId: data.cardId,
          merchant: data.merchant,
          amount: data.amount,
          date: new Date().toISOString(),
          category: data.category
      };
      setTransactions(prev => [...prev, newTransaction]);
      const cardName = cards.find(c => c.id === data.cardId)?.name || 'card';
      showTemporaryMessage(setSuccessMessage, `Added $${data.amount.toFixed(2)} expense to ${cardName}.`);
    }
  };

  const handleDeleteTransaction = (transactionId: string) => {
    if (window.confirm("Are you sure you want to delete this transaction? This action cannot be undone.")) {
      setTransactions(prev => prev.filter(tx => tx.id !== transactionId));
      showTemporaryMessage(setSuccessMessage, "Transaction deleted.");
    }
  };

  const showTemporaryMessage = (setMessage: React.Dispatch<React.SetStateAction<string | null>>, message: string) => {
    setMessage(message);
    setTimeout(() => setMessage(null), 3000);
  };
  
  const handleParseSms = async () => {
    if (!smsInput.trim()) {
      showTemporaryMessage(setError, "SMS message cannot be empty.");
      return;
    }
    if(cards.length === 0){
      showTemporaryMessage(setError, "Please add a credit card first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const result: ParsedSmsData | null = await parseSmsExpense(smsInput);
    setIsLoading(false);

    if (result) {
      const matchingCard = cards.find(c => c.last4 === result.cardLast4);
      if (matchingCard) {
        handleSaveTransaction({
          cardId: matchingCard.id,
          merchant: result.merchant,
          amount: result.amount,
          category: result.category || 'Other'
        });
        setSmsInput('');
      } else {
        showTemporaryMessage(setError, `Could not find a card ending in ${result.cardLast4}.`);
      }
    } else {
      showTemporaryMessage(setError, "Failed to parse SMS. Please try a different format.");
    }
  };
  
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cards.length <= 1) return;
    setDragInfo({ isDragging: true, startX: e.pageX, dragOffset: 0 });
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };
  
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (cards.length <= 1) return;
    setDragInfo({ isDragging: true, startX: e.touches[0].pageX, dragOffset: 0 });
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    setDragInfo(prev => ({ ...prev, dragOffset: e.pageX - prev.startX }));
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDraggingRef.current) return;
    setDragInfo(prev => ({ ...prev, dragOffset: e.touches[0].pageX - prev.startX }));
  };

  const handleDragEnd = () => {
    const dragThreshold = 80;
    setDragInfo(prev => {
        if (prev.dragOffset < -dragThreshold) {
            setActiveCardIndex(i => Math.min(cards.length - 1, i + 1));
        } 
        else if (prev.dragOffset > dragThreshold) {
            setActiveCardIndex(i => Math.max(0, i - 1));
        }
        return { isDragging: false, startX: 0, dragOffset: 0 };
    });
    
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleDragEnd);
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage > 85) return 'bg-red-500';
    if (percentage > 50) return 'bg-yellow-500';
    if (percentage > 30) return 'bg-blue-500';
    return 'bg-green-500';
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const createProgressBar = (percentage: number): string => {
    const filledBlocks = Math.round((percentage / 100) * 10);
    const emptyBlocks = 10 - filledBlocks;
    return `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}] ${percentage.toFixed(1)}% Used`;
  };
  
  const sendSpendingNotification = (card: Card, percentage: number) => {
    const progressBar = createProgressBar(percentage);
    const notification = new Notification(`Spending Alert: ${card.name}`, {
      body: `You've used ${percentage.toFixed(1)}% of your limit.\n${progressBar}`,
      silent: true,
    });
  };

  useEffect(() => {
    if (notificationPermission !== 'granted') return;
  
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thresholds = [30, 50, 85];
  
    cards.forEach(card => {
      const spent = cardExpenses.get(card.id) || 0;
      const percentage = card.limit > 0 ? (spent / card.limit) * 100 : 0;
  
      thresholds.forEach(threshold => {
        const notificationKey = `${card.id}-${currentYear}-${currentMonth}-${threshold}`;
        if (percentage >= threshold && !sentNotifications[notificationKey]) {
          sendSpendingNotification(card, percentage);
          setSentNotifications(prev => ({ ...prev, [notificationKey]: true }));
        }
      });
    });
  }, [cardExpenses, cards, notificationPermission, sentNotifications, setSentNotifications]);

  const MAX_VISIBLE_BEHIND = 3;
  const Y_OFFSET_PER_CARD = 12;
  const SCALE_FACTOR_PER_CARD = 0.05;
  const CARD_BASE_HEIGHT = 180;
  const FIXED_CARD_STACK_HEIGHT = CARD_BASE_HEIGHT + MAX_VISIBLE_BEHIND * Y_OFFSET_PER_CARD;

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <div className="container mx-auto max-w-md p-4">
        
        <header className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <CreditCardIcon className="w-8 h-8 text-blue-400"/>
            <h1 className="text-3xl font-bold tracking-tight">CardSense</h1>
          </div>
          <button onClick={handleOpenAddCardModal} className="bg-blue-600 p-2 rounded-full hover:bg-blue-700 transition-all duration-200 shadow-lg">
            <PlusIcon className="w-6 h-6"/>
          </button>
        </header>

        {notificationPermission === 'default' && cards.length > 0 && (
            <div className="my-4 bg-gray-800 border border-blue-500/50 rounded-lg p-3 flex items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <BellIcon className="w-6 h-6 text-blue-400" />
                    <p className="text-sm text-gray-300">Enable notifications for spending alerts.</p>
                </div>
                <button onClick={requestNotificationPermission} className="bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-md hover:bg-blue-700 transition-colors">
                    Enable
                </button>
            </div>
        )}

        <main className="mt-6 select-none" style={{ height: `${FIXED_CARD_STACK_HEIGHT}px` }}>
          {cards.length === 0 ? (
             <div className="text-center h-full flex flex-col justify-center items-center p-6 bg-gray-800 rounded-2xl">
                <CreditCardIcon className="w-16 h-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-300">No Cards Yet</h3>
                <p className="text-gray-400 mt-2">Click the '+' button to add your first credit card and start tracking expenses.</p>
             </div>
          ) : (
            <div 
              className="relative w-full h-full cursor-grab active:cursor-grabbing"
              onMouseDown={handleDragStart}
              onTouchStart={handleTouchStart}
            >
              {cards.map((card, index) => {
                const isTopCard = index === activeCardIndex;
                const stackPosition = index - activeCardIndex;

                const style: React.CSSProperties = {
                    position: 'absolute',
                    width: '100%',
                    zIndex: cards.length - Math.abs(stackPosition),
                    transition: dragInfo.isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.4s ease-out',
                };
                
                let transform = '';
                if (stackPosition < 0 && Math.abs(stackPosition) <= MAX_VISIBLE_BEHIND) {
                    // Cards behind the active card
                    style.opacity = 1 - Math.abs(stackPosition) * 0.25;
                    transform = `translateY(${Math.abs(stackPosition) * Y_OFFSET_PER_CARD}px) scale(${1 - Math.abs(stackPosition) * SCALE_FACTOR_PER_CARD})`;
                } else if (stackPosition === 0) {
                    // The active card
                    style.opacity = 1;
                    transform = `translateY(0) scale(1)`;
                    if (dragInfo.isDragging) {
                        transform = `translateX(${dragInfo.dragOffset}px) rotate(${dragInfo.dragOffset / 20}deg)`;
                    }
                } else {
                    // Cards in front of (or far behind) the active card, effectively hidden
                    style.opacity = 0;
                    transform = stackPosition > 0 
                        ? `translateX(500px) rotate(30deg)` // Swiped away to the right
                        : `translateY(${MAX_VISIBLE_BEHIND * Y_OFFSET_PER_CARD}px) scale(${1 - MAX_VISIBLE_BEHIND * SCALE_FACTOR_PER_CARD})`; // Too far behind
                }
                style.transform = transform;


                const spent = cardExpenses.get(card.id) || 0;
                const limit = card.limit;
                const percentage = limit > 0 ? (spent / limit) * 100 : 0;

                return (
                  <div key={card.id} style={style} className={isTopCard ? '' : 'pointer-events-none'}>
                    <div className={`bg-gray-800 p-5 rounded-2xl border border-gray-700 overflow-hidden transition-all duration-300 ${isTopCard ? 'shadow-2xl shadow-blue-900/50' : 'shadow-lg shadow-black/50'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-bold text-lg">{card.name}</span>
                          <span className="text-sm font-mono bg-gray-700 px-2 py-1 rounded ml-2">**** {card.last4}</span>
                        </div>
                        {isTopCard && (
                          <button onClick={() => handleOpenEditModal(card)} className="p-1 text-gray-400 hover:text-white z-20 pointer-events-auto">
                            <PencilIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <div className="text-gray-400 text-sm mb-4">
                        Limit: ${limit.toLocaleString()}
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
                        <div 
                          className={`${getProgressBarColor(percentage)} h-3 rounded-full transition-all duration-500 ease-out`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-baseline text-sm">
                        <span className="font-medium text-gray-300">Spent: ${spent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        <span className="font-bold text-lg">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
        
        <section className="mt-8 bg-gray-800 p-5 rounded-2xl border border-gray-700">
            <h2 className="text-xl font-semibold mb-3">Add Expense via SMS</h2>
            <textarea
                value={smsInput}
                onChange={(e) => setSmsInput(e.target.value)}
                placeholder="Paste your bank SMS here...&#10;e.g., 'Your transaction of $45.50 at Starbucks with card ending 1234 was successful.'"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
             {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
             {successMessage && <p className="text-green-400 text-xs mt-2">{successMessage}</p>}
            <button
                onClick={handleParseSms}
                disabled={isLoading}
                className="mt-4 w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-transform duration-200 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
                {isLoading ? ( <> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg> Parsing... </> ) : ( <> <SparklesIcon className="w-5 h-5"/> Parse with AI </> )}
            </button>
        </section>

        <section className="mt-8">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <ChartPieIcon className="w-6 h-6" />
                Category Summary (This Month)
            </h2>
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
                {monthlySummary.total > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-shrink-0">
                           <PieChart data={monthlySummary.pieData} />
                        </div>
                        <div className="w-full">
                            <ul className="space-y-2 text-sm">
                                {monthlySummary.pieData.map(item => (
                                    <li key={item.name} className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                                            <span>{item.name}</span>
                                        </div>
                                        <span className="font-bold">{item.percentage.toFixed(1)}%</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        <p>No spending this month to summarize.</p>
                    </div>
                )}
            </div>
        </section>

        <section className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"> <ListBulletIcon className="w-6 h-6" /> Transaction History </h2>
              <div className="flex items-center gap-2">
                {cards.length > 0 && (
                  <select value={selectedCardFilter} onChange={e => setSelectedCardFilter(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2">
                      <option value="all">All Cards</option>
                      {cards.map(card => ( <option key={card.id} value={card.id}>{card.name}</option> ))}
                  </select>
                )}
                <button onClick={handleOpenAddTxModal} className="bg-gray-700 p-2 rounded-full hover:bg-gray-600 transition-colors duration-200"> <PlusIcon className="w-5 h-5" /> </button>
              </div>
            </div>
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 min-h-[10rem] max-h-96 overflow-y-auto">
                {filteredTransactions.length > 0 ? (
                    <ul className="space-y-3">
                        {filteredTransactions.map(tx => {
                            const card = cards.find(c => c.id === tx.cardId);
                            const category = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG.Other;
                            const CategoryIcon = category.icon;
                            return (
                                <li key={tx.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                                    <div className="flex items-center gap-3 flex-grow">
                                        <div className="flex-shrink-0"><CategoryIcon className="w-6 h-6 text-gray-400" /></div>
                                        <div className="flex-grow">
                                            <p className="font-semibold">{tx.merchant}</p>
                                            <p className="text-xs text-gray-400">{formatDate(tx.date)} &bull; {card?.name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <p className="font-bold text-lg">${tx.amount.toFixed(2)}</p>
                                        <button onClick={() => handleOpenEditTxModal(tx)} className="p-1 text-gray-400 hover:text-white transition-colors">
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1 text-gray-400 hover:text-red-400 transition-colors">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : ( <div className="flex items-center justify-center h-full text-center text-gray-500 py-8"> <p> {transactions.length === 0 ? "No transactions recorded yet." : "No transactions for this card."} </p> </div> )}
            </div>
        </section>

      </div>
      <AddCardModal isOpen={isCardModalOpen} onClose={() => setIsCardModalOpen(false)} onSaveCard={handleSaveCard} cardToEdit={cardToEdit} cards={cards} />
      <AddTransactionModal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} onSaveTransaction={handleSaveTransaction} cards={cards} transactionToEdit={transactionToEdit}/>
    </div>
  );
};

export default App;