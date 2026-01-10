import '@testing-library/jest-dom';

class MockGoogleAuthProvider {
  static credential = jest.fn();
}

const mockAuth = jest.fn(() => ({
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));
mockAuth.GoogleAuthProvider = MockGoogleAuthProvider;

const mockFirebase = {
  auth: mockAuth,
  database: jest.fn(() => ({
    ref: jest.fn(() => ({
      on: jest.fn(),
      set: jest.fn(),
      push: jest.fn(),
    })),
  })),
  initializeApp: jest.fn().mockReturnThis(),
  app: jest.fn().mockReturnThis(),
  apps: [],
};

jest.mock('firebase/compat/app', () => mockFirebase);
jest.mock('firebase/compat/auth', () => ({
  GoogleAuthProvider: MockGoogleAuthProvider,
}));
jest.mock('firebase/compat/database', () => ({}));

jest.mock('firebase/app', () => mockFirebase);