/** Represent the transit portion of a Transport Network */

export default class TransitLayer {
	constructor () {
		this.patterns = []
		this.patternsForStop = []
		this.transfersForStop = []
		this.stopVertexForStop = []

	}

	addPattern (patt) {
		this.patterns.push(patt)
	}
}
