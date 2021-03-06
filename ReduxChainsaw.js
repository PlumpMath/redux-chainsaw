import _ from 'lodash';

// wraps action creator and overrides type.
// TODO: handle thunk
// TODO: do we want to override type like this?
// function generateActionCreator(creator, typeName) {
//   return function(eventInfo) {
//     let action = {};
//     action = creator(eventInfo);
//     action.type = typeName;
//     return action;
//   };
// }

// recursive function for walking through and wrapping action creators
function generateLevel(ele, name, path) {
  if (_.isFunction(ele)) {
    let typeName = path.concat(name).join('.');
    return ele;
  } else {
    return _.reduce(ele, (acc, childEle, childName) => {
      acc[childName] = generateLevel(childEle, childName, path.concat(name));
      return acc;
    }, {});
  }
}

export function createActionCreators(actionTree) {
  return _.reduce(actionTree, function (acc, ele, name) {
    acc[name] = generateLevel(ele, name, []);
    return acc;
  }, {});
}

// console.log(ActionCreators);

// lookup action creator function in tree

export function lookupActionCreator(tree, path) {
  let walkPath = path.split('.');
  let actionCreator;
  let pathIdx = 1;
  while (!actionCreator && pathIdx <= walkPath.length) {
    let node = _.get(tree, walkPath.slice(0, pathIdx));

    if (node && _.isFunction(node)) {
      actionCreator = node;
      break;
    } else if (pathIdx === walkPath.length) {
      return node.default;
    } else if (!node) {
      let root = _.get(tree, walkPath.slice(0, pathIdx - 1));
      actionCreator = _.isFunction(root) ? root : _.get(root, ['default']);
      break;
    }
    pathIdx++;
  }
  // TODO: error or warning if none found
  // let root = _.get(tree, path);
  // return (_.isFunction(root) ? root : _.get(tree, `${path}.default`));
  if (actionCreator) {
    return function() {
      let action = actionCreator(...arguments);
      action.type = path;
      return action;
    };
  } else {
    return null;
  }
}


// Looks for first function when traversing a tree, uses default of current level if nothing found at node
function getReducer(tree, fullPath, depth=1) {
  let deepest = fullPath.length;
  let depthPath = fullPath.slice(0, depth);
  let found = _.get(tree, depthPath.join('.'));

  if (!found) {
    let foundDepth = depth - 1;
    let rootPath = fullPath.slice(0, foundDepth);
    return [
      _.get(tree, rootPath.concat('default').join('.')),
      foundDepth
    ];
  } else if (found && _.isFunction(found)) {
    return [
      found,
      depth
    ];
  } else if (found && depth == deepest) {
    // error if remainder is empty
    return [
      _.get(tree, depthPath.concat('default').join('.')),
      depth
    ];
  } else if (depth >= deepest) {
    // throw error or warning
    // looked for reducer, but nothing left to look for
    return [null, null];
  } else {
    return getReducer(tree, fullPath, depth + 1);
  }
}

export function createObjectWithPath(path, value) {
  let valueObj = {[path[path.length - 1]]: value};
  return _.reduce(path.slice(0, path.length - 1).reverse(), (acc, name) => {
    return {[name]: acc};
  }, valueObj);
}

function defaultUpdateState(state, statePath, reduced) {
  return _.merge({}, state || {}, createObjectWithPath(statePath, reduced));
}

export function combineReducerFromTree(tree, updateStateFn=defaultUpdateState) {
  return function(state, action) {
    let typePath = action.type.split('.');
    let [reducer, depth] = getReducer(tree, typePath);

    if (reducer) {
      let remainder = typePath.slice(depth, typePath.length).join('.');
      action.type = remainder;
      let statePath = typePath.slice(0, depth); // everything that comes before remainder
      let reduced = reducer(_.get(state, statePath), action);
      return updateStateFn(state, statePath, reduced);
    } else {
      return state;
    }
  };
}
