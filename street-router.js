import PriorityQueue from 'priorityqueuejs'
import Vertex from './vertex'
import Edge from './edge'

/**
 * Route on streets, simple Dijkstra algorithm.
 */

export default class StreetRouter {
    constructor (tn) {
        this.tn = tn
    }

    /** call either as setOrigin (vertex) or setOrigin(lat, lon) */
    setOrigin (vertex, lon = null) {
        if (lon == null)
            this.origin = vertex
        else {
            // vertex is actually lat
            let eidx = this.tn.streetLayer.findEdgeNear(vertex, lon)

            if (eidx !== undefined) {
                let e = new Edge(this.tn.streetLayer, eidx)
                // TODO enqueue two states one at the from vertex and one at the to
                this.origin = e.getFromVertex()
            }
        }
    }

    /** call either as setDestination (vertex) or setDestination (lat, lon) */
    setDestination (vertex, lon = null) {
        if (lon == null)
            this.destination = vertex
        else {
            // vertex is actually lat
            let eidx = this.tn.streetLayer.findEdgeNear(vertex, lon)

            if (eidx !== undefined) {
                let e = new Edge(this.tn.streetLayer, eidx)
                // TODO enqueue two states one at the from vertex and one at the to
                this.destination = e.getFromVertex()
            }
        }
    }

    route () {
        let pq = new PriorityQueue((a, b) => b.dist - a.dist)
        let v = new Vertex(this.tn.streetLayer)
        let e = new Edge(this.tn.streetLayer)
        pq.enq({v: this.origin, dist: 0})

        this.best = new Map()

        while (!pq.isEmpty()) {
            let state = pq.deq()

            // state is dominated
            if (this.best.has(state.v))
                continue;

            this.best.set(state.v, state.dist)

            // we have reached the destination, and any other way to reach the destination is still on the priority queue
            // and has a higher weight
            if (this.destination !== undefined && state.v == this.destination) {
                this.state = state
                break;
            }

            v.seek(state.v)

            let outgoing = v.getOutgoing()

            if (outgoing == undefined)
                continue;

            outgoing.forEach(eidx => {
                e.seek(eidx)
                pq.enq({v: e.getToVertex(), dist: state.dist + e.getLength() / 1000, back: state, backEdge: eidx})
            })
        }
    }

    getPath () {
        // reconstruct the path as GeoJSON
        let state = this.state
        let coords = []
        let e = new Edge(this.tn.streetLayer)

       while (state !== undefined && state.backEdge !== undefined) {
           e.seek(state.backEdge)
           e.getGeometry().coordinates.reverse().forEach(c => coords.push(c))
           state = state.back
        }
        coords.reverse()

        return {
            type: "LineString",
            coordinates: coords
        }
    }
}


