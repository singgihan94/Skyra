import { createContext, useContext, useState } from 'react';

const BluetoothContext = createContext(null);

export function BluetoothProvider({ children }) {
  const [btDevice, setBtDevice] = useState(null);
  const [btServer, setBtServer] = useState(null);
  const [btCharacteristic, setBtCharacteristic] = useState(null);
  const [btStatus, setBtStatus] = useState('disconnected'); // disconnected, connecting, connected
  const [btDeviceName, setBtDeviceName] = useState('');

  async function connectBluetooth() {
    if (!navigator.bluetooth) {
      throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome/Edge.');
    }

    setBtStatus('connecting');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '00001101-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        ],
        acceptAllDevices: false,
      });

      setBtDevice(device);
      setBtDeviceName(device.name || 'Printer Tanpa Nama');

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('disconnected');
        setBtCharacteristic(null);
        setBtServer(null);
      });

      const server = await device.gatt.connect();
      setBtServer(server);

      let characteristic = null;
      const serviceUUIDs = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
      ];
      const charUUIDs = [
        '00002af1-0000-1000-8000-00805f9b34fb',
        'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
      ];

      for (const sUuid of serviceUUIDs) {
        try {
          const service = await server.getPrimaryService(sUuid);
          for (const cUuid of charUUIDs) {
            try {
              characteristic = await service.getCharacteristic(cUuid);
              break;
            } catch { /* try next */ }
          }
          if (characteristic) break;
          // Fallback: get first writable characteristic
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              characteristic = c;
              break;
            }
          }
          if (characteristic) break;
        } catch { /* try next service */ }
      }

      if (!characteristic) {
        throw new Error('Tidak dapat menemukan service cetak pada printer ini.');
      }

      setBtCharacteristic(characteristic);
      setBtStatus('connected');
      return device.name || 'printer';
    } catch (err) {
      setBtStatus('disconnected');
      throw err;
    }
  }

  async function disconnectBluetooth() {
    if (btDevice?.gatt?.connected) {
      btDevice.gatt.disconnect();
    }
    setBtStatus('disconnected');
    setBtDevice(null);
    setBtServer(null);
    setBtCharacteristic(null);
    setBtDeviceName('');
  }

  async function sendToPrinter(cmds) {
    if (!btCharacteristic) throw new Error('Printer belum terhubung!');
    for (const cmd of cmds) {
      for (let i = 0; i < cmd.length; i += 20) {
        const chunk = cmd.slice(i, i + 20);
        if (btCharacteristic.properties.writeWithoutResponse) {
          await btCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await btCharacteristic.writeValueWithResponse(chunk);
        }
        await new Promise(r => setTimeout(r, 30));
      }
    }
  }

  return (
    <BluetoothContext.Provider value={{
      btDevice, btStatus, btDeviceName,
      connectBluetooth, disconnectBluetooth, sendToPrinter
    }}>
      {children}
    </BluetoothContext.Provider>
  );
}

export function useBluetooth() {
  const ctx = useContext(BluetoothContext);
  if (!ctx) throw new Error('useBluetooth must be inside BluetoothProvider');
  return ctx;
}
