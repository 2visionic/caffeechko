import { Capacitor } from '@capacitor/core';
import { CapacitorNfc } from '@capgo/capacitor-nfc';

export interface NfcScanResult {
  identifier: string;
  locationType: 'office' | 'home_office' | 'invalid';
  rawUid?: string;
  source: 'hardware_nfc' | 'simulator';
}

type NfcCallback = (result: NfcScanResult) => void;

class NfcService {
  private isScanning = false;
  private listenerHandle: any = null;
  private listeners: NfcCallback[] = [];

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public async initHardwareNfc(): Promise<boolean> {
    if (!this.isNative()) {
      console.log('[NFC Service] Running in web/browser mode, physical NFC listener disabled.');
      return false;
    }

    try {
      const status = await CapacitorNfc.getStatus();
      if (status.status !== 'NFC_OK') {
        console.warn(`[NFC Service] NFC is not ready: ${status.status}`);
        return false;
      }

      this.listenerHandle = await CapacitorNfc.addListener('nfcEvent', (event) => {
        console.log('[NFC Service] Raw NFC tag scanned:', event);
        
        let hexUid = '';
        if (event.tag?.id && Array.isArray(event.tag.id)) {
          hexUid = event.tag.id.map((b: number) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        }

        // Map tag to location or NDEF payload
        let identifier = 'praha1';
        let locationType: 'office' | 'home_office' | 'invalid' = 'office';

        // Example mapping: check UID or text payload
        if (hexUid.includes('04B2') || hexUid.length > 0) {
          identifier = 'praha1';
          locationType = 'office';
        }

        this.notifyListeners({
          identifier,
          locationType,
          rawUid: hexUid,
          source: 'hardware_nfc'
        });
      });

      await CapacitorNfc.startScanning();
      this.isScanning = true;
      console.log('[NFC Service] Hardware NFC scanning successfully started.');
      return true;
    } catch (err) {
      console.error('[NFC Service] Failed to initialize hardware NFC:', err);
      return false;
    }
  }

  public async stopHardwareNfc(): Promise<void> {
    if (this.isNative() && this.isScanning) {
      try {
        await CapacitorNfc.stopScanning();
        if (this.listenerHandle && typeof this.listenerHandle.remove === 'function') {
          await this.listenerHandle.remove();
          this.listenerHandle = null;
        }
        this.isScanning = false;
      } catch (err) {
        console.error('[NFC Service] Error stopping NFC:', err);
      }
    }
  }

  public subscribe(callback: NfcCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public notifyListeners(result: NfcScanResult): void {
    this.listeners.forEach((callback) => callback(result));
  }
}

export const nfcService = new NfcService();
