import Vertex from './vertex'
/**
 * Created by matthewc on 10/12/15.
 */

/** This does not actually represent an edge but rather is a cursor into the parallel arrays */
export default class Edge {
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

    getToVertex () {
        return this.sn.toVertices[this.idx]
    }

    getFromVertex () {
        return this.sn.fromVertices[this.idx]
    }

    getLength () {
        return this.sn.lengthsMm[this.idx]
    }

    getGeometry () {
        let coords = []
        let v = new Vertex(this.sn)

        v.seek(this.getFromVertex())
        coords.push([v.getLon(), v.getLat()])

        // loop two at a time, the geometries are packed
        if (this.sn.geometries[this.idx] !== undefined) {
            for (let i = 0; i < this.sn.geometries[this.idx].length; i += 2) {
                // lat, lon -> lon, lat
                coords.push([this.sn.geometries[this.idx][i + 1] / this.sn.scaleFactor, this.sn.geometries[this.idx][i] / this.sn.scaleFactor])
            }
        }

        v.seek(this.getToVertex())
        coords.push([v.getLon(), v.getLat()])

        return {
            type: 'LineString',
            coordinates: coords
        }
    }

    getBbox () {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

        let coords  = this.getGeometry().coordinates
        coords.forEach(c => {
            minX = Math.min(minX, c[0])
            maxX = Math.max(maxX, c[0])
            minY = Math.min(minY, c[1])
            maxY = Math.max(maxY, c[1])
        })

        return [minX, minY, maxX, maxY]
    }
}