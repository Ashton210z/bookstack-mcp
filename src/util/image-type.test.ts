import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectImageType,
  detectRejectedFormat,
  filenameFor,
  supportedExtensions,
} from './image-type.js';

const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string, pad = 0) =>
  Uint8Array.from([...new Array(pad).fill(0), ...[...s].map((c) => c.charCodeAt(0))]);

describe('detectImageType', () => {
  test('detects PNG', () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00);
    assert.deepEqual(detectImageType(png), { mime: 'image/png', ext: 'png' });
  });

  test('detects JPEG', () => {
    assert.deepEqual(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), {
      mime: 'image/jpeg',
      ext: 'jpg',
    });
  });

  test('detects GIF87a and GIF89a', () => {
    assert.equal(detectImageType(ascii('GIF87a....'))?.ext, 'gif');
    assert.equal(detectImageType(ascii('GIF89a....'))?.ext, 'gif');
  });

  test('detects WebP only when the WEBP tag follows RIFF', () => {
    const webp = Uint8Array.from([
      ...ascii('RIFF'), 0x10, 0x00, 0x00, 0x00, ...ascii('WEBP'),
    ]);
    assert.equal(detectImageType(webp)?.ext, 'webp');

    // RIFF container that is not WebP (e.g. WAV) must not match.
    const wav = Uint8Array.from([
      ...ascii('RIFF'), 0x10, 0x00, 0x00, 0x00, ...ascii('WAVE'),
    ]);
    assert.equal(detectImageType(wav), null);
  });

  test('detects AVIF via the ftyp brand', () => {
    const avif = Uint8Array.from([0, 0, 0, 0x20, ...ascii('ftyp'), ...ascii('avif')]);
    assert.equal(detectImageType(avif)?.ext, 'avif');
  });

  test('returns null for unknown bytes', () => {
    assert.equal(detectImageType(bytes(1, 2, 3, 4, 5, 6, 7, 8)), null);
  });

  test('returns null rather than throwing on a truncated buffer', () => {
    assert.equal(detectImageType(bytes(0x89, 0x50)), null);
    assert.equal(detectImageType(new Uint8Array(0)), null);
  });
});

describe('detectRejectedFormat', () => {
  test('names SVG', () => {
    assert.equal(detectRejectedFormat(ascii('<svg xmlns="http://www.w3.org/2000/svg">')), 'SVG');
  });

  test('names SVG behind an XML declaration', () => {
    const xml = ascii('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">');
    assert.equal(detectRejectedFormat(xml), 'SVG');
  });

  test('names PDF, BMP and TIFF', () => {
    assert.equal(detectRejectedFormat(ascii('%PDF-1.7')), 'PDF');
    assert.equal(detectRejectedFormat(bytes(0x42, 0x4d, 0x00)), 'BMP');
    assert.equal(detectRejectedFormat(bytes(0x49, 0x49, 0x2a, 0x00)), 'TIFF');
  });

  test('returns null for a supported format', () => {
    assert.equal(detectRejectedFormat(bytes(0xff, 0xd8, 0xff, 0xe0)), null);
  });

  test('does not throw on invalid UTF-8', () => {
    assert.equal(detectRejectedFormat(bytes(0xff, 0xfe, 0xfd, 0xfc)), null);
  });
});

describe('filenameFor', () => {
  const png = { mime: 'image/png', ext: 'png' };
  const jpg = { mime: 'image/jpeg', ext: 'jpg' };

  test('appends the extension when missing', () => {
    assert.equal(filenameFor('diagram', png), 'diagram.png');
  });

  test('leaves a correct extension alone', () => {
    assert.equal(filenameFor('diagram.png', png), 'diagram.png');
  });

  test('is case-insensitive about the existing extension', () => {
    assert.equal(filenameFor('diagram.PNG', png), 'diagram.PNG');
  });

  test('accepts .jpeg as an alias of .jpg', () => {
    assert.equal(filenameFor('photo.jpeg', jpg), 'photo.jpeg');
    assert.equal(filenameFor('photo.jpg', jpg), 'photo.jpg');
  });

  test('appends when the existing extension is for a different format', () => {
    assert.equal(filenameFor('diagram.gif', png), 'diagram.gif.png');
  });
});

describe('supportedExtensions', () => {
  test('lists every accepted extension', () => {
    assert.equal(supportedExtensions(), 'jpg, png, gif, webp, avif');
  });
});
