import StreetLayer from './street-layer'
//import TransitLayer from 'transit-layer'
import fs from 'fs'
import DataInputStream from './data-input-stream'

/**
 * Represents a TransportNetwork, very similar to the same-named class in OTP
 */
 export default class TransportNetwork {
 	static read (fd) {
		let buf = new DataInputStream(fd)

 		let tn = new TransportNetwork()

 		// read the header
 		let header = [] // byte array
 		let byte;
 		// readUint8BE - also know as read byte
 		//while ((byte = buf.readByte()) != 0)
 		//	header.push(byte)

		console.log(header)

 		console.log('reading street layer')
 		// read vertices
 		let fixedFactor = buf.readDouble()
 		tn.streetLayer = new StreetLayer(fixedFactor)

 		let nVertices = buf.readInt()

 		console.log(`reading ${nVertices} vertices`)

 		for (let i = 0; i < nVertices; i++) {
 			if (i % 100000 == 0)
 				console.log(`${i} vertices...`)

 			let lat = buf.readInt()
 			let lon = buf.readInt()
			if (i > nVertices - 100)
				console.log(lat, lon)
 			tn.streetLayer.addVertexFixed(lat, lon)
 		}

 		console.log('reading edges')

		let nEdges = buf.readInt()

        console.log(`reading ${nEdges} edges`)
        for (let i = 0; i < nEdges; i++) {
            if (i % 100000 == 0)
                console.log(`${i} edges...`)

            let edge = {}

            edge.fromVertex = buf.readInt()
            edge.lengthMm = buf.readInt()
            edge.toVertex = buf.readInt()
            edge.speed = buf.readInt()
            edge.flags = buf.readInt()

            // this is the count of the number of coordinates, not the number of coordinate pairs
            let geomSize = buf.readInt()

            edge.geometry = []

            for (let c = 0; c < geomSize; c++) {
                edge.geometry.push(buf.readInt())
            }

			tn.streetLayer.addEdge(edge)
		}

        console.log('street network read')

 		//tn.transitLayer = new TransitLayer()

 		return tn
 	}
 }
