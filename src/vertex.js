/** This does not actually represent a vertex but rather is a cursor into the parallel arrays */
export default class Vertex {
    constructor(sn, idx = 0) {
        this.idx = idx
        this.sn = sn
    }

    // TODO handle arrayindexoutofbounds
    seek (idx) {
        this.idx = idx;
    }

    next () {
        this.idx++
    }

    prev () {
        this.idx--
    }

    getLat () {
        return this.sn.lats[this.idx] / this.sn.scaleFactor
    }

    getLon () {
        return this.sn.lons[this.idx] / this.sn.scaleFactor
    }

    getOutgoing () {
        return this.sn.outgoing.get(this.idx)
    }

    getIncoming () {
        return this.sn.incoming.get(this.idx)
    }
}