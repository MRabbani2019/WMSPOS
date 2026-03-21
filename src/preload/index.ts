import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  getTerminalConfig: () => ipcRenderer.invoke('getTerminalConfig'),
  saveTerminalConfig: (config: any) => ipcRenderer.invoke('saveTerminalConfig', config),
  getStoredToken: () => ipcRenderer.invoke('getStoredToken'),
  saveStoredToken: (token: string) => ipcRenderer.invoke('saveStoredToken', token)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
