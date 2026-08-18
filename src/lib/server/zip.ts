/**
 * A ZIP writer that streams, with no dependency.
 *
 * The admin photo export packs hundreds of catalogue photos into one download.
 * Buffering that archive in memory before answering would put a few hundred
 * megabytes on the heap of a serverless function that has far less; so entries
 * go out as they are produced and only one photo is held at a time.
 *
 * Two consequences shape what is here.
 *
 *   Nothing is compressed. Every entry is stored (method 0) because JPEG, PNG
 *   and WebP are already compressed — deflate would spend CPU to save a percent.
 *   Storing also means the sizes are known before the header is written, so no
 *   entry needs a data descriptor and the archive stays readable by everything.
 *
 *   Sizes and offsets are 32-bit. That is plain ZIP, not ZIP64, which caps an
 *   archive at 4 GB and 65535 entries — see MAX_* below. Callers are expected to
 *   stop well before that and say so in their own words; the guard here only
 *   makes sure a caller that doesn't produces a short archive rather than a
 *   corrupt one.
 */

export interface ZipEntry {
  /** Path inside the archive, '/'-separated. Encoded as UTF-8. */
  name: string;
  data: Buffer;
  /** Modification time recorded for the entry. Defaults to now. */
  date?: Date;
}

/**
 * Ceilings this writer cannot cross without ZIP64. Both are far above what an
 * export should reach — they exist so the caller can budget below them.
 */
export const MAX_ZIP_ENTRIES = 0xffff;
export const MAX_ZIP_BYTES = 0xffffffff;

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

/** Store, no encryption, UTF-8 file names (bit 11). */
const METHOD_STORE = 0;
const FLAG_UTF8 = 0x0800;
const VERSION_NEEDED = 20;
/** Made by Unix (3) / ZIP 3.0, which is what makes the permission bits below meaningful. */
const VERSION_MADE_BY = 0x031e;
/** Regular file, 0644, in the high half of the external attributes. */
const EXTERNAL_ATTRS = (0o100644 << 16) >>> 0;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * MS-DOS packed time and date, the only clock a ZIP header has: two-second
 * resolution and no year before 1980, both clamped rather than wrapped.
 */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

interface EntryMeta {
  name: Buffer;
  crc: number;
  size: number;
  time: number;
  date: number;
  offset: number;
}

function localHeader(meta: EntryMeta): Buffer {
  const head = Buffer.alloc(30);
  head.writeUInt32LE(LOCAL_SIG, 0);
  head.writeUInt16LE(VERSION_NEEDED, 4);
  head.writeUInt16LE(FLAG_UTF8, 6);
  head.writeUInt16LE(METHOD_STORE, 8);
  head.writeUInt16LE(meta.time, 10);
  head.writeUInt16LE(meta.date, 12);
  head.writeUInt32LE(meta.crc, 14);
  head.writeUInt32LE(meta.size, 18); // compressed == uncompressed when stored
  head.writeUInt32LE(meta.size, 22);
  head.writeUInt16LE(meta.name.length, 26);
  head.writeUInt16LE(0, 28); // no extra field
  return head;
}

function centralHeader(meta: EntryMeta): Buffer {
  const head = Buffer.alloc(46);
  head.writeUInt32LE(CENTRAL_SIG, 0);
  head.writeUInt16LE(VERSION_MADE_BY, 4);
  head.writeUInt16LE(VERSION_NEEDED, 6);
  head.writeUInt16LE(FLAG_UTF8, 8);
  head.writeUInt16LE(METHOD_STORE, 10);
  head.writeUInt16LE(meta.time, 12);
  head.writeUInt16LE(meta.date, 14);
  head.writeUInt32LE(meta.crc, 16);
  head.writeUInt32LE(meta.size, 20);
  head.writeUInt32LE(meta.size, 24);
  head.writeUInt16LE(meta.name.length, 28);
  head.writeUInt16LE(0, 30); // extra
  head.writeUInt16LE(0, 32); // comment
  head.writeUInt16LE(0, 34); // disk number start
  head.writeUInt16LE(0, 36); // internal attributes
  head.writeUInt32LE(EXTERNAL_ATTRS, 38);
  head.writeUInt32LE(meta.offset, 42);
  return head;
}

function endOfCentralDirectory(count: number, size: number, offset: number): Buffer {
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4); // this disk
  eocd.writeUInt16LE(0, 6); // disk holding the central directory
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(size, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // no archive comment
  return eocd;
}

async function* zipChunks(entries: AsyncIterable<ZipEntry>): AsyncGenerator<Buffer> {
  const directory: Buffer[] = [];
  let count = 0;
  let offset = 0;
  let centralBytes = 0;

  for await (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const { data } = entry;
    const localBytes = 30 + name.length + data.length;
    const recordBytes = 46 + name.length;
    // Past either ceiling the offsets stop fitting in their fields, and an
    // archive that lies about them is worse than one that ends early.
    if (count >= MAX_ZIP_ENTRIES) break;
    if (offset + localBytes + centralBytes + recordBytes + 22 > MAX_ZIP_BYTES) break;

    const { time, date } = dosDateTime(entry.date ?? new Date());
    const meta: EntryMeta = { name, crc: crc32(data), size: data.length, time, date, offset };

    yield localHeader(meta);
    yield name;
    yield data;

    directory.push(centralHeader(meta), name);
    count += 1;
    offset += localBytes;
    centralBytes += recordBytes;
  }

  const central = Buffer.concat(directory);
  yield central;
  yield endOfCentralDirectory(count, centralBytes, offset);
}

/**
 * Pack the entries into a ZIP as a web stream, pulling one entry at a time.
 *
 * The generator is only advanced when the consumer asks for the next chunk, so
 * a caller whose entries are downloads gets backpressure for free: it never
 * runs further ahead of the socket than one photo.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const chunks = zipChunks(entries)[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await chunks.next();
      if (done) controller.close();
      else controller.enqueue(new Uint8Array(value));
    },
    cancel() {
      // The browser hung up mid-download: let the producer's `finally` blocks run
      // so nothing is left fetching photos into an archive nobody will read.
      void chunks.return?.(undefined);
    },
  });
}
