import React, { useState, useEffect } from 'react';

const KnowledgeBase = () => {
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const savedNotes = localStorage.getItem('notes') || '';
    setNotes(savedNotes);
  }, []);

  useEffect(() => {
    if (notes === (localStorage.getItem('notes') || '')) return;

    setSaveStatus('Saving...');
    const saveTimeout = setTimeout(() => {
      localStorage.setItem('notes', notes);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [notes]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">my notes</h2>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Write anything... your notes are saved automatically." className="w-full h-64 p-2 border rounded"></textarea>
      <div className="save-status text-gray-500 italic text-sm mt-2">{saveStatus}</div>
    </div>
  );
};

export default KnowledgeBase;