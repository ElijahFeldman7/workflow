import { database } from './firebase';
import * as modular from 'firebase/database';

export function dbRef(path) {
  if (database && typeof database.ref === 'function') {
    try { return database.ref(path); } catch (e) {}
  }
  if (modular && typeof modular.ref === 'function') {
    try { return modular.ref(database, path); } catch (e) {}
  }
  return null;
}

export function onValueRef(reference, callback) {
  if (database && typeof database.onValue === 'function') {
    try {
      const unsub = database.onValue(reference, callback);
      return typeof unsub === 'function' ? unsub : (() => {});
    } catch (e) {}
  }

  if (modular && typeof modular.onValue === 'function') {
    try {
      const unsub = modular.onValue(reference, callback);
      return typeof unsub === 'function' ? unsub : (() => {});
    } catch (e) {}
  }

  return () => {};
}

export function setData(reference, value) {
  if (database && typeof database.set === 'function') {
    try { return database.set(reference, value); } catch (e) {}
  }
  if (modular && typeof modular.set === 'function') {
    try { return modular.set(reference, value); } catch (e) {}
  }
  return Promise.resolve();
}

export function updateData(reference, value) {
  if (database && typeof database.update === 'function') {
    try { return database.update(reference, value); } catch (e) {}
  }
  if (modular && typeof modular.update === 'function') {
    try { return modular.update(reference, value); } catch (e) {}
  }
  return Promise.resolve();
}

export function pushData(reference) {
  if (database && typeof database.push === 'function') {
    try { return database.push(reference); } catch (e) {}
  }
  if (modular && typeof modular.push === 'function') {
    try { return modular.push(reference); } catch (e) {}
  }
  return { key: String(Date.now()) };
}

export function removeData(reference) {
  if (database && typeof database.remove === 'function') {
    try { return database.remove(reference); } catch (e) {}
  }
  if (modular && typeof modular.remove === 'function') {
    try { return modular.remove(reference); } catch (e) {}
  }
  return Promise.resolve();
}

export default {
  dbRef,
  onValueRef,
  setData,
  updateData,
  pushData,
  removeData,
};
