import fs from 'fs'

/** mimics Java's DataInputStream */
const CHUNK_SIZE = 64 * 1024;

export default class DataInputStream {
    constructor (fd) {
        this.fd = fd
        this.offsetInBuffer = 0
        this.buffer = new Buffer(CHUNK_SIZE)
        this.bufLength = fs.readSync(this.fd, this.buffer, 0, CHUNK_SIZE, 0)

        // the offset in the file is not updated until we read the next chunk.
        this.offsetInFile = 0
    }

    ensureBytesAvailable(count) {
        if (this.offsetInBuffer + count > this.bufLength) {
            // need to read more data. We re-read the data we have not consumed.
            this.offsetInFile += this.offsetInBuffer;
            this.bufLength = fs.readSync(this.fd, this.buffer, 0, CHUNK_SIZE, this.offsetInFile)
            this.offsetInBuffer = 0
            // TODO handle eof
        }
    }

    readByte () {
        this.ensureBytesAvailable(1)
        return this.buffer.readInt8(this.offsetInBuffer++)
    }

    readInt () {
        this.ensureBytesAvailable(4)
        let int = this.buffer.readInt32BE(this.offsetInBuffer)
        this.offsetInBuffer += 4
        return int
    }

    readDouble () {
        this.ensureBytesAvailable(8)
        let dbl = this.buffer.readDoubleBE()
        this.offsetInBuffer += 8
        return dbl
    }
}