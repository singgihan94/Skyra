/**
 * Utility for QRIS (Quick Response Code Indonesian Standard)
 * Implements EMVCo parsing and CRC16-CCITT for dynamic amount injection.
 */

export function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates a dynamic QRIS string from a static base and amount.
 * @param {string} base - Static QRIS string starting with 000201
 * @param {number} amount - Transaction amount
 * @returns {string} - Complete Dynamic QRIS string
 */
export function generateDynamicQRIS(base, amount) {
  if (!base || !base.startsWith('000201')) return base;

  // Remove existing CRC (last 8 characters: 6304 + 4 digits)
  let qris = base.slice(0, -8);

  // 1. Change Point of Initiation Method (Tag 01) from 11 (Static) to 12 (Dynamic)
  // Find "010211" and replace with "010212"
  qris = qris.replace('010211', '010212');

  // 2. Add/Inject Amount (Tag 54)
  const amountStr = String(Math.floor(amount));
  const amountTag = '54' + String(amountStr.length).padStart(2, '0') + amountStr;

  // Tag 54 should be placed after Tag 53 (Currency) or before Tag 58 (Country Code)
  // Usually it follows Tag 53 (5303360)
  if (qris.includes('5303360')) {
    qris = qris.replace('5303360', '5303360' + amountTag);
  } else {
    // Fallback: inject before Tag 58 (ID)
    const pos58 = qris.indexOf('5802ID');
    if (pos58 !== -1) {
      qris = qris.slice(0, pos58) + amountTag + qris.slice(pos58);
    }
  }

  // 3. Add CRC Placeholder
  qris += '6304';

  // 4. Calculate and append CRC
  return qris + crc16(qris);
}
