import { createJSONStorage, type StateStorage } from 'zustand/middleware'

let _storage: StateStorage = {
  getItem: async (name) => localStorage.getItem(name),
  setItem: async (name, value) => { localStorage.setItem(name, value) },
  removeItem: async (name) => { localStorage.removeItem(name) },
}

export function setPlatformStorage(s: StateStorage) {
  _storage = s
}

export function getPlatformStorage() {
  return _storage
}

export const platformJSONStorage = () => createJSONStorage(() => _storage)
