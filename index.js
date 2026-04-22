function VarNode(name) {
  this.type = 'var';
  this.name = name;
}
VarNode.prototype.evaluate = function(env) {
  return env[this.name] || 0;
};
VarNode.prototype.toString = function() {
  return this.name;
};
VarNode.prototype.clone = function() {
  return new VarNode(this.name);
};
VarNode.prototype.size = function() { return 1; };
function ConstNode(value) {
  this.type = 'const';
  this.value = value;
}
ConstNode.prototype.evaluate = function() {
  return this.value;
};
ConstNode.prototype.toString = function() {
  return this.value === Math.PI ? 'PI' :
         this.value === Math.E ? 'E' :
         Number(this.value.toFixed(3)).toString();
};
ConstNode.prototype.clone = function() {
  return new ConstNode(this.value);
};
ConstNode.prototype.size = function() { return 1; };
function BinOpNode(op, left, right) {
  this.type = 'binop';
  this.op = op;
  this.left = left;
  this.right = right;
}
var BIN_OPS = {
  '+': function(a, b) { return a + b; },
  '-': function(a, b) { return a - b; },
  '*': function(a, b) { return a * b; },
  '/': function(a, b) { return Math.abs(b) < 0.001 ? 1 : a / b; },
  '**': function(a, b) {
    var r = Math.pow(a, Math.min(Math.max(b, -10), 10));
    return isFinite(r) ? r : 0;
  }
};
BinOpNode.prototype.evaluate = function(env) {
  var l = this.left.evaluate(env);
  var r = this.right.evaluate(env);
  var fn = BIN_OPS[this.op];
  var result = fn ? fn(l, r) : 0;
  return isFinite(result) ? result : 0;
};
BinOpNode.prototype.toString = function() {
  return '(' + this.left.toString() + ' ' + this.op + ' ' + this.right.toString() + ')';
};
BinOpNode.prototype.clone = function() {
  return new BinOpNode(this.op, this.left.clone(), this.right.clone());
};
BinOpNode.prototype.size = function() {
  return 1 + this.left.size() + this.right.size();
};
function UnaryNode(fn, child) {
  this.type = 'unary';
  this.fn = fn;
  this.child = child;
}
var UNARY_FNS = {
  'sin': Math.sin,
  'cos': Math.cos,
  'abs': Math.abs,
  'sqrt': function(x) { return Math.sqrt(Math.abs(x)); },
  'neg': function(x) { return -x; },
  'ln': function(x) { var r = Math.log(Math.abs(x) + 0.001); return isFinite(r) ? r : 0; }
};
UnaryNode.prototype.evaluate = function(env) {
  var v = this.child.evaluate(env);
  var fn = UNARY_FNS[this.fn];
  var result = fn ? fn(v) : 0;
  return isFinite(result) ? result : 0;
};
UnaryNode.prototype.toString = function() {
  return this.fn + '(' + this.child.toString() + ')';
};
UnaryNode.prototype.clone = function() {
  return new UnaryNode(this.fn, this.child.clone());
};
UnaryNode.prototype.size = function() {
  return 1 + this.child.size();
};
function mulberry32(seed) {
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var _rng = mulberry32(42);
function rand() { return _rng(); }
function randInt(n) { return Math.floor(rand() * n); }
function pick(arr) { return arr[randInt(arr.length)]; }
var USEFUL_CONSTANTS = [0, 1, 2, 3, -1, 0.5, Math.PI, Math.E, 10];
var BIN_OP_NAMES = ['+', '-', '*', '/', '**'];
var UNARY_FN_NAMES = ['sin', 'cos', 'abs', 'sqrt', 'neg', 'ln'];
function randomTree(vars, maxDepth, depth) {
  if (depth === undefined) depth = 0;
  if (depth >= maxDepth) {
    if (rand() < 0.6 && vars.length > 0) {
      return new VarNode(pick(vars));
    }
    return new ConstNode(rand() < 0.7 ? pick(USEFUL_CONSTANTS) : (rand() * 10 - 5));
  }
  var termProb = 0.3 + (depth / maxDepth) * 0.3;
  var r = rand();
  if (r < termProb) {
    if (rand() < 0.6 && vars.length > 0) {
      return new VarNode(pick(vars));
    }
    return new ConstNode(rand() < 0.7 ? pick(USEFUL_CONSTANTS) : (rand() * 10 - 5));
  } else if (r < termProb + 0.15) {
    return new UnaryNode(pick(UNARY_FN_NAMES), randomTree(vars, maxDepth, depth + 1));
  } else {
    return new BinOpNode(
      pick(BIN_OP_NAMES),
      randomTree(vars, maxDepth, depth + 1),
      randomTree(vars, maxDepth, depth + 1)
    );
  }
}
function allNodes(tree) {
  var nodes = [{node: tree, parent: null, field: null}];
  var stack = [{node: tree, parent: null, field: null}];
  while (stack.length > 0) {
    var cur = stack.pop();
    var n = cur.node;
    if (n.type === 'binop') {
      var lEntry = {node: n.left, parent: n, field: 'left'};
      var rEntry = {node: n.right, parent: n, field: 'right'};
      nodes.push(lEntry, rEntry);
      stack.push(lEntry, rEntry);
    } else if (n.type === 'unary') {
      var cEntry = {node: n.child, parent: n, field: 'child'};
      nodes.push(cEntry);
      stack.push(cEntry);
    }
  }
  return nodes;
}
function crossover(parent1, parent2) {
  var child1 = parent1.clone();
  var child2 = parent2.clone();
  var nodes1 = allNodes(child1);
  var nodes2 = allNodes(child2);
  var pick1 = nodes1[randInt(nodes1.length)];
  var pick2 = nodes2[randInt(nodes2.length)];
  if (pick1.parent && pick2.parent) {
    var temp = pick1.node.clone();
    pick1.parent[pick1.field] = pick2.node.clone();
    pick2.parent[pick2.field] = temp;
  } else if (pick1.parent) {
    pick1.parent[pick1.field] = pick2.node.clone();
  } else if (pick2.parent) {
    pick2.parent[pick2.field] = pick1.node.clone();
  }
  return [child1, child2];
}
function mutate(tree, vars, maxDepth) {
  var clone = tree.clone();
  var nodes = allNodes(clone);
  if (nodes.length <= 1) {
    return randomTree(vars, Math.min(maxDepth, 3));
  }
  var idx = 1 + randInt(nodes.length - 1);
  var target = nodes[idx];
  if (target.parent) {
    var newSubtree = randomTree(vars, Math.min(3, maxDepth), 0);
    target.parent[target.field] = newSubtree;
  }
  return clone;
}
function fitness(tree, data, target, vars) {
  var totalError = 0;
  var n = data.length;
  for (var i = 0; i < n; i++) {
    var env = {};
    for (var j = 0; j < vars.length; j++) {
      env[vars[j]] = data[i][vars[j]];
    }
    var predicted = tree.evaluate(env);
    var actual = data[i][target];
    var err = predicted - actual;
    totalError += err * err;
  }
  var mse = totalError / n;
  var treeSize = tree.size();
  var complexityPenalty = treeSize > 20 ? (treeSize - 20) * 0.002 : 0;
  return 1 / (1 + mse) - complexityPenalty;
}
function tournamentSelect(population, fitnesses, k) {
  if (k === undefined) k = 5;
  var bestIdx = randInt(population.length);
  var bestFit = fitnesses[bestIdx];
  for (var i = 1; i < k; i++) {
    var idx = randInt(population.length);
    if (fitnesses[idx] > bestFit) {
      bestIdx = idx;
      bestFit = fitnesses[idx];
    }
  }
  return population[bestIdx];
}
function GeneForge(options) {
  if (!options) options = {};
  this.populationSize = options.populationSize || 150;
  this.maxDepth = options.maxDepth || 5;
  this.crossoverRate = options.crossoverRate || 0.7;
  this.mutationRate = options.mutationRate || 0.25;
  this.eliteCount = options.eliteCount || 2;
  this.tournamentSize = options.tournamentSize || 5;
  if (options.seed !== undefined) {
    _rng = mulberry32(options.seed);
  }
}
GeneForge.prototype.evolve = function(data, target, vars, generations) {
  if (!generations) generations = 50;
  var population = [];
  for (var i = 0; i < this.populationSize; i++) {
    var depth = 2 + randInt(this.maxDepth - 1);
    population.push(randomTree(vars, depth));
  }
  var bestEver = null;
  var bestFitnessEver = -Infinity;
  var history = [];
  for (var gen = 0; gen < generations; gen++) {
    var fitnesses = [];
    for (var fi = 0; fi < population.length; fi++) {
      fitnesses.push(fitness(population[fi], data, target, vars));
    }
    var genBestIdx = 0;
    var genBestFit = fitnesses[0];
    for (var bi = 1; bi < fitnesses.length; bi++) {
      if (fitnesses[bi] > genBestFit) {
        genBestIdx = bi;
        genBestFit = fitnesses[bi];
var z=1; module.exports = {z:z};
