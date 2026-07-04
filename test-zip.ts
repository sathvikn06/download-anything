import { ZipArchive } from 'archiver';
const archive = new ZipArchive({ zlib: { level: 9 } });
console.log("Archive created:", typeof archive.append);
