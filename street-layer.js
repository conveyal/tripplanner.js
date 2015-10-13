import rbush from 'rbush'
import Edge from './edge'
import Vertex from './vertex'

const RTREE_LEAF_SIZE = 9

/** Represents the street layer of a TransportNetwork */
export default class StreetLayer {

	constructor (scaleFactor) {
		// TODO: we're using fixed-point lats/lons here, but this adds complexity and may not be any better than using
		// floating points since they're all the same type anyhow. Of course we may decide to use typed arrays, in which
		// case it does make sense to use fixed-point coordinates.
		this.scaleFactor = scaleFactor;
		this.lats = []
		this.lons = []

		// edge variables
		this.fromVertices = []
		this.toVertices = []
		this.lengthsMm = []
		this.speeds = []
		// TODO perhaps these should be GeoJSON so we can use turf? Or maybe memory is too valuable.
		this.geometries = []

		this.outgoing = new Map()
		this.incoming = new Map()
	}

    /** Add a vertex with the given fixed-point latitude and longitude, returning the vertex index */
	addVertexFixed (fixedLat, fixedLon) {
		let vidx = this.lats.length
		this.lats.push(fixedLat)
		this.lons.push(fixedLon)
		return vidx
	}

	/** add a vertex with the given latitude and longitude, returning the vertex index */
	addVertex (lat, lon) {
		return this.addVertexFixed(Math.round(lat * this.scaleFactor), Math.round(lon * this.scaleFactor))
	}

	// TODO does ES6/7 have native type parameters?
	addEdge (edge) {
		const eidx = this.fromVertices.length
		this.fromVertices.push(edge.fromVertex)
		this.toVertices.push(edge.toVertex)
		this.lengthsMm.push(edge.lengthMm)
		this.speeds.push(edge.speed)
		this.geometries.push(edge.geometry)

		if (!this.outgoing.has(edge.fromVertex))
			this.outgoing.set(edge.fromVertex, [])

		this.outgoing.get(edge.fromVertex).push(eidx)

		if (!this.incoming.has(edge.toVertex))
			this.incoming.set(edge.toVertex, [])

		this.incoming.get(edge.toVertex).push(eidx)

		return eidx
	}

	/** Build spatial index for edges */
	index () {
		console.log('building spatial index for edges')
		this.spatialIndex = rbush(RTREE_LEAF_SIZE)

		// nodes of the rtree
		let treeNodes = []

		let e = new Edge(this)

		for (let i = 0; i < this.fromVertices.length; i++) {
			e.seek(i)
			let bbox = e.getBbox()

			if (i == 0) console.log(`bbox: ${bbox}`)

			bbox.push(i)
			treeNodes.push(bbox)
		}

		console.log(`sp idx nodes: ${treeNodes.length}, node length: ${treeNodes[0].length}`)

		this.spatialIndex.load(treeNodes)

		console.log('done building spatial index')
	}

	/** find an edge near the specified location */
	findEdgeNear (lat, lon) {
		if (this.spatialIndex == null)
			this.index()

		console.log(`finding an edge near ${lat}, ${lon}`)

		let cosLat = Math.cos(lat * Math.PI / 180)

		// 10000000 m is distance from equator to pole (by definition, conveniently enough). Start with a 100m search radius
		// and expand.
		let stepLat = 90 / 10000000 * 50;

		// up the search 50 meters at a time, up to half a kilometer
		for (let radius = stepLat; radius < 90 / 10000 * 500; radius += stepLat) {
			// equirectangular projection
			let radiusLon = radius / cosLat;

			console.log(`search envelope: ${[lon - radiusLon, lat - radius, lon + radiusLon, lat + radius]}`)
			let result = this.spatialIndex.search([lon - radiusLon, lat - radius, lon + radiusLon, lat + radius])

			if (result.length > 0) {
				// yay we found (at least one) edge
				// TODO actually find closest edge now
				return result[0][4]
			}
		}
	}
}