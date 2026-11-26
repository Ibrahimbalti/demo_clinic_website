import { useSyncExternalStore } from 'react';
import { clinicStore, type ClinicDatabaseState } from '../lib/clinicDataStore';

const subscribe = (listener: () => void) => clinicStore.subscribe(listener);
const getSnapshot = (): ClinicDatabaseState => clinicStore.getState();

export function useClinicStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const currentUser = clinicStore.getCurrentUser();

  return {
    state,
    currentUser,
    store: clinicStore,
  };
}
