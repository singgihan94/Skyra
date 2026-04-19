/**
 * Utility for printing raster images on ESC/POS thermal printers.
 * Converts an image URL to monochrome bitmap data compatible with
 * the GS v 0 (print raster bit image) command.
 */

/**
 * Loads an image from URL and converts it to ESC/POS raster bitmap commands.
 * @param {string} imageUrl - URL of the image to print
 * @param {number} maxWidth - Maximum width in dots (384 for 58mm printer)
 * @returns {Promise<Uint8Array[]>} Array of command buffers to send to printer
 */
export async function imageToEscPos(imageUrl, maxWidth = 384, options = {}) {
  // Load image
  const img = await loadImage(imageUrl);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  let width = img.width;
  let height = img.height;
  
  if (options.text) {
    // Rendition with Text Side-by-Side
    const logoSize = 64; // Scale logo to max 64px
    if (width > logoSize || height > logoSize) {
      if (width > height) {
        height = (height * logoSize) / width;
        width = logoSize;
      } else {
        width = (width * logoSize) / height;
        height = logoSize;
      }
    }
    
    // We will center this block. Let's make canvas width = 384.
    const canvasWidth = 384;
    const canvasHeight = Math.max(height, 64) + 16;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate total layout width to center it organically
    ctx.font = 'bold 44px sans-serif'; // big enough to match double height text
    const textMetrics = ctx.measureText(options.text);
    const textWidth = textMetrics.width;
    const gap = 16;
    const totalContentWidth = width + gap + textWidth;
    
    const startX = Math.max((canvasWidth - totalContentWidth) / 2, 0);
    
    // Draw Logo
    ctx.drawImage(img, startX, (canvasHeight - height) / 2, width, height);
    
    // Draw Text
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.text, startX + width + gap, canvasHeight / 2 + 4); // +4 vertical center adjustment
    
    width = canvasWidth;
    height = canvasHeight;
  } else {
    // Normal Scaled Down rendition
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    
    width = Math.floor(width / 8) * 8;
    canvas.width = width;
    canvas.height = height;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
  }

  
  // Width must be multiple of 8 for byte alignment
  width = Math.floor(width / 8) * 8;
  
  // Get pixel data
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  
  // Convert to monochrome bitmap
  // Each byte = 8 horizontal pixels, MSB = leftmost
  const bytesPerLine = width / 8;
  const bitmapData = new Uint8Array(bytesPerLine * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      const r = pixels[pixelIdx];
      const g = pixels[pixelIdx + 1];
      const b = pixels[pixelIdx + 2];
      
      // Luminance threshold (< 128 = black dot)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance < 128) {
        const byteIdx = y * bytesPerLine + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        bitmapData[byteIdx] |= (1 << bitIdx);
      }
    }
  }
  
  // Build GS v 0 command
  // Format: 1D 76 30 m xL xH yL yH [bitmap data]
  // m = 0 (normal mode)
  // xL xH = bytes per line (width / 8)
  // yL yH = number of lines (height)
  const xL = bytesPerLine & 0xFF;
  const xH = (bytesPerLine >> 8) & 0xFF;
  const yL = height & 0xFF;
  const yH = (height >> 8) & 0xFF;
  
  const header = new Uint8Array([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  
  // Combine header + bitmap data
  const full = new Uint8Array(header.length + bitmapData.length);
  full.set(header, 0);
  full.set(bitmapData, header.length);
  
  return [full];
}

/**
 * Helper to load an image as HTMLImageElement.
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar logo'));
    img.src = url;
  });
}
