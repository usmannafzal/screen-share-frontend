'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    // Simple validation
    if (roomId.length < 3 || roomId.length > 20) {
      setError('Room ID must be between 3 and 20 characters');
      return;
    }

    router.push(`/room/${encodeURIComponent(roomId.trim())}`);
  };

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4'>
      <div className='w-full max-w-md bg-white rounded-lg shadow-md p-8'>
        <h1 className='text-2xl font-bold text-gray-800 mb-6 text-center'>
          Screen Sharing App
        </h1>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <input
              type='text'
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder='Enter Room ID (3-20 characters)'
              className='w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              required
              minLength={3}
              maxLength={20}
            />
            {error && <p className='mt-1 text-sm text-red-600'>{error}</p>}
          </div>
          <button
            type='submit'
            className='w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 flex items-center justify-center'
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}
