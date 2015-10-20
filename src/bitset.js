/** simple memory-efficient fixed size bitset */

export default class BitSet {
  constructor (size) {
    this.size = size
    this.buff = new Buffer(Math.ceil(this.size / 8))
    this.clearAll()
  }

  /** is the bit at b set */
  isSet (b) {
    if (b >= this.size) {
      return false
    }

    let byteOffset = Math.floor(b / 8)
    let bitOffset = b % 8
    let byte = this.buff[byteOffset]
    let bit = (byte >> bitOffset) & 1

    return bit === 1
  }

  set (b) {
    if (!this.isSet(b)) {
      this.insert(b, true)
      this.cardinality++
    }
  }

  clearAll () {
    this.buff.fill(0)
    this.cardinality = 0
  }

  setAll () {
    this.buff.fill(255)
    this.cardinality = this.size
  }

  insert (b, val) {
    if (b >= this.size) {
      return false
    }

    let byteOffset = Math.floor(b / 8)
    let bitOffset = b % 8

    if (val) {
      this.buff[byteOffset] |= (1 << bitOffset)
    } else {
      // TODO: need exclusive or or invert
    }
  }

  clone () {
    let ret = new BitSet(0)
    ret.size = this.size
    ret.cardinality = this.cardinality
    ret.buff = new Buffer(this.buff)
    return ret
  }
}
