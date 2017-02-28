/**
 * Created by kang on 2/1/16.
 */

var utils = require('./utils.js');
function Node(codon) {
    var visited = false;
    var previous = [];

    this.visit = function (codonOutputs) {
        if (!visited)
            return;
        visited = true;
        for (var i = 0; i < previous.length; i++) {
            previous[i].visit(codonOutputs);
        }

        codonOutputs.push(codon);
    };
}

module.exports = {
    sort: function (codonInputs) {//Array of Codons.
        // Step 1: create nodes for graph
        var nameToNodeDict = {};
        var allNodes = [];

        // create entries to preserve order within
        var previous = null;
        utils.each(codonInputs, function (codon) {
            var node = new Node(codon);
            var id = codon.id;
            if (!utils.isNullOrEmpty(id))
                nameToNodeDict[id] = node;

            //add implicit edges
            if (previous)
                node.previous.push(previous);

            allNodes.push(node);
            previous = node;
        });

        // Step 2: create edges from insertBefore/insertAfter values
        utils.each(allNodes, function (node) {
            if (!utils.isNullOrEmpty(node.codon.insertBefore)) {
                utils.each(node.codon.insertBefore.split(','), function (beforeReference) {
                    var referencedNode = nameToNodeDict[beforeReference];
                    if (referencedNode)
                        referencedNode.previous.push(node);
                    else
                        console.warn(utils.format("Codon ({0}) specified in the insertbefore of the {1} codon does not exist!", beforeReference, node.codon));
                });
            }

            if (!utils.isNullOrEmpty(node.codon.insertAfter)) {
                utils.each(node.codon.insertAfter.split(','), function (afterReference) {
                    var referencedNode = nameToNodeDict[afterReference];
                    if (referencedNode)
                        node.previous.push(referencedNode);
                    else
                        console.warn(utils.format("Codon ({0}) specified in the insertafter of the {1} codon does not exist!", afterReference, node.codon));
                });
            }
        });

        // Step 3: Perform Topological Sort
        var outputs = [];//Array of Codon objects.
        utils.each(allNodes, function (node) {
            node.visit(outputs);
        });

        return outputs;
    }
};