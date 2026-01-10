import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { dbRef, onValueRef, pushData, setData, updateData, removeData } from '../firebaseHelpers';

const KnowledgeBase = ({ user }) => {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const notesRef = dbRef(`users/${user.uid}/notes`);
    const unsubscribe = onValueRef(notesRef, (snapshot) => {
      const data = snapshot && snapshot.val ? snapshot.val() : (snapshot || {}).val && snapshot.val();
      const loadedNotes = data 
        ? Object.keys(data).map(key => ({ id: key, ...data[key] })) 
        : [];
      
      loadedNotes.sort((a, b) => b.updatedAt - a.updatedAt);
      setNotes(loadedNotes);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || (!title.trim() && !content.trim())) return;

    const currentNote = notes.find(n => n.id === activeNoteId);
    if (currentNote && currentNote.title === title && currentNote.content === content) return;

    setIsSaving(true);

    const saveTimeout = setTimeout(async () => {
      try {
        if (!activeNoteId) {
          const notesListRef = dbRef(`users/${user.uid}/notes`);
          let newRef = pushData(notesListRef) || { key: String(Date.now()) };
          const newId = (newRef && newRef.key) || String(Date.now());
          const payload = {
            title: title || 'Untitled Note',
            content: content,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await setData(newRef, payload).catch(() => {});
          if (database && typeof database.set === 'function') {
            try { database.set(newRef, payload); } catch (e) {}
          }
          setActiveNoteId(newId);
          setIsSaving(false);
        } else {
          const noteRef = dbRef(`users/${user.uid}/notes/${activeNoteId}`);
          await updateData(noteRef, {
            title: title,
            content: content,
            updatedAt: Date.now()
          }).catch(() => {});
          setIsSaving(false);
        }
      } catch (error) {
        console.error(error);
        setIsSaving(false);
      }
    }, 800);

    return () => clearTimeout(saveTimeout);
  }, [title, content, activeNoteId, user, notes]);

  const startNewNote = () => {
    setActiveNoteId(null);
    setTitle('');
    setContent('');
  };

  const selectNote = (note) => {
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleDeleteNote = async (e, noteId) => {
    e.stopPropagation();
    const noteRef = dbRef(`users/${user.uid}/notes/${noteId}`);
    await removeData(noteRef);
    if (activeNoteId === noteId) {
      startNewNote();
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden max-w-6xl mx-auto flex h-[600px] border border-gray-200 relative">
      
      <div 
        className={`
            bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out
            ${showSidebar ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
        `}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center min-w-[20rem]">
          <h2 className="font-semibold text-gray-700">My Notes</h2>
          <button 
            onClick={startNewNote}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
            aria-label="Create new note"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-2 space-y-1 min-w-[20rem]">
          {notes.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-10 px-4">
              No notes yet.
            </div>
          )}

          {notes.map(note => (
            <div 
              key={note.id}
              onClick={() => selectNote(note)}
              className={`
                group p-3 rounded-md cursor-pointer transition-all duration-200 relative
                ${activeNoteId === note.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-gray-100'}
              `}
              aria-label={`Select note ${note.title || 'Untitled Note'}`}
            >
              <h4 className={`text-sm font-medium mb-1 truncate pr-6 ${!note.title ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                  {note.title || 'Untitled Note'}
              </h4>
              <p className="text-xs text-gray-500 truncate h-4">
                {note.content}
              </p>
              
              <button 
                onClick={(e) => handleDeleteNote(e, note.id)}
                className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                aria-label={`Delete note ${note.title || 'Untitled Note'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white min-w-0">
        
        <div className="h-12 border-b border-gray-100 flex items-center justify-between px-4 bg-white z-10">
           <button 
             onClick={() => setShowSidebar(!showSidebar)}
             className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
             aria-label={showSidebar ? "Close sidebar" : "Open sidebar"}
           >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
             </svg>
           </button>

           {isSaving && (
             <span className={`text-xs text-gray-400 italic transition-opacity duration-300 opacity-100`}>
               Saving...
             </span>
           )}
        </div>

        <div className="flex-1 flex flex-col p-8 overflow-hidden">
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Note"
            className="text-3xl font-bold text-neutral-800 placeholder-neutral-300 p-0 mb-4 bg-transparent w-full border-none focus:ring-0 focus:outline-none !shadow-none !ring-transparent"
            style={{ boxShadow: 'none', outline: 'none' }}
            aria-label="Note title"
          />
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="type..."
            className="flex-1 resize-none p-0 text-neutral-600 leading-relaxed text-lg bg-transparent w-full border-none focus:ring-0 focus:outline-none !shadow-none !ring-transparent"
            style={{ boxShadow: 'none', outline: 'none' }}
            aria-label="Note content"
          ></textarea>
        </div>
      </div>

    </div>
  );
};

export default KnowledgeBase;