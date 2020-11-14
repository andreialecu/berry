import {ZipConstants} from "./constants";

export class CentralDirectoryHeader {
  /** Number of entries on this volume */
  volumeEntries: number = 0;
  /** Total number of entries */
  totalEntries: number = 0;
  /** Central directory size in bytes */
  size: number = 0;
  /** Offset of first CEN header */
  offset: number = 0;
  /** Zip file comment length */
  commentLength: number = 0;
  /** Header starts here */
  headerOffset: number = 0;

  read(data: Buffer) {
    if (
      data.length != ZipConstants.ENDHDR ||
      data.readUInt32LE(0) != ZipConstants.ENDSIG
    )
      throw new Error(`Invalid central directory`);

    this.volumeEntries = data.readUInt16LE(ZipConstants.ENDSUB);
    this.totalEntries = data.readUInt16LE(ZipConstants.ENDTOT);
    this.size = data.readUInt32LE(ZipConstants.ENDSIZ);
    this.offset = data.readUInt32LE(ZipConstants.ENDOFF);
    this.commentLength = data.readUInt16LE(ZipConstants.ENDCOM);
  }
}
