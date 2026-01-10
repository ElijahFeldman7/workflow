import '@testing-library/jest-dom';

const mockRef = (path = '') => ({
  _path: { pieces_: [path] },
  root: { _path: { pieces_: [] } },
  key: 'mock-key',
  toString: () => path,
});

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
  ref: jest.fn((db, path) => mockRef(path)),
  onValue: jest.fn((query, callback) => {
    callback({ val: () => null });
    return () => {}; 
  }),
  set: jest.fn(() => Promise.resolve()),
  push: jest.fn(() => ({ ...mockRef(), key: 'new-key' })),
  remove: jest.fn(() => Promise.resolve()),
  update: jest.fn(() => Promise.resolve()),
  child: jest.fn((parent, path) => mockRef(path)),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: { uid: 'test-user' },
    onAuthStateChanged: jest.fn((cb) => {
      cb({ uid: 'test-user' });
      return () => {};
    }),
  })),
  GoogleAuthProvider: class { static credential = jest.fn(); },
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));

jest.mock('./firebase', () => ({
  database: {
    ref: jest.fn((path) => mockRef(path)),
    onValue: jest.fn((ref, callback) => {
      callback({ val: () => null });
      return () => {};
    }),
    set: jest.fn(() => Promise.resolve()),
  },
  auth: {
    currentUser: { uid: 'test-user' },
  }
}));