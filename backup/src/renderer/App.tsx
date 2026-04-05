import React, { useState } from 'react';
import { motion } from 'framer-motion';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold mb-8">Fuji Station</h1>
        <p className="text-xl mb-4">Welcome to your photo management app</p>
        <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
          <p className="mb-4">Current count: {count}</p>
          <button
            onClick={() => setCount(count + 1)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Increment
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
