
function crc16(data) {
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

const base = "00020101021126610014COM.GO-JEK.WWW01189360091439164921360210G9164921360303UKE51440014ID.CO.QRIS.WWW0215ID10200573061580303UKE5204581253033605802ID5921Bakso deStadion Suhat6006MALANG61056514162070703A016304";
console.log("Calculated CRC:", crc16(base));
console.log("Expected CRC: 8600");
