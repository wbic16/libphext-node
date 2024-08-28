export class Phext {
	constructor(subspace) {
		this.subspace = subspace;
		this.state = 'unparsed';
	}
	parse = () => {
		console.log("Parsing phext!");
		if (this.subspace.length > 0) {
			console.log(`parsing ${this.subspace.length} bytes`);
			this.state = 'parsing';
		} else {
			console.log("Nothing to parse.");
		}
	};
	status = () => {
		console.log(`Length: ${this.subspace.length}`);
		console.log(`state: ${this.state}`);
	};
}