var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/common/dist/index.cjs
var require_dist = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/common/dist/index.cjs"(exports2) {
    "use strict";
    var DefaultBufferLength = 1024;
    var nextPropID = 0;
    var Range = class {
      constructor(from, to) {
        this.from = from;
        this.to = to;
      }
    };
    var NodeProp = class {
      /**
      Create a new node prop type.
      */
      constructor(config = {}) {
        this.id = nextPropID++;
        this.perNode = !!config.perNode;
        this.deserialize = config.deserialize || (() => {
          throw new Error("This node type doesn't define a deserialize function");
        });
        this.combine = config.combine || null;
      }
      /**
      This is meant to be used with
      [`NodeSet.extend`](#common.NodeSet.extend) or
      [`LRParser.configure`](#lr.ParserConfig.props) to compute
      prop values for each node type in the set. Takes a [match
      object](#common.NodeType^match) or function that returns undefined
      if the node type doesn't get this prop, and the prop's value if
      it does.
      */
      add(match) {
        if (this.perNode)
          throw new RangeError("Can't add per-node props to node types");
        if (typeof match != "function")
          match = NodeType.match(match);
        return (type) => {
          let result = match(type);
          return result === void 0 ? null : [this, result];
        };
      }
    };
    NodeProp.closedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
    NodeProp.openedBy = new NodeProp({ deserialize: (str) => str.split(" ") });
    NodeProp.group = new NodeProp({ deserialize: (str) => str.split(" ") });
    NodeProp.isolate = new NodeProp({ deserialize: (value) => {
      if (value && value != "rtl" && value != "ltr" && value != "auto")
        throw new RangeError("Invalid value for isolate: " + value);
      return value || "auto";
    } });
    NodeProp.contextHash = new NodeProp({ perNode: true });
    NodeProp.lookAhead = new NodeProp({ perNode: true });
    NodeProp.mounted = new NodeProp({ perNode: true });
    var MountedTree = class {
      constructor(tree, overlay, parser, bracketed = false) {
        this.tree = tree;
        this.overlay = overlay;
        this.parser = parser;
        this.bracketed = bracketed;
      }
      /**
      @internal
      */
      static get(tree) {
        return tree && tree.props && tree.props[NodeProp.mounted.id];
      }
    };
    var noProps = /* @__PURE__ */ Object.create(null);
    var NodeType = class _NodeType {
      /**
      @internal
      */
      constructor(name, props, id, flags = 0) {
        this.name = name;
        this.props = props;
        this.id = id;
        this.flags = flags;
      }
      /**
      Define a node type.
      */
      static define(spec) {
        let props = spec.props && spec.props.length ? /* @__PURE__ */ Object.create(null) : noProps;
        let flags = (spec.top ? 1 : 0) | (spec.skipped ? 2 : 0) | (spec.error ? 4 : 0) | (spec.name == null ? 8 : 0);
        let type = new _NodeType(spec.name || "", props, spec.id, flags);
        if (spec.props)
          for (let src of spec.props) {
            if (!Array.isArray(src))
              src = src(type);
            if (src) {
              if (src[0].perNode)
                throw new RangeError("Can't store a per-node prop on a node type");
              props[src[0].id] = src[1];
            }
          }
        return type;
      }
      /**
      Retrieves a node prop for this type. Will return `undefined` if
      the prop isn't present on this node.
      */
      prop(prop) {
        return this.props[prop.id];
      }
      /**
      True when this is the top node of a grammar.
      */
      get isTop() {
        return (this.flags & 1) > 0;
      }
      /**
      True when this node is produced by a skip rule.
      */
      get isSkipped() {
        return (this.flags & 2) > 0;
      }
      /**
      Indicates whether this is an error node.
      */
      get isError() {
        return (this.flags & 4) > 0;
      }
      /**
      When true, this node type doesn't correspond to a user-declared
      named node, for example because it is used to cache repetition.
      */
      get isAnonymous() {
        return (this.flags & 8) > 0;
      }
      /**
      Returns true when this node's name or one of its
      [groups](#common.NodeProp^group) matches the given string.
      */
      is(name) {
        if (typeof name == "string") {
          if (this.name == name)
            return true;
          let group = this.prop(NodeProp.group);
          return group ? group.indexOf(name) > -1 : false;
        }
        return this.id == name;
      }
      /**
      Create a function from node types to arbitrary values by
      specifying an object whose property names are node or
      [group](#common.NodeProp^group) names. Often useful with
      [`NodeProp.add`](#common.NodeProp.add). You can put multiple
      names, separated by spaces, in a single property name to map
      multiple node names to a single value.
      */
      static match(map) {
        let direct = /* @__PURE__ */ Object.create(null);
        for (let prop in map)
          for (let name of prop.split(" "))
            direct[name] = map[prop];
        return (node) => {
          for (let groups = node.prop(NodeProp.group), i = -1; i < (groups ? groups.length : 0); i++) {
            let found = direct[i < 0 ? node.name : groups[i]];
            if (found)
              return found;
          }
        };
      }
    };
    NodeType.none = new NodeType(
      "",
      /* @__PURE__ */ Object.create(null),
      0,
      8
      /* NodeFlag.Anonymous */
    );
    var NodeSet = class _NodeSet {
      /**
      Create a set with the given types. The `id` property of each
      type should correspond to its position within the array.
      */
      constructor(types) {
        this.types = types;
        for (let i = 0; i < types.length; i++)
          if (types[i].id != i)
            throw new RangeError("Node type ids should correspond to array positions when creating a node set");
      }
      /**
      Create a copy of this set with some node properties added. The
      arguments to this method can be created with
      [`NodeProp.add`](#common.NodeProp.add).
      */
      extend(...props) {
        let newTypes = [];
        for (let type of this.types) {
          let newProps = null;
          for (let source of props) {
            let add = source(type);
            if (add) {
              if (!newProps)
                newProps = Object.assign({}, type.props);
              let value = add[1], prop = add[0];
              if (prop.combine && prop.id in newProps)
                value = prop.combine(newProps[prop.id], value);
              newProps[prop.id] = value;
            }
          }
          newTypes.push(newProps ? new NodeType(type.name, newProps, type.id, type.flags) : type);
        }
        return new _NodeSet(newTypes);
      }
    };
    var CachedNode = /* @__PURE__ */ new WeakMap();
    var CachedInnerNode = /* @__PURE__ */ new WeakMap();
    exports2.IterMode = void 0;
    (function(IterMode) {
      IterMode[IterMode["ExcludeBuffers"] = 1] = "ExcludeBuffers";
      IterMode[IterMode["IncludeAnonymous"] = 2] = "IncludeAnonymous";
      IterMode[IterMode["IgnoreMounts"] = 4] = "IgnoreMounts";
      IterMode[IterMode["IgnoreOverlays"] = 8] = "IgnoreOverlays";
      IterMode[IterMode["EnterBracketed"] = 16] = "EnterBracketed";
    })(exports2.IterMode || (exports2.IterMode = {}));
    var Tree = class _Tree {
      /**
      Construct a new tree. See also [`Tree.build`](#common.Tree^build).
      */
      constructor(type, children, positions, length, props) {
        this.type = type;
        this.children = children;
        this.positions = positions;
        this.length = length;
        this.props = null;
        if (props && props.length) {
          this.props = /* @__PURE__ */ Object.create(null);
          for (let [prop, value] of props)
            this.props[typeof prop == "number" ? prop : prop.id] = value;
        }
      }
      /**
      @internal
      */
      toString() {
        let mounted = MountedTree.get(this);
        if (mounted && !mounted.overlay)
          return mounted.tree.toString();
        let children = "";
        for (let ch of this.children) {
          let str = ch.toString();
          if (str) {
            if (children)
              children += ",";
            children += str;
          }
        }
        return !this.type.name ? children : (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (children.length ? "(" + children + ")" : "");
      }
      /**
      Get a [tree cursor](#common.TreeCursor) positioned at the top of
      the tree. Mode can be used to [control](#common.IterMode) which
      nodes the cursor visits.
      */
      cursor(mode = 0) {
        return new TreeCursor(this.topNode, mode);
      }
      /**
      Get a [tree cursor](#common.TreeCursor) pointing into this tree
      at the given position and side (see
      [`moveTo`](#common.TreeCursor.moveTo).
      */
      cursorAt(pos, side = 0, mode = 0) {
        let scope = CachedNode.get(this) || this.topNode;
        let cursor = new TreeCursor(scope);
        cursor.moveTo(pos, side);
        CachedNode.set(this, cursor._tree);
        return cursor;
      }
      /**
      Get a [syntax node](#common.SyntaxNode) object for the top of the
      tree.
      */
      get topNode() {
        return new TreeNode(this, 0, 0, null);
      }
      /**
      Get the [syntax node](#common.SyntaxNode) at the given position.
      If `side` is -1, this will move into nodes that end at the
      position. If 1, it'll move into nodes that start at the
      position. With 0, it'll only enter nodes that cover the position
      from both sides.
      
      Note that this will not enter
      [overlays](#common.MountedTree.overlay), and you often want
      [`resolveInner`](#common.Tree.resolveInner) instead.
      */
      resolve(pos, side = 0) {
        let node = resolveNode(CachedNode.get(this) || this.topNode, pos, side, false);
        CachedNode.set(this, node);
        return node;
      }
      /**
      Like [`resolve`](#common.Tree.resolve), but will enter
      [overlaid](#common.MountedTree.overlay) nodes, producing a syntax node
      pointing into the innermost overlaid tree at the given position
      (with parent links going through all parent structure, including
      the host trees).
      */
      resolveInner(pos, side = 0) {
        let node = resolveNode(CachedInnerNode.get(this) || this.topNode, pos, side, true);
        CachedInnerNode.set(this, node);
        return node;
      }
      /**
      In some situations, it can be useful to iterate through all
      nodes around a position, including those in overlays that don't
      directly cover the position. This method gives you an iterator
      that will produce all nodes, from small to big, around the given
      position.
      */
      resolveStack(pos, side = 0) {
        return stackIterator(this, pos, side);
      }
      /**
      Iterate over the tree and its children, calling `enter` for any
      node that touches the `from`/`to` region (if given) before
      running over such a node's children, and `leave` (if given) when
      leaving the node. When `enter` returns `false`, that node will
      not have its children iterated over (or `leave` called).
      */
      iterate(spec) {
        let { enter, leave, from = 0, to = this.length } = spec;
        let mode = spec.mode || 0, anon = (mode & exports2.IterMode.IncludeAnonymous) > 0;
        for (let c = this.cursor(mode | exports2.IterMode.IncludeAnonymous); ; ) {
          let entered = false;
          if (c.from <= to && c.to >= from && (!anon && c.type.isAnonymous || enter(c) !== false)) {
            if (c.firstChild())
              continue;
            entered = true;
          }
          for (; ; ) {
            if (entered && leave && (anon || !c.type.isAnonymous))
              leave(c);
            if (c.nextSibling())
              break;
            if (!c.parent())
              return;
            entered = true;
          }
        }
      }
      /**
      Get the value of the given [node prop](#common.NodeProp) for this
      node. Works with both per-node and per-type props.
      */
      prop(prop) {
        return !prop.perNode ? this.type.prop(prop) : this.props ? this.props[prop.id] : void 0;
      }
      /**
      Returns the node's [per-node props](#common.NodeProp.perNode) in a
      format that can be passed to the [`Tree`](#common.Tree)
      constructor.
      */
      get propValues() {
        let result = [];
        if (this.props)
          for (let id in this.props)
            result.push([+id, this.props[id]]);
        return result;
      }
      /**
      Balance the direct children of this tree, producing a copy of
      which may have children grouped into subtrees with type
      [`NodeType.none`](#common.NodeType^none).
      */
      balance(config = {}) {
        return this.children.length <= 8 ? this : balanceRange(NodeType.none, this.children, this.positions, 0, this.children.length, 0, this.length, (children, positions, length) => new _Tree(this.type, children, positions, length, this.propValues), config.makeTree || ((children, positions, length) => new _Tree(NodeType.none, children, positions, length)));
      }
      /**
      Build a tree from a postfix-ordered buffer of node information,
      or a cursor over such a buffer.
      */
      static build(data) {
        return buildTree(data);
      }
    };
    Tree.empty = new Tree(NodeType.none, [], [], 0);
    var FlatBufferCursor = class _FlatBufferCursor {
      constructor(buffer, index) {
        this.buffer = buffer;
        this.index = index;
      }
      get id() {
        return this.buffer[this.index - 4];
      }
      get start() {
        return this.buffer[this.index - 3];
      }
      get end() {
        return this.buffer[this.index - 2];
      }
      get size() {
        return this.buffer[this.index - 1];
      }
      get pos() {
        return this.index;
      }
      next() {
        this.index -= 4;
      }
      fork() {
        return new _FlatBufferCursor(this.buffer, this.index);
      }
    };
    var TreeBuffer = class _TreeBuffer {
      /**
      Create a tree buffer.
      */
      constructor(buffer, length, set) {
        this.buffer = buffer;
        this.length = length;
        this.set = set;
      }
      /**
      @internal
      */
      get type() {
        return NodeType.none;
      }
      /**
      @internal
      */
      toString() {
        let result = [];
        for (let index = 0; index < this.buffer.length; ) {
          result.push(this.childString(index));
          index = this.buffer[index + 3];
        }
        return result.join(",");
      }
      /**
      @internal
      */
      childString(index) {
        let id = this.buffer[index], endIndex = this.buffer[index + 3];
        let type = this.set.types[id], result = type.name;
        if (/\W/.test(result) && !type.isError)
          result = JSON.stringify(result);
        index += 4;
        if (endIndex == index)
          return result;
        let children = [];
        while (index < endIndex) {
          children.push(this.childString(index));
          index = this.buffer[index + 3];
        }
        return result + "(" + children.join(",") + ")";
      }
      /**
      @internal
      */
      findChild(startIndex, endIndex, dir, pos, side) {
        let { buffer } = this, pick = -1;
        for (let i = startIndex; i != endIndex; i = buffer[i + 3]) {
          if (checkSide(side, pos, buffer[i + 1], buffer[i + 2])) {
            pick = i;
            if (dir > 0)
              break;
          }
        }
        return pick;
      }
      /**
      @internal
      */
      slice(startI, endI, from) {
        let b = this.buffer;
        let copy = new Uint16Array(endI - startI), len = 0;
        for (let i = startI, j = 0; i < endI; ) {
          copy[j++] = b[i++];
          copy[j++] = b[i++] - from;
          let to = copy[j++] = b[i++] - from;
          copy[j++] = b[i++] - startI;
          len = Math.max(len, to);
        }
        return new _TreeBuffer(copy, len, this.set);
      }
    };
    function checkSide(side, pos, from, to) {
      switch (side) {
        case -2:
          return from < pos;
        case -1:
          return to >= pos && from < pos;
        case 0:
          return from < pos && to > pos;
        case 1:
          return from <= pos && to > pos;
        case 2:
          return to > pos;
        case 4:
          return true;
      }
    }
    function resolveNode(node, pos, side, overlays) {
      var _a;
      while (node.from == node.to || (side < 1 ? node.from >= pos : node.from > pos) || (side > -1 ? node.to <= pos : node.to < pos)) {
        let parent = !overlays && node instanceof TreeNode && node.index < 0 ? null : node.parent;
        if (!parent)
          return node;
        node = parent;
      }
      let mode = overlays ? 0 : exports2.IterMode.IgnoreOverlays;
      if (overlays)
        for (let scan2 = node, parent = scan2.parent; parent; scan2 = parent, parent = scan2.parent) {
          if (scan2 instanceof TreeNode && scan2.index < 0 && ((_a = parent.enter(pos, side, mode)) === null || _a === void 0 ? void 0 : _a.from) != scan2.from)
            node = parent;
        }
      for (; ; ) {
        let inner = node.enter(pos, side, mode);
        if (!inner)
          return node;
        node = inner;
      }
    }
    var BaseNode = class {
      cursor(mode = 0) {
        return new TreeCursor(this, mode);
      }
      getChild(type, before = null, after = null) {
        let r = getChildren(this, type, before, after);
        return r.length ? r[0] : null;
      }
      getChildren(type, before = null, after = null) {
        return getChildren(this, type, before, after);
      }
      resolve(pos, side = 0) {
        return resolveNode(this, pos, side, false);
      }
      resolveInner(pos, side = 0) {
        return resolveNode(this, pos, side, true);
      }
      matchContext(context) {
        return matchNodeContext(this.parent, context);
      }
      enterUnfinishedNodesBefore(pos) {
        let scan2 = this.childBefore(pos), node = this;
        while (scan2) {
          let last = scan2.lastChild;
          if (!last || last.to != scan2.to)
            break;
          if (last.type.isError && last.from == last.to) {
            node = scan2;
            scan2 = last.prevSibling;
          } else {
            scan2 = last;
          }
        }
        return node;
      }
      get node() {
        return this;
      }
      get next() {
        return this.parent;
      }
    };
    var TreeNode = class _TreeNode extends BaseNode {
      constructor(_tree, from, index, _parent) {
        super();
        this._tree = _tree;
        this.from = from;
        this.index = index;
        this._parent = _parent;
      }
      get type() {
        return this._tree.type;
      }
      get name() {
        return this._tree.type.name;
      }
      get to() {
        return this.from + this._tree.length;
      }
      nextChild(i, dir, pos, side, mode = 0) {
        for (let parent = this; ; ) {
          for (let { children, positions } = parent._tree, e = dir > 0 ? children.length : -1; i != e; i += dir) {
            let next = children[i], start = positions[i] + parent.from, mounted;
            if (!(mode & exports2.IterMode.EnterBracketed && next instanceof Tree && (mounted = MountedTree.get(next)) && !mounted.overlay && mounted.bracketed && pos >= start && pos <= start + next.length) && !checkSide(side, pos, start, start + next.length))
              continue;
            if (next instanceof TreeBuffer) {
              if (mode & exports2.IterMode.ExcludeBuffers)
                continue;
              let index = next.findChild(0, next.buffer.length, dir, pos - start, side);
              if (index > -1)
                return new BufferNode(new BufferContext(parent, next, i, start), null, index);
            } else if (mode & exports2.IterMode.IncludeAnonymous || (!next.type.isAnonymous || hasChild(next))) {
              let mounted2;
              if (!(mode & exports2.IterMode.IgnoreMounts) && (mounted2 = MountedTree.get(next)) && !mounted2.overlay)
                return new _TreeNode(mounted2.tree, start, i, parent);
              let inner = new _TreeNode(next, start, i, parent);
              return mode & exports2.IterMode.IncludeAnonymous || !inner.type.isAnonymous ? inner : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, pos, side, mode);
            }
          }
          if (mode & exports2.IterMode.IncludeAnonymous || !parent.type.isAnonymous)
            return null;
          if (parent.index >= 0)
            i = parent.index + dir;
          else
            i = dir < 0 ? -1 : parent._parent._tree.children.length;
          parent = parent._parent;
          if (!parent)
            return null;
        }
      }
      get firstChild() {
        return this.nextChild(
          0,
          1,
          0,
          4
          /* Side.DontCare */
        );
      }
      get lastChild() {
        return this.nextChild(
          this._tree.children.length - 1,
          -1,
          0,
          4
          /* Side.DontCare */
        );
      }
      childAfter(pos) {
        return this.nextChild(
          0,
          1,
          pos,
          2
          /* Side.After */
        );
      }
      childBefore(pos) {
        return this.nextChild(
          this._tree.children.length - 1,
          -1,
          pos,
          -2
          /* Side.Before */
        );
      }
      prop(prop) {
        return this._tree.prop(prop);
      }
      enter(pos, side, mode = 0) {
        let mounted;
        if (!(mode & exports2.IterMode.IgnoreOverlays) && (mounted = MountedTree.get(this._tree)) && mounted.overlay) {
          let rPos = pos - this.from, enterBracketed = mode & exports2.IterMode.EnterBracketed && mounted.bracketed;
          for (let { from, to } of mounted.overlay) {
            if ((side > 0 || enterBracketed ? from <= rPos : from < rPos) && (side < 0 || enterBracketed ? to >= rPos : to > rPos))
              return new _TreeNode(mounted.tree, mounted.overlay[0].from + this.from, -1, this);
          }
        }
        return this.nextChild(0, 1, pos, side, mode);
      }
      nextSignificantParent() {
        let val = this;
        while (val.type.isAnonymous && val._parent)
          val = val._parent;
        return val;
      }
      get parent() {
        return this._parent ? this._parent.nextSignificantParent() : null;
      }
      get nextSibling() {
        return this._parent && this.index >= 0 ? this._parent.nextChild(
          this.index + 1,
          1,
          0,
          4
          /* Side.DontCare */
        ) : null;
      }
      get prevSibling() {
        return this._parent && this.index >= 0 ? this._parent.nextChild(
          this.index - 1,
          -1,
          0,
          4
          /* Side.DontCare */
        ) : null;
      }
      get tree() {
        return this._tree;
      }
      toTree() {
        return this._tree;
      }
      /**
      @internal
      */
      toString() {
        return this._tree.toString();
      }
    };
    function getChildren(node, type, before, after) {
      let cur = node.cursor(), result = [];
      if (!cur.firstChild())
        return result;
      if (before != null)
        for (let found = false; !found; ) {
          found = cur.type.is(before);
          if (!cur.nextSibling())
            return result;
        }
      for (; ; ) {
        if (after != null && cur.type.is(after))
          return result;
        if (cur.type.is(type))
          result.push(cur.node);
        if (!cur.nextSibling())
          return after == null ? result : [];
      }
    }
    function matchNodeContext(node, context, i = context.length - 1) {
      for (let p = node; i >= 0; p = p.parent) {
        if (!p)
          return false;
        if (!p.type.isAnonymous) {
          if (context[i] && context[i] != p.name)
            return false;
          i--;
        }
      }
      return true;
    }
    var BufferContext = class {
      constructor(parent, buffer, index, start) {
        this.parent = parent;
        this.buffer = buffer;
        this.index = index;
        this.start = start;
      }
    };
    var BufferNode = class _BufferNode extends BaseNode {
      get name() {
        return this.type.name;
      }
      get from() {
        return this.context.start + this.context.buffer.buffer[this.index + 1];
      }
      get to() {
        return this.context.start + this.context.buffer.buffer[this.index + 2];
      }
      constructor(context, _parent, index) {
        super();
        this.context = context;
        this._parent = _parent;
        this.index = index;
        this.type = context.buffer.set.types[context.buffer.buffer[index]];
      }
      child(dir, pos, side) {
        let { buffer } = this.context;
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.context.start, side);
        return index < 0 ? null : new _BufferNode(this.context, this, index);
      }
      get firstChild() {
        return this.child(
          1,
          0,
          4
          /* Side.DontCare */
        );
      }
      get lastChild() {
        return this.child(
          -1,
          0,
          4
          /* Side.DontCare */
        );
      }
      childAfter(pos) {
        return this.child(
          1,
          pos,
          2
          /* Side.After */
        );
      }
      childBefore(pos) {
        return this.child(
          -1,
          pos,
          -2
          /* Side.Before */
        );
      }
      prop(prop) {
        return this.type.prop(prop);
      }
      enter(pos, side, mode = 0) {
        if (mode & exports2.IterMode.ExcludeBuffers)
          return null;
        let { buffer } = this.context;
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], side > 0 ? 1 : -1, pos - this.context.start, side);
        return index < 0 ? null : new _BufferNode(this.context, this, index);
      }
      get parent() {
        return this._parent || this.context.parent.nextSignificantParent();
      }
      externalSibling(dir) {
        return this._parent ? null : this.context.parent.nextChild(
          this.context.index + dir,
          dir,
          0,
          4
          /* Side.DontCare */
        );
      }
      get nextSibling() {
        let { buffer } = this.context;
        let after = buffer.buffer[this.index + 3];
        if (after < (this._parent ? buffer.buffer[this._parent.index + 3] : buffer.buffer.length))
          return new _BufferNode(this.context, this._parent, after);
        return this.externalSibling(1);
      }
      get prevSibling() {
        let { buffer } = this.context;
        let parentStart = this._parent ? this._parent.index + 4 : 0;
        if (this.index == parentStart)
          return this.externalSibling(-1);
        return new _BufferNode(this.context, this._parent, buffer.findChild(
          parentStart,
          this.index,
          -1,
          0,
          4
          /* Side.DontCare */
        ));
      }
      get tree() {
        return null;
      }
      toTree() {
        let children = [], positions = [];
        let { buffer } = this.context;
        let startI = this.index + 4, endI = buffer.buffer[this.index + 3];
        if (endI > startI) {
          let from = buffer.buffer[this.index + 1];
          children.push(buffer.slice(startI, endI, from));
          positions.push(0);
        }
        return new Tree(this.type, children, positions, this.to - this.from);
      }
      /**
      @internal
      */
      toString() {
        return this.context.buffer.childString(this.index);
      }
    };
    function iterStack(heads) {
      if (!heads.length)
        return null;
      let pick = 0, picked = heads[0];
      for (let i = 1; i < heads.length; i++) {
        let node = heads[i];
        if (node.from > picked.from || node.to < picked.to) {
          picked = node;
          pick = i;
        }
      }
      let next = picked instanceof TreeNode && picked.index < 0 ? null : picked.parent;
      let newHeads = heads.slice();
      if (next)
        newHeads[pick] = next;
      else
        newHeads.splice(pick, 1);
      return new StackIterator(newHeads, picked);
    }
    var StackIterator = class {
      constructor(heads, node) {
        this.heads = heads;
        this.node = node;
      }
      get next() {
        return iterStack(this.heads);
      }
    };
    function stackIterator(tree, pos, side) {
      let inner = tree.resolveInner(pos, side), layers = null;
      for (let scan2 = inner instanceof TreeNode ? inner : inner.context.parent; scan2; scan2 = scan2.parent) {
        if (scan2.index < 0) {
          let parent = scan2.parent;
          (layers || (layers = [inner])).push(parent.resolve(pos, side));
          scan2 = parent;
        } else {
          let mount = MountedTree.get(scan2.tree);
          if (mount && mount.overlay && mount.overlay[0].from <= pos && mount.overlay[mount.overlay.length - 1].to >= pos) {
            let root = new TreeNode(mount.tree, mount.overlay[0].from + scan2.from, -1, scan2);
            (layers || (layers = [inner])).push(resolveNode(root, pos, side, false));
          }
        }
      }
      return layers ? iterStack(layers) : inner;
    }
    var TreeCursor = class {
      /**
      Shorthand for `.type.name`.
      */
      get name() {
        return this.type.name;
      }
      /**
      @internal
      */
      constructor(node, mode = 0) {
        this.buffer = null;
        this.stack = [];
        this.index = 0;
        this.bufferNode = null;
        this.mode = mode & ~exports2.IterMode.EnterBracketed;
        if (node instanceof TreeNode) {
          this.yieldNode(node);
        } else {
          this._tree = node.context.parent;
          this.buffer = node.context;
          for (let n = node._parent; n; n = n._parent)
            this.stack.unshift(n.index);
          this.bufferNode = node;
          this.yieldBuf(node.index);
        }
      }
      yieldNode(node) {
        if (!node)
          return false;
        this._tree = node;
        this.type = node.type;
        this.from = node.from;
        this.to = node.to;
        return true;
      }
      yieldBuf(index, type) {
        this.index = index;
        let { start, buffer } = this.buffer;
        this.type = type || buffer.set.types[buffer.buffer[index]];
        this.from = start + buffer.buffer[index + 1];
        this.to = start + buffer.buffer[index + 2];
        return true;
      }
      /**
      @internal
      */
      yield(node) {
        if (!node)
          return false;
        if (node instanceof TreeNode) {
          this.buffer = null;
          return this.yieldNode(node);
        }
        this.buffer = node.context;
        return this.yieldBuf(node.index, node.type);
      }
      /**
      @internal
      */
      toString() {
        return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
      }
      /**
      @internal
      */
      enterChild(dir, pos, side) {
        if (!this.buffer)
          return this.yield(this._tree.nextChild(dir < 0 ? this._tree._tree.children.length - 1 : 0, dir, pos, side, this.mode));
        let { buffer } = this.buffer;
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.buffer.start, side);
        if (index < 0)
          return false;
        this.stack.push(this.index);
        return this.yieldBuf(index);
      }
      /**
      Move the cursor to this node's first child. When this returns
      false, the node has no child, and the cursor has not been moved.
      */
      firstChild() {
        return this.enterChild(
          1,
          0,
          4
          /* Side.DontCare */
        );
      }
      /**
      Move the cursor to this node's last child.
      */
      lastChild() {
        return this.enterChild(
          -1,
          0,
          4
          /* Side.DontCare */
        );
      }
      /**
      Move the cursor to the first child that ends after `pos`.
      */
      childAfter(pos) {
        return this.enterChild(
          1,
          pos,
          2
          /* Side.After */
        );
      }
      /**
      Move to the last child that starts before `pos`.
      */
      childBefore(pos) {
        return this.enterChild(
          -1,
          pos,
          -2
          /* Side.Before */
        );
      }
      /**
      Move the cursor to the child around `pos`. If side is -1 the
      child may end at that position, when 1 it may start there. This
      will also enter [overlaid](#common.MountedTree.overlay)
      [mounted](#common.NodeProp^mounted) trees unless `overlays` is
      set to false.
      */
      enter(pos, side, mode = this.mode) {
        if (!this.buffer)
          return this.yield(this._tree.enter(pos, side, mode));
        return mode & exports2.IterMode.ExcludeBuffers ? false : this.enterChild(1, pos, side);
      }
      /**
      Move to the node's parent node, if this isn't the top node.
      */
      parent() {
        if (!this.buffer)
          return this.yieldNode(this.mode & exports2.IterMode.IncludeAnonymous ? this._tree._parent : this._tree.parent);
        if (this.stack.length)
          return this.yieldBuf(this.stack.pop());
        let parent = this.mode & exports2.IterMode.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
        this.buffer = null;
        return this.yieldNode(parent);
      }
      /**
      @internal
      */
      sibling(dir) {
        if (!this.buffer)
          return !this._tree._parent ? false : this.yield(this._tree.index < 0 ? null : this._tree._parent.nextChild(this._tree.index + dir, dir, 0, 4, this.mode));
        let { buffer } = this.buffer, d = this.stack.length - 1;
        if (dir < 0) {
          let parentStart = d < 0 ? 0 : this.stack[d] + 4;
          if (this.index != parentStart)
            return this.yieldBuf(buffer.findChild(
              parentStart,
              this.index,
              -1,
              0,
              4
              /* Side.DontCare */
            ));
        } else {
          let after = buffer.buffer[this.index + 3];
          if (after < (d < 0 ? buffer.buffer.length : buffer.buffer[this.stack[d] + 3]))
            return this.yieldBuf(after);
        }
        return d < 0 ? this.yield(this.buffer.parent.nextChild(this.buffer.index + dir, dir, 0, 4, this.mode)) : false;
      }
      /**
      Move to this node's next sibling, if any.
      */
      nextSibling() {
        return this.sibling(1);
      }
      /**
      Move to this node's previous sibling, if any.
      */
      prevSibling() {
        return this.sibling(-1);
      }
      atLastNode(dir) {
        let index, parent, { buffer } = this;
        if (buffer) {
          if (dir > 0) {
            if (this.index < buffer.buffer.buffer.length)
              return false;
          } else {
            for (let i = 0; i < this.index; i++)
              if (buffer.buffer.buffer[i + 3] < this.index)
                return false;
          }
          ({ index, parent } = buffer);
        } else {
          ({ index, _parent: parent } = this._tree);
        }
        for (; parent; { index, _parent: parent } = parent) {
          if (index > -1)
            for (let i = index + dir, e = dir < 0 ? -1 : parent._tree.children.length; i != e; i += dir) {
              let child = parent._tree.children[i];
              if (this.mode & exports2.IterMode.IncludeAnonymous || child instanceof TreeBuffer || !child.type.isAnonymous || hasChild(child))
                return false;
            }
        }
        return true;
      }
      move(dir, enter) {
        if (enter && this.enterChild(
          dir,
          0,
          4
          /* Side.DontCare */
        ))
          return true;
        for (; ; ) {
          if (this.sibling(dir))
            return true;
          if (this.atLastNode(dir) || !this.parent())
            return false;
        }
      }
      /**
      Move to the next node in a
      [pre-order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR)
      traversal, going from a node to its first child or, if the
      current node is empty or `enter` is false, its next sibling or
      the next sibling of the first parent node that has one.
      */
      next(enter = true) {
        return this.move(1, enter);
      }
      /**
      Move to the next node in a last-to-first pre-order traversal. A
      node is followed by its last child or, if it has none, its
      previous sibling or the previous sibling of the first parent
      node that has one.
      */
      prev(enter = true) {
        return this.move(-1, enter);
      }
      /**
      Move the cursor to the innermost node that covers `pos`. If
      `side` is -1, it will enter nodes that end at `pos`. If it is 1,
      it will enter nodes that start at `pos`.
      */
      moveTo(pos, side = 0) {
        while (this.from == this.to || (side < 1 ? this.from >= pos : this.from > pos) || (side > -1 ? this.to <= pos : this.to < pos))
          if (!this.parent())
            break;
        while (this.enterChild(1, pos, side)) {
        }
        return this;
      }
      /**
      Get a [syntax node](#common.SyntaxNode) at the cursor's current
      position.
      */
      get node() {
        if (!this.buffer)
          return this._tree;
        let cache = this.bufferNode, result = null, depth = 0;
        if (cache && cache.context == this.buffer) {
          scan: for (let index = this.index, d = this.stack.length; d >= 0; ) {
            for (let c = cache; c; c = c._parent)
              if (c.index == index) {
                if (index == this.index)
                  return c;
                result = c;
                depth = d + 1;
                break scan;
              }
            index = this.stack[--d];
          }
        }
        for (let i = depth; i < this.stack.length; i++)
          result = new BufferNode(this.buffer, result, this.stack[i]);
        return this.bufferNode = new BufferNode(this.buffer, result, this.index);
      }
      /**
      Get the [tree](#common.Tree) that represents the current node, if
      any. Will return null when the node is in a [tree
      buffer](#common.TreeBuffer).
      */
      get tree() {
        return this.buffer ? null : this._tree._tree;
      }
      /**
      Iterate over the current node and all its descendants, calling
      `enter` when entering a node and `leave`, if given, when leaving
      one. When `enter` returns `false`, any children of that node are
      skipped, and `leave` isn't called for it.
      */
      iterate(enter, leave) {
        for (let depth = 0; ; ) {
          let mustLeave = false;
          if (this.type.isAnonymous || enter(this) !== false) {
            if (this.firstChild()) {
              depth++;
              continue;
            }
            if (!this.type.isAnonymous)
              mustLeave = true;
          }
          for (; ; ) {
            if (mustLeave && leave)
              leave(this);
            mustLeave = this.type.isAnonymous;
            if (!depth)
              return;
            if (this.nextSibling())
              break;
            this.parent();
            depth--;
            mustLeave = true;
          }
        }
      }
      /**
      Test whether the current node matches a given context—a sequence
      of direct parent node names. Empty strings in the context array
      are treated as wildcards.
      */
      matchContext(context) {
        if (!this.buffer)
          return matchNodeContext(this.node.parent, context);
        let { buffer } = this.buffer, { types } = buffer.set;
        for (let i = context.length - 1, d = this.stack.length - 1; i >= 0; d--) {
          if (d < 0)
            return matchNodeContext(this._tree, context, i);
          let type = types[buffer.buffer[this.stack[d]]];
          if (!type.isAnonymous) {
            if (context[i] && context[i] != type.name)
              return false;
            i--;
          }
        }
        return true;
      }
    };
    function hasChild(tree) {
      return tree.children.some((ch) => ch instanceof TreeBuffer || !ch.type.isAnonymous || hasChild(ch));
    }
    function buildTree(data) {
      var _a;
      let { buffer, nodeSet, maxBufferLength = DefaultBufferLength, reused = [], minRepeatType = nodeSet.types.length } = data;
      let cursor = Array.isArray(buffer) ? new FlatBufferCursor(buffer, buffer.length) : buffer;
      let types = nodeSet.types;
      let contextHash = 0, lookAhead = 0;
      function takeNode(parentStart, minPos, children2, positions2, inRepeat, depth) {
        let { id, start, end, size } = cursor;
        let lookAheadAtStart = lookAhead, contextAtStart = contextHash;
        if (size < 0) {
          cursor.next();
          if (size == -1) {
            let node2 = reused[id];
            children2.push(node2);
            positions2.push(start - parentStart);
            return;
          } else if (size == -3) {
            contextHash = id;
            return;
          } else if (size == -4) {
            lookAhead = id;
            return;
          } else {
            throw new RangeError(`Unrecognized record size: ${size}`);
          }
        }
        let type = types[id], node, buffer2;
        let startPos = start - parentStart;
        if (end - start <= maxBufferLength && (buffer2 = findBufferSize(cursor.pos - minPos, inRepeat))) {
          let data2 = new Uint16Array(buffer2.size - buffer2.skip);
          let endPos = cursor.pos - buffer2.size, index = data2.length;
          while (cursor.pos > endPos)
            index = copyToBuffer(buffer2.start, data2, index);
          node = new TreeBuffer(data2, end - buffer2.start, nodeSet);
          startPos = buffer2.start - parentStart;
        } else {
          let endPos = cursor.pos - size;
          cursor.next();
          let localChildren = [], localPositions = [];
          let localInRepeat = id >= minRepeatType ? id : -1;
          let lastGroup = 0, lastEnd = end, groupLookAhead = lookAheadAtStart;
          while (cursor.pos > endPos) {
            if (localInRepeat >= 0 && cursor.id == localInRepeat && cursor.size >= 0) {
              if (cursor.end <= lastEnd - maxBufferLength) {
                makeRepeatLeaf(localChildren, localPositions, start, lastGroup, cursor.end, lastEnd, localInRepeat, groupLookAhead, contextAtStart);
                lastGroup = localChildren.length;
                lastEnd = cursor.end;
                groupLookAhead = lookAhead;
              }
              cursor.next();
            } else if (depth > 2500) {
              takeFlatNode(start, endPos, localChildren, localPositions);
            } else {
              takeNode(start, endPos, localChildren, localPositions, localInRepeat, depth + 1);
            }
          }
          if (localInRepeat >= 0 && lastGroup > 0 && lastGroup < localChildren.length)
            makeRepeatLeaf(localChildren, localPositions, start, lastGroup, start, lastEnd, localInRepeat, groupLookAhead, contextAtStart);
          localChildren.reverse();
          localPositions.reverse();
          if (localInRepeat > -1 && lastGroup > 0) {
            let make = makeBalanced(type, contextAtStart);
            node = balanceRange(type, localChildren, localPositions, 0, localChildren.length, 0, end - start, make, make);
          } else {
            node = makeTree(type, localChildren, localPositions, end - start, lookAheadAtStart - end, contextAtStart);
          }
        }
        children2.push(node);
        positions2.push(startPos);
      }
      function takeFlatNode(parentStart, minPos, children2, positions2) {
        let nodes = [];
        let nodeCount = 0, stopAt = -1;
        while (cursor.pos > minPos) {
          let { id, start, end, size } = cursor;
          if (size > 4) {
            cursor.next();
          } else if (stopAt > -1 && start < stopAt) {
            break;
          } else {
            if (stopAt < 0)
              stopAt = end - maxBufferLength;
            nodes.push(id, start, end);
            nodeCount++;
            cursor.next();
          }
        }
        if (nodeCount) {
          let buffer2 = new Uint16Array(nodeCount * 4);
          let start = nodes[nodes.length - 2];
          for (let i = nodes.length - 3, j = 0; i >= 0; i -= 3) {
            buffer2[j++] = nodes[i];
            buffer2[j++] = nodes[i + 1] - start;
            buffer2[j++] = nodes[i + 2] - start;
            buffer2[j++] = j;
          }
          children2.push(new TreeBuffer(buffer2, nodes[2] - start, nodeSet));
          positions2.push(start - parentStart);
        }
      }
      function makeBalanced(type, contextHash2) {
        return (children2, positions2, length2) => {
          let lookAhead2 = 0, lastI = children2.length - 1, last, lookAheadProp;
          if (lastI >= 0 && (last = children2[lastI]) instanceof Tree) {
            if (!lastI && last.type == type && last.length == length2)
              return last;
            if (lookAheadProp = last.prop(NodeProp.lookAhead))
              lookAhead2 = positions2[lastI] + last.length + lookAheadProp - length2;
          }
          return makeTree(type, children2, positions2, length2, lookAhead2, contextHash2);
        };
      }
      function makeRepeatLeaf(children2, positions2, base, i, from, to, type, lookAhead2, contextHash2) {
        let localChildren = [], localPositions = [];
        while (children2.length > i) {
          localChildren.push(children2.pop());
          localPositions.push(positions2.pop() + base - from);
        }
        children2.push(makeTree(nodeSet.types[type], localChildren, localPositions, to - from, lookAhead2 - to, contextHash2));
        positions2.push(from - base);
      }
      function makeTree(type, children2, positions2, length2, lookAhead2, contextHash2, props) {
        if (contextHash2) {
          let pair = [NodeProp.contextHash, contextHash2];
          props = props ? [pair].concat(props) : [pair];
        }
        if (lookAhead2 > 25) {
          let pair = [NodeProp.lookAhead, lookAhead2];
          props = props ? [pair].concat(props) : [pair];
        }
        return new Tree(type, children2, positions2, length2, props);
      }
      function findBufferSize(maxSize, inRepeat) {
        let fork = cursor.fork();
        let size = 0, start = 0, skip = 0, minStart = fork.end - maxBufferLength;
        let result = { size: 0, start: 0, skip: 0 };
        scan: for (let minPos = fork.pos - maxSize; fork.pos > minPos; ) {
          let nodeSize2 = fork.size;
          if (fork.id == inRepeat && nodeSize2 >= 0) {
            result.size = size;
            result.start = start;
            result.skip = skip;
            skip += 4;
            size += 4;
            fork.next();
            continue;
          }
          let startPos = fork.pos - nodeSize2;
          if (nodeSize2 < 0 || startPos < minPos || fork.start < minStart)
            break;
          let localSkipped = fork.id >= minRepeatType ? 4 : 0;
          let nodeStart = fork.start;
          fork.next();
          while (fork.pos > startPos) {
            if (fork.size < 0) {
              if (fork.size == -3 || fork.size == -4)
                localSkipped += 4;
              else
                break scan;
            } else if (fork.id >= minRepeatType) {
              localSkipped += 4;
            }
            fork.next();
          }
          start = nodeStart;
          size += nodeSize2;
          skip += localSkipped;
        }
        if (inRepeat < 0 || size == maxSize) {
          result.size = size;
          result.start = start;
          result.skip = skip;
        }
        return result.size > 4 ? result : void 0;
      }
      function copyToBuffer(bufferStart, buffer2, index) {
        let { id, start, end, size } = cursor;
        cursor.next();
        if (size >= 0 && id < minRepeatType) {
          let startIndex = index;
          if (size > 4) {
            let endPos = cursor.pos - (size - 4);
            while (cursor.pos > endPos)
              index = copyToBuffer(bufferStart, buffer2, index);
          }
          buffer2[--index] = startIndex;
          buffer2[--index] = end - bufferStart;
          buffer2[--index] = start - bufferStart;
          buffer2[--index] = id;
        } else if (size == -3) {
          contextHash = id;
        } else if (size == -4) {
          lookAhead = id;
        }
        return index;
      }
      let children = [], positions = [];
      while (cursor.pos > 0)
        takeNode(data.start || 0, data.bufferStart || 0, children, positions, -1, 0);
      let length = (_a = data.length) !== null && _a !== void 0 ? _a : children.length ? positions[0] + children[0].length : 0;
      return new Tree(types[data.topID], children.reverse(), positions.reverse(), length);
    }
    var nodeSizeCache = /* @__PURE__ */ new WeakMap();
    function nodeSize(balanceType, node) {
      if (!balanceType.isAnonymous || node instanceof TreeBuffer || node.type != balanceType)
        return 1;
      let size = nodeSizeCache.get(node);
      if (size == null) {
        size = 1;
        for (let child of node.children) {
          if (child.type != balanceType || !(child instanceof Tree)) {
            size = 1;
            break;
          }
          size += nodeSize(balanceType, child);
        }
        nodeSizeCache.set(node, size);
      }
      return size;
    }
    function balanceRange(balanceType, children, positions, from, to, start, length, mkTop, mkTree) {
      let total = 0;
      for (let i = from; i < to; i++)
        total += nodeSize(balanceType, children[i]);
      let maxChild = Math.ceil(
        total * 1.5 / 8
        /* Balance.BranchFactor */
      );
      let localChildren = [], localPositions = [];
      function divide(children2, positions2, from2, to2, offset) {
        for (let i = from2; i < to2; ) {
          let groupFrom = i, groupStart = positions2[i], groupSize = nodeSize(balanceType, children2[i]);
          i++;
          for (; i < to2; i++) {
            let nextSize = nodeSize(balanceType, children2[i]);
            if (groupSize + nextSize >= maxChild)
              break;
            groupSize += nextSize;
          }
          if (i == groupFrom + 1) {
            if (groupSize > maxChild) {
              let only = children2[groupFrom];
              divide(only.children, only.positions, 0, only.children.length, positions2[groupFrom] + offset);
              continue;
            }
            localChildren.push(children2[groupFrom]);
          } else {
            let length2 = positions2[i - 1] + children2[i - 1].length - groupStart;
            localChildren.push(balanceRange(balanceType, children2, positions2, groupFrom, i, groupStart, length2, null, mkTree));
          }
          localPositions.push(groupStart + offset - start);
        }
      }
      divide(children, positions, from, to, 0);
      return (mkTop || mkTree)(localChildren, localPositions, length);
    }
    var NodeWeakMap = class {
      constructor() {
        this.map = /* @__PURE__ */ new WeakMap();
      }
      setBuffer(buffer, index, value) {
        let inner = this.map.get(buffer);
        if (!inner)
          this.map.set(buffer, inner = /* @__PURE__ */ new Map());
        inner.set(index, value);
      }
      getBuffer(buffer, index) {
        let inner = this.map.get(buffer);
        return inner && inner.get(index);
      }
      /**
      Set the value for this syntax node.
      */
      set(node, value) {
        if (node instanceof BufferNode)
          this.setBuffer(node.context.buffer, node.index, value);
        else if (node instanceof TreeNode)
          this.map.set(node.tree, value);
      }
      /**
      Retrieve value for this syntax node, if it exists in the map.
      */
      get(node) {
        return node instanceof BufferNode ? this.getBuffer(node.context.buffer, node.index) : node instanceof TreeNode ? this.map.get(node.tree) : void 0;
      }
      /**
      Set the value for the node that a cursor currently points to.
      */
      cursorSet(cursor, value) {
        if (cursor.buffer)
          this.setBuffer(cursor.buffer.buffer, cursor.index, value);
        else
          this.map.set(cursor.tree, value);
      }
      /**
      Retrieve the value for the node that a cursor currently points
      to.
      */
      cursorGet(cursor) {
        return cursor.buffer ? this.getBuffer(cursor.buffer.buffer, cursor.index) : this.map.get(cursor.tree);
      }
    };
    var TreeFragment = class _TreeFragment {
      /**
      Construct a tree fragment. You'll usually want to use
      [`addTree`](#common.TreeFragment^addTree) and
      [`applyChanges`](#common.TreeFragment^applyChanges) instead of
      calling this directly.
      */
      constructor(from, to, tree, offset, openStart = false, openEnd = false) {
        this.from = from;
        this.to = to;
        this.tree = tree;
        this.offset = offset;
        this.open = (openStart ? 1 : 0) | (openEnd ? 2 : 0);
      }
      /**
      Whether the start of the fragment represents the start of a
      parse, or the end of a change. (In the second case, it may not
      be safe to reuse some nodes at the start, depending on the
      parsing algorithm.)
      */
      get openStart() {
        return (this.open & 1) > 0;
      }
      /**
      Whether the end of the fragment represents the end of a
      full-document parse, or the start of a change.
      */
      get openEnd() {
        return (this.open & 2) > 0;
      }
      /**
      Create a set of fragments from a freshly parsed tree, or update
      an existing set of fragments by replacing the ones that overlap
      with a tree with content from the new tree. When `partial` is
      true, the parse is treated as incomplete, and the resulting
      fragment has [`openEnd`](#common.TreeFragment.openEnd) set to
      true.
      */
      static addTree(tree, fragments = [], partial = false) {
        let result = [new _TreeFragment(0, tree.length, tree, 0, false, partial)];
        for (let f of fragments)
          if (f.to > tree.length)
            result.push(f);
        return result;
      }
      /**
      Apply a set of edits to an array of fragments, removing or
      splitting fragments as necessary to remove edited ranges, and
      adjusting offsets for fragments that moved.
      */
      static applyChanges(fragments, changes, minGap = 128) {
        if (!changes.length)
          return fragments;
        let result = [];
        let fI = 1, nextF = fragments.length ? fragments[0] : null;
        for (let cI = 0, pos = 0, off = 0; ; cI++) {
          let nextC = cI < changes.length ? changes[cI] : null;
          let nextPos = nextC ? nextC.fromA : 1e9;
          if (nextPos - pos >= minGap)
            while (nextF && nextF.from < nextPos) {
              let cut = nextF;
              if (pos >= cut.from || nextPos <= cut.to || off) {
                let fFrom = Math.max(cut.from, pos) - off, fTo = Math.min(cut.to, nextPos) - off;
                cut = fFrom >= fTo ? null : new _TreeFragment(fFrom, fTo, cut.tree, cut.offset + off, cI > 0, !!nextC);
              }
              if (cut)
                result.push(cut);
              if (nextF.to > nextPos)
                break;
              nextF = fI < fragments.length ? fragments[fI++] : null;
            }
          if (!nextC)
            break;
          pos = nextC.toA;
          off = nextC.toA - nextC.toB;
        }
        return result;
      }
    };
    var Parser = class {
      /**
      Start a parse, returning a [partial parse](#common.PartialParse)
      object. [`fragments`](#common.TreeFragment) can be passed in to
      make the parse incremental.
      
      By default, the entire input is parsed. You can pass `ranges`,
      which should be a sorted array of non-empty, non-overlapping
      ranges, to parse only those ranges. The tree returned in that
      case will start at `ranges[0].from`.
      */
      startParse(input, fragments, ranges) {
        if (typeof input == "string")
          input = new StringInput(input);
        ranges = !ranges ? [new Range(0, input.length)] : ranges.length ? ranges.map((r) => new Range(r.from, r.to)) : [new Range(0, 0)];
        return this.createParse(input, fragments || [], ranges);
      }
      /**
      Run a full parse, returning the resulting tree.
      */
      parse(input, fragments, ranges) {
        let parse = this.startParse(input, fragments, ranges);
        for (; ; ) {
          let done = parse.advance();
          if (done)
            return done;
        }
      }
    };
    var StringInput = class {
      constructor(string) {
        this.string = string;
      }
      get length() {
        return this.string.length;
      }
      chunk(from) {
        return this.string.slice(from);
      }
      get lineChunks() {
        return false;
      }
      read(from, to) {
        return this.string.slice(from, to);
      }
    };
    function parseMixed(nest) {
      return (parse, input, fragments, ranges) => new MixedParse(parse, nest, input, fragments, ranges);
    }
    var InnerParse = class {
      constructor(parser, parse, overlay, bracketed, target, from) {
        this.parser = parser;
        this.parse = parse;
        this.overlay = overlay;
        this.bracketed = bracketed;
        this.target = target;
        this.from = from;
      }
    };
    function checkRanges(ranges) {
      if (!ranges.length || ranges.some((r) => r.from >= r.to))
        throw new RangeError("Invalid inner parse ranges given: " + JSON.stringify(ranges));
    }
    var ActiveOverlay = class {
      constructor(parser, predicate, mounts, index, start, bracketed, target, prev) {
        this.parser = parser;
        this.predicate = predicate;
        this.mounts = mounts;
        this.index = index;
        this.start = start;
        this.bracketed = bracketed;
        this.target = target;
        this.prev = prev;
        this.depth = 0;
        this.ranges = [];
      }
    };
    var stoppedInner = new NodeProp({ perNode: true });
    var MixedParse = class {
      constructor(base, nest, input, fragments, ranges) {
        this.nest = nest;
        this.input = input;
        this.fragments = fragments;
        this.ranges = ranges;
        this.inner = [];
        this.innerDone = 0;
        this.baseTree = null;
        this.stoppedAt = null;
        this.baseParse = base;
      }
      advance() {
        if (this.baseParse) {
          let done2 = this.baseParse.advance();
          if (!done2)
            return null;
          this.baseParse = null;
          this.baseTree = done2;
          this.startInner();
          if (this.stoppedAt != null)
            for (let inner2 of this.inner)
              inner2.parse.stopAt(this.stoppedAt);
        }
        if (this.innerDone == this.inner.length) {
          let result = this.baseTree;
          if (this.stoppedAt != null)
            result = new Tree(result.type, result.children, result.positions, result.length, result.propValues.concat([[stoppedInner, this.stoppedAt]]));
          return result;
        }
        let inner = this.inner[this.innerDone], done = inner.parse.advance();
        if (done) {
          this.innerDone++;
          let props = Object.assign(/* @__PURE__ */ Object.create(null), inner.target.props);
          props[NodeProp.mounted.id] = new MountedTree(done, inner.overlay, inner.parser, inner.bracketed);
          inner.target.props = props;
        }
        return null;
      }
      get parsedPos() {
        if (this.baseParse)
          return 0;
        let pos = this.input.length;
        for (let i = this.innerDone; i < this.inner.length; i++) {
          if (this.inner[i].from < pos)
            pos = Math.min(pos, this.inner[i].parse.parsedPos);
        }
        return pos;
      }
      stopAt(pos) {
        this.stoppedAt = pos;
        if (this.baseParse)
          this.baseParse.stopAt(pos);
        else
          for (let i = this.innerDone; i < this.inner.length; i++)
            this.inner[i].parse.stopAt(pos);
      }
      startInner() {
        let fragmentCursor = new FragmentCursor(this.fragments);
        let overlay = null;
        let covered = null;
        let cursor = new TreeCursor(new TreeNode(this.baseTree, this.ranges[0].from, 0, null), exports2.IterMode.IncludeAnonymous | exports2.IterMode.IgnoreMounts);
        scan: for (let nest, isCovered; ; ) {
          let enter = true, range;
          if (this.stoppedAt != null && cursor.from >= this.stoppedAt) {
            enter = false;
          } else if (fragmentCursor.hasNode(cursor)) {
            if (overlay) {
              let match = overlay.mounts.find((m) => m.frag.from <= cursor.from && m.frag.to >= cursor.to && m.mount.overlay);
              if (match)
                for (let r of match.mount.overlay) {
                  let from = r.from + match.pos, to = r.to + match.pos;
                  if (from >= cursor.from && to <= cursor.to && !overlay.ranges.some((r2) => r2.from < to && r2.to > from))
                    overlay.ranges.push({ from, to });
                }
            }
            enter = false;
          } else if (covered && (isCovered = checkCover(covered.ranges, cursor.from, cursor.to))) {
            enter = isCovered != 2;
          } else if (!cursor.type.isAnonymous && (nest = this.nest(cursor, this.input)) && (cursor.from < cursor.to || !nest.overlay)) {
            if (!cursor.tree) {
              materialize(cursor);
              if (overlay)
                overlay.depth++;
              if (covered)
                covered.depth++;
            }
            let oldMounts = fragmentCursor.findMounts(cursor.from, nest.parser);
            if (typeof nest.overlay == "function") {
              overlay = new ActiveOverlay(nest.parser, nest.overlay, oldMounts, this.inner.length, cursor.from, !!nest.bracketed, cursor.tree, overlay);
            } else {
              let ranges = punchRanges(this.ranges, nest.overlay || (cursor.from < cursor.to ? [new Range(cursor.from, cursor.to)] : []));
              if (ranges.length)
                checkRanges(ranges);
              if (ranges.length || !nest.overlay)
                this.inner.push(new InnerParse(nest.parser, ranges.length ? nest.parser.startParse(this.input, enterFragments(oldMounts, ranges), ranges) : nest.parser.startParse(""), nest.overlay ? nest.overlay.map((r) => new Range(r.from - cursor.from, r.to - cursor.from)) : null, !!nest.bracketed, cursor.tree, ranges.length ? ranges[0].from : cursor.from));
              if (!nest.overlay)
                enter = false;
              else if (ranges.length)
                covered = { ranges, depth: 0, prev: covered };
            }
          } else if (overlay && (range = overlay.predicate(cursor))) {
            if (range === true)
              range = new Range(cursor.from, cursor.to);
            if (range.from < range.to) {
              let last = overlay.ranges.length - 1;
              if (last >= 0 && overlay.ranges[last].to == range.from)
                overlay.ranges[last] = { from: overlay.ranges[last].from, to: range.to };
              else
                overlay.ranges.push(range);
            }
          }
          if (enter && cursor.firstChild()) {
            if (overlay)
              overlay.depth++;
            if (covered)
              covered.depth++;
          } else {
            for (; ; ) {
              if (cursor.nextSibling())
                break;
              if (!cursor.parent())
                break scan;
              if (overlay && !--overlay.depth) {
                let ranges = punchRanges(this.ranges, overlay.ranges);
                if (ranges.length) {
                  checkRanges(ranges);
                  this.inner.splice(overlay.index, 0, new InnerParse(overlay.parser, overlay.parser.startParse(this.input, enterFragments(overlay.mounts, ranges), ranges), overlay.ranges.map((r) => new Range(r.from - overlay.start, r.to - overlay.start)), overlay.bracketed, overlay.target, ranges[0].from));
                }
                overlay = overlay.prev;
              }
              if (covered && !--covered.depth)
                covered = covered.prev;
            }
          }
        }
      }
    };
    function checkCover(covered, from, to) {
      for (let range of covered) {
        if (range.from >= to)
          break;
        if (range.to > from)
          return range.from <= from && range.to >= to ? 2 : 1;
      }
      return 0;
    }
    function sliceBuf(buf, startI, endI, nodes, positions, off) {
      if (startI < endI) {
        let from = buf.buffer[startI + 1];
        nodes.push(buf.slice(startI, endI, from));
        positions.push(from - off);
      }
    }
    function materialize(cursor) {
      let { node } = cursor, stack = [];
      let buffer = node.context.buffer;
      do {
        stack.push(cursor.index);
        cursor.parent();
      } while (!cursor.tree);
      let base = cursor.tree, i = base.children.indexOf(buffer);
      let buf = base.children[i], b = buf.buffer, newStack = [i];
      function split(startI, endI, type, innerOffset, length, stackPos) {
        let targetI = stack[stackPos];
        let children = [], positions = [];
        sliceBuf(buf, startI, targetI, children, positions, innerOffset);
        let from = b[targetI + 1], to = b[targetI + 2];
        newStack.push(children.length);
        let child = stackPos ? split(targetI + 4, b[targetI + 3], buf.set.types[b[targetI]], from, to - from, stackPos - 1) : node.toTree();
        children.push(child);
        positions.push(from - innerOffset);
        sliceBuf(buf, b[targetI + 3], endI, children, positions, innerOffset);
        return new Tree(type, children, positions, length);
      }
      base.children[i] = split(0, b.length, NodeType.none, 0, buf.length, stack.length - 1);
      for (let index of newStack) {
        let tree = cursor.tree.children[index], pos = cursor.tree.positions[index];
        cursor.yield(new TreeNode(tree, pos + cursor.from, index, cursor._tree));
      }
    }
    var StructureCursor = class {
      constructor(root, offset) {
        this.offset = offset;
        this.done = false;
        this.cursor = root.cursor(exports2.IterMode.IncludeAnonymous | exports2.IterMode.IgnoreMounts | exports2.IterMode.ExcludeBuffers);
      }
      // Move to the first node (in pre-order) that starts at or after `pos`.
      moveTo(pos) {
        let { cursor } = this, p = pos - this.offset;
        while (!this.done && cursor.from < p) {
          if (cursor.to >= p && cursor.enter(p, 1, exports2.IterMode.IncludeAnonymous | exports2.IterMode.IgnoreOverlays | exports2.IterMode.ExcludeBuffers)) ;
          else if (cursor.to <= p) {
            if (!cursor.next(false))
              this.done = true;
          } else {
            break;
          }
        }
      }
      hasNode(cursor) {
        this.moveTo(cursor.from);
        if (!this.done && this.cursor.from + this.offset == cursor.from && this.cursor.tree) {
          for (let tree = this.cursor.tree; ; ) {
            if (tree == cursor.tree)
              return true;
            if (tree.children.length && tree.positions[0] == 0 && tree.children[0] instanceof Tree)
              tree = tree.children[0];
            else
              break;
          }
        }
        return false;
      }
    };
    var FragmentCursor = class {
      constructor(fragments) {
        var _a;
        this.fragments = fragments;
        this.curTo = 0;
        this.fragI = 0;
        if (fragments.length) {
          let first = this.curFrag = fragments[0];
          this.curTo = (_a = first.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : first.to;
          this.inner = new StructureCursor(first.tree, -first.offset);
        } else {
          this.curFrag = this.inner = null;
        }
      }
      hasNode(node) {
        while (this.curFrag && node.from >= this.curTo)
          this.nextFrag();
        return this.curFrag && this.curFrag.from <= node.from && this.curTo >= node.to && this.inner.hasNode(node);
      }
      nextFrag() {
        var _a;
        this.fragI++;
        if (this.fragI == this.fragments.length) {
          this.curFrag = this.inner = null;
        } else {
          let frag = this.curFrag = this.fragments[this.fragI];
          this.curTo = (_a = frag.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : frag.to;
          this.inner = new StructureCursor(frag.tree, -frag.offset);
        }
      }
      findMounts(pos, parser) {
        var _a;
        let result = [];
        if (this.inner) {
          this.inner.cursor.moveTo(pos, 1);
          for (let pos2 = this.inner.cursor.node; pos2; pos2 = pos2.parent) {
            let mount = (_a = pos2.tree) === null || _a === void 0 ? void 0 : _a.prop(NodeProp.mounted);
            if (mount && mount.parser == parser) {
              for (let i = this.fragI; i < this.fragments.length; i++) {
                let frag = this.fragments[i];
                if (frag.from >= pos2.to)
                  break;
                if (frag.tree == this.curFrag.tree)
                  result.push({
                    frag,
                    pos: pos2.from - frag.offset,
                    mount
                  });
              }
            }
          }
        }
        return result;
      }
    };
    function punchRanges(outer, ranges) {
      let copy = null, current = ranges;
      for (let i = 1, j = 0; i < outer.length; i++) {
        let gapFrom = outer[i - 1].to, gapTo = outer[i].from;
        for (; j < current.length; j++) {
          let r = current[j];
          if (r.from >= gapTo)
            break;
          if (r.to <= gapFrom)
            continue;
          if (!copy)
            current = copy = ranges.slice();
          if (r.from < gapFrom) {
            copy[j] = new Range(r.from, gapFrom);
            if (r.to > gapTo)
              copy.splice(j + 1, 0, new Range(gapTo, r.to));
          } else if (r.to > gapTo) {
            copy[j--] = new Range(gapTo, r.to);
          } else {
            copy.splice(j--, 1);
          }
        }
      }
      return current;
    }
    function findCoverChanges(a, b, from, to) {
      let iA = 0, iB = 0, inA = false, inB = false, pos = -1e9;
      let result = [];
      for (; ; ) {
        let nextA = iA == a.length ? 1e9 : inA ? a[iA].to : a[iA].from;
        let nextB = iB == b.length ? 1e9 : inB ? b[iB].to : b[iB].from;
        if (inA != inB) {
          let start = Math.max(pos, from), end = Math.min(nextA, nextB, to);
          if (start < end)
            result.push(new Range(start, end));
        }
        pos = Math.min(nextA, nextB);
        if (pos == 1e9)
          break;
        if (nextA == pos) {
          if (!inA)
            inA = true;
          else {
            inA = false;
            iA++;
          }
        }
        if (nextB == pos) {
          if (!inB)
            inB = true;
          else {
            inB = false;
            iB++;
          }
        }
      }
      return result;
    }
    function enterFragments(mounts, ranges) {
      let result = [];
      for (let { pos, mount, frag } of mounts) {
        let startPos = pos + (mount.overlay ? mount.overlay[0].from : 0), endPos = startPos + mount.tree.length;
        let from = Math.max(frag.from, startPos), to = Math.min(frag.to, endPos);
        if (mount.overlay) {
          let overlay = mount.overlay.map((r) => new Range(r.from + pos, r.to + pos));
          let changes = findCoverChanges(ranges, overlay, from, to);
          for (let i = 0, pos2 = from; ; i++) {
            let last = i == changes.length, end = last ? to : changes[i].from;
            if (end > pos2)
              result.push(new TreeFragment(pos2, end, mount.tree, -startPos, frag.from >= pos2 || frag.openStart, frag.to <= end || frag.openEnd));
            if (last)
              break;
            pos2 = changes[i].to;
          }
        } else {
          result.push(new TreeFragment(from, to, mount.tree, -startPos, frag.from >= startPos || frag.openStart, frag.to <= endPos || frag.openEnd));
        }
      }
      return result;
    }
    exports2.DefaultBufferLength = DefaultBufferLength;
    exports2.MountedTree = MountedTree;
    exports2.NodeProp = NodeProp;
    exports2.NodeSet = NodeSet;
    exports2.NodeType = NodeType;
    exports2.NodeWeakMap = NodeWeakMap;
    exports2.Parser = Parser;
    exports2.Tree = Tree;
    exports2.TreeBuffer = TreeBuffer;
    exports2.TreeCursor = TreeCursor;
    exports2.TreeFragment = TreeFragment;
    exports2.parseMixed = parseMixed;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/highlight/dist/index.cjs
var require_dist2 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/highlight/dist/index.cjs"(exports2) {
    "use strict";
    var common = require_dist();
    var nextTagID = 0;
    var Tag = class _Tag {
      /**
      @internal
      */
      constructor(name2, set, base, modified) {
        this.name = name2;
        this.set = set;
        this.base = base;
        this.modified = modified;
        this.id = nextTagID++;
      }
      toString() {
        let { name: name2 } = this;
        for (let mod of this.modified)
          if (mod.name)
            name2 = `${mod.name}(${name2})`;
        return name2;
      }
      static define(nameOrParent, parent) {
        let name2 = typeof nameOrParent == "string" ? nameOrParent : "?";
        if (nameOrParent instanceof _Tag)
          parent = nameOrParent;
        if (parent === null || parent === void 0 ? void 0 : parent.base)
          throw new Error("Can not derive from a modified tag");
        let tag = new _Tag(name2, [], null, []);
        tag.set.push(tag);
        if (parent)
          for (let t2 of parent.set)
            tag.set.push(t2);
        return tag;
      }
      /**
      Define a tag _modifier_, which is a function that, given a tag,
      will return a tag that is a subtag of the original. Applying the
      same modifier to a twice tag will return the same value (`m1(t1)
      == m1(t1)`) and applying multiple modifiers will, regardless or
      order, produce the same tag (`m1(m2(t1)) == m2(m1(t1))`).
      
      When multiple modifiers are applied to a given base tag, each
      smaller set of modifiers is registered as a parent, so that for
      example `m1(m2(m3(t1)))` is a subtype of `m1(m2(t1))`,
      `m1(m3(t1)`, and so on.
      */
      static defineModifier(name2) {
        let mod = new Modifier(name2);
        return (tag) => {
          if (tag.modified.indexOf(mod) > -1)
            return tag;
          return Modifier.get(tag.base || tag, tag.modified.concat(mod).sort((a, b) => a.id - b.id));
        };
      }
    };
    var nextModifierID = 0;
    var Modifier = class _Modifier {
      constructor(name2) {
        this.name = name2;
        this.instances = [];
        this.id = nextModifierID++;
      }
      static get(base, mods) {
        if (!mods.length)
          return base;
        let exists = mods[0].instances.find((t2) => t2.base == base && sameArray(mods, t2.modified));
        if (exists)
          return exists;
        let set = [], tag = new Tag(base.name, set, base, mods);
        for (let m of mods)
          m.instances.push(tag);
        let configs = powerSet(mods);
        for (let parent of base.set)
          if (!parent.modified.length)
            for (let config of configs)
              set.push(_Modifier.get(parent, config));
        return tag;
      }
    };
    function sameArray(a, b) {
      return a.length == b.length && a.every((x, i) => x == b[i]);
    }
    function powerSet(array) {
      let sets = [[]];
      for (let i = 0; i < array.length; i++) {
        for (let j = 0, e = sets.length; j < e; j++) {
          sets.push(sets[j].concat(array[i]));
        }
      }
      return sets.sort((a, b) => b.length - a.length);
    }
    function styleTags(spec) {
      let byName = /* @__PURE__ */ Object.create(null);
      for (let prop in spec) {
        let tags2 = spec[prop];
        if (!Array.isArray(tags2))
          tags2 = [tags2];
        for (let part of prop.split(" "))
          if (part) {
            let pieces = [], mode = 2, rest = part;
            for (let pos = 0; ; ) {
              if (rest == "..." && pos > 0 && pos + 3 == part.length) {
                mode = 1;
                break;
              }
              let m = /^"(?:[^"\\]|\\.)*?"|[^\/!]+/.exec(rest);
              if (!m)
                throw new RangeError("Invalid path: " + part);
              pieces.push(m[0] == "*" ? "" : m[0][0] == '"' ? JSON.parse(m[0]) : m[0]);
              pos += m[0].length;
              if (pos == part.length)
                break;
              let next = part[pos++];
              if (pos == part.length && next == "!") {
                mode = 0;
                break;
              }
              if (next != "/")
                throw new RangeError("Invalid path: " + part);
              rest = part.slice(pos);
            }
            let last = pieces.length - 1, inner = pieces[last];
            if (!inner)
              throw new RangeError("Invalid path: " + part);
            let rule = new Rule(tags2, mode, last > 0 ? pieces.slice(0, last) : null);
            byName[inner] = rule.sort(byName[inner]);
          }
      }
      return ruleNodeProp.add(byName);
    }
    var ruleNodeProp = new common.NodeProp({
      combine(a, b) {
        let cur, root, take;
        while (a || b) {
          if (!a || b && a.depth <= b.depth) {
            take = b;
            b = b.next;
          } else {
            take = a;
            a = a.next;
          }
          if (cur && cur.mode == take.mode && !take.context && !cur.context)
            continue;
          let copy = new Rule(take.tags, take.mode, take.context);
          if (cur)
            cur.next = copy;
          else
            root = copy;
          cur = copy;
        }
        return root;
      }
    });
    var Rule = class {
      constructor(tags2, mode, context, next) {
        this.tags = tags2;
        this.mode = mode;
        this.context = context;
        this.next = next;
      }
      get opaque() {
        return this.mode == 0;
      }
      get inherit() {
        return this.mode == 1;
      }
      sort(other) {
        if (!other || other.depth < this.depth) {
          this.next = other;
          return this;
        }
        other.next = this.sort(other.next);
        return other;
      }
      get depth() {
        return this.context ? this.context.length : 0;
      }
    };
    Rule.empty = new Rule([], 2, null);
    function tagHighlighter(tags2, options) {
      let map = /* @__PURE__ */ Object.create(null);
      for (let style of tags2) {
        if (!Array.isArray(style.tag))
          map[style.tag.id] = style.class;
        else
          for (let tag of style.tag)
            map[tag.id] = style.class;
      }
      let { scope, all = null } = options || {};
      return {
        style: (tags3) => {
          let cls = all;
          for (let tag of tags3) {
            for (let sub of tag.set) {
              let tagClass = map[sub.id];
              if (tagClass) {
                cls = cls ? cls + " " + tagClass : tagClass;
                break;
              }
            }
          }
          return cls;
        },
        scope
      };
    }
    function highlightTags(highlighters, tags2) {
      let result = null;
      for (let highlighter of highlighters) {
        let value = highlighter.style(tags2);
        if (value)
          result = result ? result + " " + value : value;
      }
      return result;
    }
    function highlightTree(tree, highlighter, putStyle, from = 0, to = tree.length) {
      let builder = new HighlightBuilder(from, Array.isArray(highlighter) ? highlighter : [highlighter], putStyle);
      builder.highlightRange(tree.cursor(), from, to, "", builder.highlighters);
      builder.flush(to);
    }
    function highlightCode(code, tree, highlighter, putText, putBreak, from = 0, to = code.length) {
      let pos = from;
      function writeTo(p, classes) {
        if (p <= pos)
          return;
        for (let text = code.slice(pos, p), i = 0; ; ) {
          let nextBreak = text.indexOf("\n", i);
          let upto = nextBreak < 0 ? text.length : nextBreak;
          if (upto > i)
            putText(text.slice(i, upto), classes);
          if (nextBreak < 0)
            break;
          putBreak();
          i = nextBreak + 1;
        }
        pos = p;
      }
      highlightTree(tree, highlighter, (from2, to2, classes) => {
        writeTo(from2, "");
        writeTo(to2, classes);
      }, from, to);
      writeTo(to, "");
    }
    var HighlightBuilder = class {
      constructor(at, highlighters, span) {
        this.at = at;
        this.highlighters = highlighters;
        this.span = span;
        this.class = "";
      }
      startSpan(at, cls) {
        if (cls != this.class) {
          this.flush(at);
          if (at > this.at)
            this.at = at;
          this.class = cls;
        }
      }
      flush(to) {
        if (to > this.at && this.class)
          this.span(this.at, to, this.class);
      }
      highlightRange(cursor, from, to, inheritedClass, highlighters) {
        let { type, from: start, to: end } = cursor;
        if (start >= to || end <= from)
          return;
        if (type.isTop)
          highlighters = this.highlighters.filter((h) => !h.scope || h.scope(type));
        let cls = inheritedClass;
        let rule = getStyleTags(cursor) || Rule.empty;
        let tagCls = highlightTags(highlighters, rule.tags);
        if (tagCls) {
          if (cls)
            cls += " ";
          cls += tagCls;
          if (rule.mode == 1)
            inheritedClass += (inheritedClass ? " " : "") + tagCls;
        }
        this.startSpan(Math.max(from, start), cls);
        if (rule.opaque)
          return;
        let mounted = cursor.tree && cursor.tree.prop(common.NodeProp.mounted);
        if (mounted && mounted.overlay) {
          let inner = cursor.node.enter(mounted.overlay[0].from + start, 1);
          let innerHighlighters = this.highlighters.filter((h) => !h.scope || h.scope(mounted.tree.type));
          let hasChild = cursor.firstChild();
          for (let i = 0, pos = start; ; i++) {
            let next = i < mounted.overlay.length ? mounted.overlay[i] : null;
            let nextPos = next ? next.from + start : end;
            let rangeFrom = Math.max(from, pos), rangeTo = Math.min(to, nextPos);
            if (rangeFrom < rangeTo && hasChild) {
              while (cursor.from < rangeTo) {
                this.highlightRange(cursor, rangeFrom, rangeTo, inheritedClass, highlighters);
                this.startSpan(Math.min(rangeTo, cursor.to), cls);
                if (cursor.to >= nextPos || !cursor.nextSibling())
                  break;
              }
            }
            if (!next || nextPos > to)
              break;
            pos = next.to + start;
            if (pos > from) {
              this.highlightRange(inner.cursor(), Math.max(from, next.from + start), Math.min(to, pos), "", innerHighlighters);
              this.startSpan(Math.min(to, pos), cls);
            }
          }
          if (hasChild)
            cursor.parent();
        } else if (cursor.firstChild()) {
          if (mounted)
            inheritedClass = "";
          do {
            if (cursor.to <= from)
              continue;
            if (cursor.from >= to)
              break;
            this.highlightRange(cursor, from, to, inheritedClass, highlighters);
            this.startSpan(Math.min(to, cursor.to), cls);
          } while (cursor.nextSibling());
          cursor.parent();
        }
      }
    };
    function getStyleTags(node) {
      let rule = node.type.prop(ruleNodeProp);
      while (rule && rule.context && !node.matchContext(rule.context))
        rule = rule.next;
      return rule || null;
    }
    var t = Tag.define;
    var comment = t();
    var name = t();
    var typeName = t(name);
    var propertyName = t(name);
    var literal = t();
    var string = t(literal);
    var number = t(literal);
    var content = t();
    var heading = t(content);
    var keyword = t();
    var operator = t();
    var punctuation = t();
    var bracket = t(punctuation);
    var meta = t();
    var tags = {
      /**
      A comment.
      */
      comment,
      /**
      A line [comment](#highlight.tags.comment).
      */
      lineComment: t(comment),
      /**
      A block [comment](#highlight.tags.comment).
      */
      blockComment: t(comment),
      /**
      A documentation [comment](#highlight.tags.comment).
      */
      docComment: t(comment),
      /**
      Any kind of identifier.
      */
      name,
      /**
      The [name](#highlight.tags.name) of a variable.
      */
      variableName: t(name),
      /**
      A type [name](#highlight.tags.name).
      */
      typeName,
      /**
      A tag name (subtag of [`typeName`](#highlight.tags.typeName)).
      */
      tagName: t(typeName),
      /**
      A property or field [name](#highlight.tags.name).
      */
      propertyName,
      /**
      An attribute name (subtag of [`propertyName`](#highlight.tags.propertyName)).
      */
      attributeName: t(propertyName),
      /**
      The [name](#highlight.tags.name) of a class.
      */
      className: t(name),
      /**
      A label [name](#highlight.tags.name).
      */
      labelName: t(name),
      /**
      A namespace [name](#highlight.tags.name).
      */
      namespace: t(name),
      /**
      The [name](#highlight.tags.name) of a macro.
      */
      macroName: t(name),
      /**
      A literal value.
      */
      literal,
      /**
      A string [literal](#highlight.tags.literal).
      */
      string,
      /**
      A documentation [string](#highlight.tags.string).
      */
      docString: t(string),
      /**
      A character literal (subtag of [string](#highlight.tags.string)).
      */
      character: t(string),
      /**
      An attribute value (subtag of [string](#highlight.tags.string)).
      */
      attributeValue: t(string),
      /**
      A number [literal](#highlight.tags.literal).
      */
      number,
      /**
      An integer [number](#highlight.tags.number) literal.
      */
      integer: t(number),
      /**
      A floating-point [number](#highlight.tags.number) literal.
      */
      float: t(number),
      /**
      A boolean [literal](#highlight.tags.literal).
      */
      bool: t(literal),
      /**
      Regular expression [literal](#highlight.tags.literal).
      */
      regexp: t(literal),
      /**
      An escape [literal](#highlight.tags.literal), for example a
      backslash escape in a string.
      */
      escape: t(literal),
      /**
      A color [literal](#highlight.tags.literal).
      */
      color: t(literal),
      /**
      A URL [literal](#highlight.tags.literal).
      */
      url: t(literal),
      /**
      A language keyword.
      */
      keyword,
      /**
      The [keyword](#highlight.tags.keyword) for the self or this
      object.
      */
      self: t(keyword),
      /**
      The [keyword](#highlight.tags.keyword) for null.
      */
      null: t(keyword),
      /**
      A [keyword](#highlight.tags.keyword) denoting some atomic value.
      */
      atom: t(keyword),
      /**
      A [keyword](#highlight.tags.keyword) that represents a unit.
      */
      unit: t(keyword),
      /**
      A modifier [keyword](#highlight.tags.keyword).
      */
      modifier: t(keyword),
      /**
      A [keyword](#highlight.tags.keyword) that acts as an operator.
      */
      operatorKeyword: t(keyword),
      /**
      A control-flow related [keyword](#highlight.tags.keyword).
      */
      controlKeyword: t(keyword),
      /**
      A [keyword](#highlight.tags.keyword) that defines something.
      */
      definitionKeyword: t(keyword),
      /**
      A [keyword](#highlight.tags.keyword) related to defining or
      interfacing with modules.
      */
      moduleKeyword: t(keyword),
      /**
      An operator.
      */
      operator,
      /**
      An [operator](#highlight.tags.operator) that dereferences something.
      */
      derefOperator: t(operator),
      /**
      Arithmetic-related [operator](#highlight.tags.operator).
      */
      arithmeticOperator: t(operator),
      /**
      Logical [operator](#highlight.tags.operator).
      */
      logicOperator: t(operator),
      /**
      Bit [operator](#highlight.tags.operator).
      */
      bitwiseOperator: t(operator),
      /**
      Comparison [operator](#highlight.tags.operator).
      */
      compareOperator: t(operator),
      /**
      [Operator](#highlight.tags.operator) that updates its operand.
      */
      updateOperator: t(operator),
      /**
      [Operator](#highlight.tags.operator) that defines something.
      */
      definitionOperator: t(operator),
      /**
      Type-related [operator](#highlight.tags.operator).
      */
      typeOperator: t(operator),
      /**
      Control-flow [operator](#highlight.tags.operator).
      */
      controlOperator: t(operator),
      /**
      Program or markup punctuation.
      */
      punctuation,
      /**
      [Punctuation](#highlight.tags.punctuation) that separates
      things.
      */
      separator: t(punctuation),
      /**
      Bracket-style [punctuation](#highlight.tags.punctuation).
      */
      bracket,
      /**
      Angle [brackets](#highlight.tags.bracket) (usually `<` and `>`
      tokens).
      */
      angleBracket: t(bracket),
      /**
      Square [brackets](#highlight.tags.bracket) (usually `[` and `]`
      tokens).
      */
      squareBracket: t(bracket),
      /**
      Parentheses (usually `(` and `)` tokens). Subtag of
      [bracket](#highlight.tags.bracket).
      */
      paren: t(bracket),
      /**
      Braces (usually `{` and `}` tokens). Subtag of
      [bracket](#highlight.tags.bracket).
      */
      brace: t(bracket),
      /**
      Content, for example plain text in XML or markup documents.
      */
      content,
      /**
      [Content](#highlight.tags.content) that represents a heading.
      */
      heading,
      /**
      A level 1 [heading](#highlight.tags.heading).
      */
      heading1: t(heading),
      /**
      A level 2 [heading](#highlight.tags.heading).
      */
      heading2: t(heading),
      /**
      A level 3 [heading](#highlight.tags.heading).
      */
      heading3: t(heading),
      /**
      A level 4 [heading](#highlight.tags.heading).
      */
      heading4: t(heading),
      /**
      A level 5 [heading](#highlight.tags.heading).
      */
      heading5: t(heading),
      /**
      A level 6 [heading](#highlight.tags.heading).
      */
      heading6: t(heading),
      /**
      A prose [content](#highlight.tags.content) separator (such as a horizontal rule).
      */
      contentSeparator: t(content),
      /**
      [Content](#highlight.tags.content) that represents a list.
      */
      list: t(content),
      /**
      [Content](#highlight.tags.content) that represents a quote.
      */
      quote: t(content),
      /**
      [Content](#highlight.tags.content) that is emphasized.
      */
      emphasis: t(content),
      /**
      [Content](#highlight.tags.content) that is styled strong.
      */
      strong: t(content),
      /**
      [Content](#highlight.tags.content) that is part of a link.
      */
      link: t(content),
      /**
      [Content](#highlight.tags.content) that is styled as code or
      monospace.
      */
      monospace: t(content),
      /**
      [Content](#highlight.tags.content) that has a strike-through
      style.
      */
      strikethrough: t(content),
      /**
      Inserted text in a change-tracking format.
      */
      inserted: t(),
      /**
      Deleted text.
      */
      deleted: t(),
      /**
      Changed text.
      */
      changed: t(),
      /**
      An invalid or unsyntactic element.
      */
      invalid: t(),
      /**
      Metadata or meta-instruction.
      */
      meta,
      /**
      [Metadata](#highlight.tags.meta) that applies to the entire
      document.
      */
      documentMeta: t(meta),
      /**
      [Metadata](#highlight.tags.meta) that annotates or adds
      attributes to a given syntactic element.
      */
      annotation: t(meta),
      /**
      Processing instruction or preprocessor directive. Subtag of
      [meta](#highlight.tags.meta).
      */
      processingInstruction: t(meta),
      /**
      [Modifier](#highlight.Tag^defineModifier) that indicates that a
      given element is being defined. Expected to be used with the
      various [name](#highlight.tags.name) tags.
      */
      definition: Tag.defineModifier("definition"),
      /**
      [Modifier](#highlight.Tag^defineModifier) that indicates that
      something is constant. Mostly expected to be used with
      [variable names](#highlight.tags.variableName).
      */
      constant: Tag.defineModifier("constant"),
      /**
      [Modifier](#highlight.Tag^defineModifier) used to indicate that
      a [variable](#highlight.tags.variableName) or [property
      name](#highlight.tags.propertyName) is being called or defined
      as a function.
      */
      function: Tag.defineModifier("function"),
      /**
      [Modifier](#highlight.Tag^defineModifier) that can be applied to
      [names](#highlight.tags.name) to indicate that they belong to
      the language's standard environment.
      */
      standard: Tag.defineModifier("standard"),
      /**
      [Modifier](#highlight.Tag^defineModifier) that indicates a given
      [names](#highlight.tags.name) is local to some scope.
      */
      local: Tag.defineModifier("local"),
      /**
      A generic variant [modifier](#highlight.Tag^defineModifier) that
      can be used to tag language-specific alternative variants of
      some common tag. It is recommended for themes to define special
      forms of at least the [string](#highlight.tags.string) and
      [variable name](#highlight.tags.variableName) tags, since those
      come up a lot.
      */
      special: Tag.defineModifier("special")
    };
    for (let name2 in tags) {
      let val = tags[name2];
      if (val instanceof Tag)
        val.name = name2;
    }
    var classHighlighter = tagHighlighter([
      { tag: tags.link, class: "tok-link" },
      { tag: tags.heading, class: "tok-heading" },
      { tag: tags.emphasis, class: "tok-emphasis" },
      { tag: tags.strong, class: "tok-strong" },
      { tag: tags.keyword, class: "tok-keyword" },
      { tag: tags.atom, class: "tok-atom" },
      { tag: tags.bool, class: "tok-bool" },
      { tag: tags.url, class: "tok-url" },
      { tag: tags.labelName, class: "tok-labelName" },
      { tag: tags.inserted, class: "tok-inserted" },
      { tag: tags.deleted, class: "tok-deleted" },
      { tag: tags.literal, class: "tok-literal" },
      { tag: tags.string, class: "tok-string" },
      { tag: tags.number, class: "tok-number" },
      { tag: [tags.regexp, tags.escape, tags.special(tags.string)], class: "tok-string2" },
      { tag: tags.variableName, class: "tok-variableName" },
      { tag: tags.local(tags.variableName), class: "tok-variableName tok-local" },
      { tag: tags.definition(tags.variableName), class: "tok-variableName tok-definition" },
      { tag: tags.special(tags.variableName), class: "tok-variableName2" },
      { tag: tags.definition(tags.propertyName), class: "tok-propertyName tok-definition" },
      { tag: tags.typeName, class: "tok-typeName" },
      { tag: tags.namespace, class: "tok-namespace" },
      { tag: tags.className, class: "tok-className" },
      { tag: tags.macroName, class: "tok-macroName" },
      { tag: tags.propertyName, class: "tok-propertyName" },
      { tag: tags.operator, class: "tok-operator" },
      { tag: tags.comment, class: "tok-comment" },
      { tag: tags.meta, class: "tok-meta" },
      { tag: tags.invalid, class: "tok-invalid" },
      { tag: tags.punctuation, class: "tok-punctuation" }
    ]);
    exports2.Tag = Tag;
    exports2.classHighlighter = classHighlighter;
    exports2.getStyleTags = getStyleTags;
    exports2.highlightCode = highlightCode;
    exports2.highlightTree = highlightTree;
    exports2.styleTags = styleTags;
    exports2.tagHighlighter = tagHighlighter;
    exports2.tags = tags;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/markdown/dist/index.cjs
var require_dist3 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/@lezer/markdown/dist/index.cjs"(exports2) {
    "use strict";
    var common = require_dist();
    var highlight = require_dist2();
    var CompositeBlock = class _CompositeBlock {
      static create(type, value, from, parentHash, end) {
        let hash = parentHash + (parentHash << 8) + type + (value << 4) | 0;
        return new _CompositeBlock(type, value, from, hash, end, [], []);
      }
      constructor(type, value, from, hash, end, children, positions) {
        this.type = type;
        this.value = value;
        this.from = from;
        this.hash = hash;
        this.end = end;
        this.children = children;
        this.positions = positions;
        this.hashProp = [[common.NodeProp.contextHash, hash]];
      }
      addChild(child, pos) {
        if (child.prop(common.NodeProp.contextHash) != this.hash)
          child = new common.Tree(child.type, child.children, child.positions, child.length, this.hashProp);
        this.children.push(child);
        this.positions.push(pos);
      }
      toTree(nodeSet, end = this.end) {
        let last = this.children.length - 1;
        if (last >= 0)
          end = Math.max(end, this.positions[last] + this.children[last].length + this.from);
        return new common.Tree(nodeSet.types[this.type], this.children, this.positions, end - this.from).balance({
          makeTree: (children, positions, length) => new common.Tree(common.NodeType.none, children, positions, length, this.hashProp)
        });
      }
    };
    var Type;
    (function(Type2) {
      Type2[Type2["Document"] = 1] = "Document";
      Type2[Type2["CodeBlock"] = 2] = "CodeBlock";
      Type2[Type2["FencedCode"] = 3] = "FencedCode";
      Type2[Type2["Blockquote"] = 4] = "Blockquote";
      Type2[Type2["HorizontalRule"] = 5] = "HorizontalRule";
      Type2[Type2["BulletList"] = 6] = "BulletList";
      Type2[Type2["OrderedList"] = 7] = "OrderedList";
      Type2[Type2["ListItem"] = 8] = "ListItem";
      Type2[Type2["ATXHeading1"] = 9] = "ATXHeading1";
      Type2[Type2["ATXHeading2"] = 10] = "ATXHeading2";
      Type2[Type2["ATXHeading3"] = 11] = "ATXHeading3";
      Type2[Type2["ATXHeading4"] = 12] = "ATXHeading4";
      Type2[Type2["ATXHeading5"] = 13] = "ATXHeading5";
      Type2[Type2["ATXHeading6"] = 14] = "ATXHeading6";
      Type2[Type2["SetextHeading1"] = 15] = "SetextHeading1";
      Type2[Type2["SetextHeading2"] = 16] = "SetextHeading2";
      Type2[Type2["HTMLBlock"] = 17] = "HTMLBlock";
      Type2[Type2["LinkReference"] = 18] = "LinkReference";
      Type2[Type2["Paragraph"] = 19] = "Paragraph";
      Type2[Type2["CommentBlock"] = 20] = "CommentBlock";
      Type2[Type2["ProcessingInstructionBlock"] = 21] = "ProcessingInstructionBlock";
      Type2[Type2["Escape"] = 22] = "Escape";
      Type2[Type2["Entity"] = 23] = "Entity";
      Type2[Type2["HardBreak"] = 24] = "HardBreak";
      Type2[Type2["Emphasis"] = 25] = "Emphasis";
      Type2[Type2["StrongEmphasis"] = 26] = "StrongEmphasis";
      Type2[Type2["Link"] = 27] = "Link";
      Type2[Type2["Image"] = 28] = "Image";
      Type2[Type2["InlineCode"] = 29] = "InlineCode";
      Type2[Type2["HTMLTag"] = 30] = "HTMLTag";
      Type2[Type2["Comment"] = 31] = "Comment";
      Type2[Type2["ProcessingInstruction"] = 32] = "ProcessingInstruction";
      Type2[Type2["Autolink"] = 33] = "Autolink";
      Type2[Type2["HeaderMark"] = 34] = "HeaderMark";
      Type2[Type2["QuoteMark"] = 35] = "QuoteMark";
      Type2[Type2["ListMark"] = 36] = "ListMark";
      Type2[Type2["LinkMark"] = 37] = "LinkMark";
      Type2[Type2["EmphasisMark"] = 38] = "EmphasisMark";
      Type2[Type2["CodeMark"] = 39] = "CodeMark";
      Type2[Type2["CodeText"] = 40] = "CodeText";
      Type2[Type2["CodeInfo"] = 41] = "CodeInfo";
      Type2[Type2["LinkTitle"] = 42] = "LinkTitle";
      Type2[Type2["LinkLabel"] = 43] = "LinkLabel";
      Type2[Type2["URL"] = 44] = "URL";
    })(Type || (Type = {}));
    var LeafBlock = class {
      /**
      @internal
      */
      constructor(start, content) {
        this.start = start;
        this.content = content;
        this.marks = [];
        this.parsers = [];
      }
    };
    var Line = class {
      constructor() {
        this.text = "";
        this.baseIndent = 0;
        this.basePos = 0;
        this.depth = 0;
        this.markers = [];
        this.pos = 0;
        this.indent = 0;
        this.next = -1;
      }
      /**
      @internal
      */
      forward() {
        if (this.basePos > this.pos)
          this.forwardInner();
      }
      /**
      @internal
      */
      forwardInner() {
        let newPos = this.skipSpace(this.basePos);
        this.indent = this.countIndent(newPos, this.pos, this.indent);
        this.pos = newPos;
        this.next = newPos == this.text.length ? -1 : this.text.charCodeAt(newPos);
      }
      /**
      Skip whitespace after the given position, return the position of
      the next non-space character or the end of the line if there's
      only space after `from`.
      */
      skipSpace(from) {
        return skipSpace(this.text, from);
      }
      /**
      @internal
      */
      reset(text) {
        this.text = text;
        this.baseIndent = this.basePos = this.pos = this.indent = 0;
        this.forwardInner();
        this.depth = 1;
        while (this.markers.length)
          this.markers.pop();
      }
      /**
      Move the line's base position forward to the given position.
      This should only be called by composite [block
      parsers](#BlockParser.parse) or [markup skipping
      functions](#NodeSpec.composite).
      */
      moveBase(to) {
        this.basePos = to;
        this.baseIndent = this.countIndent(to, this.pos, this.indent);
      }
      /**
      Move the line's base position forward to the given _column_.
      */
      moveBaseColumn(indent) {
        this.baseIndent = indent;
        this.basePos = this.findColumn(indent);
      }
      /**
      Store a composite-block-level marker. Should be called from
      [markup skipping functions](#NodeSpec.composite) when they
      consume any non-whitespace characters.
      */
      addMarker(elt2) {
        this.markers.push(elt2);
      }
      /**
      Find the column position at `to`, optionally starting at a given
      position and column.
      */
      countIndent(to, from = 0, indent = 0) {
        for (let i = from; i < to; i++)
          indent += this.text.charCodeAt(i) == 9 ? 4 - indent % 4 : 1;
        return indent;
      }
      /**
      Find the position corresponding to the given column.
      */
      findColumn(goal) {
        let i = 0;
        for (let indent = 0; i < this.text.length && indent < goal; i++)
          indent += this.text.charCodeAt(i) == 9 ? 4 - indent % 4 : 1;
        return i;
      }
      /**
      @internal
      */
      scrub() {
        if (!this.baseIndent)
          return this.text;
        let result = "";
        for (let i = 0; i < this.basePos; i++)
          result += " ";
        return result + this.text.slice(this.basePos);
      }
    };
    function skipForList(bl, cx, line) {
      if (line.pos == line.text.length || bl != cx.block && line.indent >= cx.stack[line.depth + 1].value + line.baseIndent)
        return true;
      if (line.indent >= line.baseIndent + 4)
        return false;
      let size = (bl.type == Type.OrderedList ? isOrderedList : isBulletList)(line, cx, false);
      return size > 0 && (bl.type != Type.BulletList || isHorizontalRule(line, cx, false) < 0) && line.text.charCodeAt(line.pos + size - 1) == bl.value;
    }
    var DefaultSkipMarkup = {
      [Type.Blockquote](bl, cx, line) {
        if (line.next != 62)
          return false;
        line.markers.push(elt(Type.QuoteMark, cx.lineStart + line.pos, cx.lineStart + line.pos + 1));
        line.moveBase(line.pos + (space(line.text.charCodeAt(line.pos + 1)) ? 2 : 1));
        bl.end = cx.lineStart + line.text.length;
        return true;
      },
      [Type.ListItem](bl, _cx, line) {
        if (line.indent < line.baseIndent + bl.value && line.next > -1)
          return false;
        line.moveBaseColumn(line.baseIndent + bl.value);
        return true;
      },
      [Type.OrderedList]: skipForList,
      [Type.BulletList]: skipForList,
      [Type.Document]() {
        return true;
      }
    };
    function space(ch) {
      return ch == 32 || ch == 9 || ch == 10 || ch == 13;
    }
    function skipSpace(line, i = 0) {
      while (i < line.length && space(line.charCodeAt(i)))
        i++;
      return i;
    }
    function skipSpaceBack(line, i, to) {
      while (i > to && space(line.charCodeAt(i - 1)))
        i--;
      return i;
    }
    function isFencedCode(line) {
      if (line.next != 96 && line.next != 126)
        return -1;
      let pos = line.pos + 1;
      while (pos < line.text.length && line.text.charCodeAt(pos) == line.next)
        pos++;
      if (pos < line.pos + 3)
        return -1;
      if (line.next == 96) {
        for (let i = pos; i < line.text.length; i++)
          if (line.text.charCodeAt(i) == 96)
            return -1;
      }
      return pos;
    }
    function isBlockquote(line) {
      return line.next != 62 ? -1 : line.text.charCodeAt(line.pos + 1) == 32 ? 2 : 1;
    }
    function isHorizontalRule(line, cx, breaking) {
      if (line.next != 42 && line.next != 45 && line.next != 95)
        return -1;
      let count2 = 1;
      for (let pos = line.pos + 1; pos < line.text.length; pos++) {
        let ch = line.text.charCodeAt(pos);
        if (ch == line.next)
          count2++;
        else if (!space(ch))
          return -1;
      }
      if (breaking && line.next == 45 && isSetextUnderline(line) > -1 && line.depth == cx.stack.length && cx.parser.leafBlockParsers.indexOf(DefaultLeafBlocks.SetextHeading) > -1)
        return -1;
      return count2 < 3 ? -1 : 1;
    }
    function inList(cx, type) {
      for (let i = cx.stack.length - 1; i >= 0; i--)
        if (cx.stack[i].type == type)
          return true;
      return false;
    }
    function isBulletList(line, cx, breaking) {
      return (line.next == 45 || line.next == 43 || line.next == 42) && (line.pos == line.text.length - 1 || space(line.text.charCodeAt(line.pos + 1))) && (!breaking || inList(cx, Type.BulletList) || line.skipSpace(line.pos + 2) < line.text.length) ? 1 : -1;
    }
    function isOrderedList(line, cx, breaking) {
      let pos = line.pos, next = line.next;
      for (; ; ) {
        if (next >= 48 && next <= 57)
          pos++;
        else
          break;
        if (pos == line.text.length)
          return -1;
        next = line.text.charCodeAt(pos);
      }
      if (pos == line.pos || pos > line.pos + 9 || next != 46 && next != 41 || pos < line.text.length - 1 && !space(line.text.charCodeAt(pos + 1)) || breaking && !inList(cx, Type.OrderedList) && (line.skipSpace(pos + 1) == line.text.length || pos > line.pos + 1 || line.next != 49))
        return -1;
      return pos + 1 - line.pos;
    }
    function isAtxHeading(line) {
      if (line.next != 35)
        return -1;
      let pos = line.pos + 1;
      while (pos < line.text.length && line.text.charCodeAt(pos) == 35)
        pos++;
      if (pos < line.text.length && line.text.charCodeAt(pos) != 32)
        return -1;
      let size = pos - line.pos;
      return size > 6 ? -1 : size;
    }
    function isSetextUnderline(line) {
      if (line.next != 45 && line.next != 61 || line.indent >= line.baseIndent + 4)
        return -1;
      let pos = line.pos + 1;
      while (pos < line.text.length && line.text.charCodeAt(pos) == line.next)
        pos++;
      let end = pos;
      while (pos < line.text.length && space(line.text.charCodeAt(pos)))
        pos++;
      return pos == line.text.length ? end : -1;
    }
    var EmptyLine = /^[ \t]*$/;
    var CommentEnd = /-->/;
    var ProcessingEnd = /\?>/;
    var HTMLBlockStyle = [
      [/^<(?:script|pre|style)(?:\s|>|$)/i, /<\/(?:script|pre|style)>/i],
      [/^\s*<!--/, CommentEnd],
      [/^\s*<\?/, ProcessingEnd],
      [/^\s*<![A-Z]/, />/],
      [/^\s*<!\[CDATA\[/, /\]\]>/],
      [/^\s*<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i, EmptyLine],
      [/^\s*(?:<\/[a-z][\w-]*\s*>|<[a-z][\w-]*(\s+[a-z:_][\w-.]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*>)\s*$/i, EmptyLine]
    ];
    function isHTMLBlock(line, _cx, breaking) {
      if (line.next != 60)
        return -1;
      let rest = line.text.slice(line.pos);
      for (let i = 0, e = HTMLBlockStyle.length - (breaking ? 1 : 0); i < e; i++)
        if (HTMLBlockStyle[i][0].test(rest))
          return i;
      return -1;
    }
    function getListIndent(line, pos) {
      let indentAfter = line.countIndent(pos, line.pos, line.indent);
      let indented = line.countIndent(line.skipSpace(pos), pos, indentAfter);
      return indented >= indentAfter + 5 ? indentAfter + 1 : indented;
    }
    function addCodeText(marks, from, to) {
      let last = marks.length - 1;
      if (last >= 0 && marks[last].to == from && marks[last].type == Type.CodeText)
        marks[last].to = to;
      else
        marks.push(elt(Type.CodeText, from, to));
    }
    var DefaultBlockParsers = {
      LinkReference: void 0,
      IndentedCode(cx, line) {
        let base = line.baseIndent + 4;
        if (line.indent < base)
          return false;
        let start = line.findColumn(base);
        let from = cx.lineStart + start, to = cx.lineStart + line.text.length;
        let marks = [], pendingMarks = [];
        addCodeText(marks, from, to);
        while (cx.nextLine() && line.depth >= cx.stack.length) {
          if (line.pos == line.text.length) {
            addCodeText(pendingMarks, cx.lineStart - 1, cx.lineStart);
            for (let m of line.markers)
              pendingMarks.push(m);
          } else if (line.indent < base) {
            break;
          } else {
            if (pendingMarks.length) {
              for (let m of pendingMarks) {
                if (m.type == Type.CodeText)
                  addCodeText(marks, m.from, m.to);
                else
                  marks.push(m);
              }
              pendingMarks = [];
            }
            addCodeText(marks, cx.lineStart - 1, cx.lineStart);
            for (let m of line.markers)
              marks.push(m);
            to = cx.lineStart + line.text.length;
            let codeStart = cx.lineStart + line.findColumn(line.baseIndent + 4);
            if (codeStart < to)
              addCodeText(marks, codeStart, to);
          }
        }
        if (pendingMarks.length) {
          pendingMarks = pendingMarks.filter((m) => m.type != Type.CodeText);
          if (pendingMarks.length)
            line.markers = pendingMarks.concat(line.markers);
        }
        cx.addNode(cx.buffer.writeElements(marks, -from).finish(Type.CodeBlock, to - from), from);
        return true;
      },
      FencedCode(cx, line) {
        let fenceEnd = isFencedCode(line);
        if (fenceEnd < 0)
          return false;
        let from = cx.lineStart + line.pos, ch = line.next, len = fenceEnd - line.pos;
        let infoFrom = line.skipSpace(fenceEnd), infoTo = skipSpaceBack(line.text, line.text.length, infoFrom);
        let marks = [elt(Type.CodeMark, from, from + len)];
        if (infoFrom < infoTo)
          marks.push(elt(Type.CodeInfo, cx.lineStart + infoFrom, cx.lineStart + infoTo));
        for (let first = true, empty = true, hasLine = false; cx.nextLine() && line.depth >= cx.stack.length; first = false) {
          let i = line.pos;
          if (line.indent - line.baseIndent < 4)
            while (i < line.text.length && line.text.charCodeAt(i) == ch)
              i++;
          if (i - line.pos >= len && line.skipSpace(i) == line.text.length) {
            for (let m of line.markers)
              marks.push(m);
            if (empty && hasLine)
              addCodeText(marks, cx.lineStart - 1, cx.lineStart);
            marks.push(elt(Type.CodeMark, cx.lineStart + line.pos, cx.lineStart + i));
            cx.nextLine();
            break;
          } else {
            hasLine = true;
            if (!first) {
              addCodeText(marks, cx.lineStart - 1, cx.lineStart);
              empty = false;
            }
            for (let m of line.markers)
              marks.push(m);
            let textStart = cx.lineStart + line.basePos, textEnd = cx.lineStart + line.text.length;
            if (textStart < textEnd) {
              addCodeText(marks, textStart, textEnd);
              empty = false;
            }
          }
        }
        cx.addNode(cx.buffer.writeElements(marks, -from).finish(Type.FencedCode, cx.prevLineEnd() - from), from);
        return true;
      },
      Blockquote(cx, line) {
        let size = isBlockquote(line);
        if (size < 0)
          return false;
        cx.startContext(Type.Blockquote, line.pos);
        cx.addNode(Type.QuoteMark, cx.lineStart + line.pos, cx.lineStart + line.pos + 1);
        line.moveBase(line.pos + size);
        return null;
      },
      HorizontalRule(cx, line) {
        if (isHorizontalRule(line, cx, false) < 0)
          return false;
        let from = cx.lineStart + line.pos;
        cx.nextLine();
        cx.addNode(Type.HorizontalRule, from);
        return true;
      },
      BulletList(cx, line) {
        let size = isBulletList(line, cx, false);
        if (size < 0)
          return false;
        if (cx.block.type != Type.BulletList)
          cx.startContext(Type.BulletList, line.basePos, line.next);
        let newBase = getListIndent(line, line.pos + 1);
        cx.startContext(Type.ListItem, line.basePos, newBase - line.baseIndent);
        cx.addNode(Type.ListMark, cx.lineStart + line.pos, cx.lineStart + line.pos + size);
        line.moveBaseColumn(newBase);
        return null;
      },
      OrderedList(cx, line) {
        let size = isOrderedList(line, cx, false);
        if (size < 0)
          return false;
        if (cx.block.type != Type.OrderedList)
          cx.startContext(Type.OrderedList, line.basePos, line.text.charCodeAt(line.pos + size - 1));
        let newBase = getListIndent(line, line.pos + size);
        cx.startContext(Type.ListItem, line.basePos, newBase - line.baseIndent);
        cx.addNode(Type.ListMark, cx.lineStart + line.pos, cx.lineStart + line.pos + size);
        line.moveBaseColumn(newBase);
        return null;
      },
      ATXHeading(cx, line) {
        let size = isAtxHeading(line);
        if (size < 0)
          return false;
        let off = line.pos, from = cx.lineStart + off;
        let endOfSpace = skipSpaceBack(line.text, line.text.length, off), after = endOfSpace;
        while (after > off && line.text.charCodeAt(after - 1) == line.next)
          after--;
        if (after == endOfSpace || after == off || !space(line.text.charCodeAt(after - 1)))
          after = line.text.length;
        let buf = cx.buffer.write(Type.HeaderMark, 0, size).writeElements(cx.parser.parseInline(line.text.slice(off + size + 1, after), from + size + 1), -from);
        if (after < line.text.length)
          buf.write(Type.HeaderMark, after - off, endOfSpace - off);
        let node = buf.finish(Type.ATXHeading1 - 1 + size, line.text.length - off);
        cx.nextLine();
        cx.addNode(node, from);
        return true;
      },
      HTMLBlock(cx, line) {
        let type = isHTMLBlock(line, cx, false);
        if (type < 0)
          return false;
        let from = cx.lineStart + line.pos, end = HTMLBlockStyle[type][1];
        let marks = [], trailing = end != EmptyLine;
        while (!end.test(line.text) && cx.nextLine()) {
          if (line.depth < cx.stack.length) {
            trailing = false;
            break;
          }
          for (let m of line.markers)
            marks.push(m);
        }
        if (trailing)
          cx.nextLine();
        let nodeType = end == CommentEnd ? Type.CommentBlock : end == ProcessingEnd ? Type.ProcessingInstructionBlock : Type.HTMLBlock;
        let to = cx.prevLineEnd();
        cx.addNode(cx.buffer.writeElements(marks, -from).finish(nodeType, to - from), from);
        return true;
      },
      SetextHeading: void 0
      // Specifies relative precedence for block-continue function
    };
    var LinkReferenceParser = class {
      constructor(leaf) {
        this.stage = 0;
        this.elts = [];
        this.pos = 0;
        this.start = leaf.start;
        this.advance(leaf.content);
      }
      nextLine(cx, line, leaf) {
        if (this.stage == -1)
          return false;
        let content = leaf.content + "\n" + line.scrub();
        let finish = this.advance(content);
        if (finish > -1 && finish < content.length)
          return this.complete(cx, leaf, finish);
        return false;
      }
      finish(cx, leaf) {
        if ((this.stage == 2 || this.stage == 3) && skipSpace(leaf.content, this.pos) == leaf.content.length)
          return this.complete(cx, leaf, leaf.content.length);
        return false;
      }
      complete(cx, leaf, len) {
        cx.addLeafElement(leaf, elt(Type.LinkReference, this.start, this.start + len, this.elts));
        return true;
      }
      nextStage(elt2) {
        if (elt2) {
          this.pos = elt2.to - this.start;
          this.elts.push(elt2);
          this.stage++;
          return true;
        }
        if (elt2 === false)
          this.stage = -1;
        return false;
      }
      advance(content) {
        for (; ; ) {
          if (this.stage == -1) {
            return -1;
          } else if (this.stage == 0) {
            if (!this.nextStage(parseLinkLabel(content, this.pos, this.start, true)))
              return -1;
            if (content.charCodeAt(this.pos) != 58)
              return this.stage = -1;
            this.elts.push(elt(Type.LinkMark, this.pos + this.start, this.pos + this.start + 1));
            this.pos++;
          } else if (this.stage == 1) {
            if (!this.nextStage(parseURL(content, skipSpace(content, this.pos), this.start)))
              return -1;
          } else if (this.stage == 2) {
            let skip = skipSpace(content, this.pos), end = 0;
            if (skip > this.pos) {
              let title = parseLinkTitle(content, skip, this.start);
              if (title) {
                let titleEnd = lineEnd(content, title.to - this.start);
                if (titleEnd > 0) {
                  this.nextStage(title);
                  end = titleEnd;
                }
              }
            }
            if (!end)
              end = lineEnd(content, this.pos);
            return end > 0 && end < content.length ? end : -1;
          } else {
            return lineEnd(content, this.pos);
          }
        }
      }
    };
    function lineEnd(text, pos) {
      for (; pos < text.length; pos++) {
        let next = text.charCodeAt(pos);
        if (next == 10)
          break;
        if (!space(next))
          return -1;
      }
      return pos;
    }
    var SetextHeadingParser = class {
      nextLine(cx, line, leaf) {
        let underline = line.depth < cx.stack.length ? -1 : isSetextUnderline(line);
        let next = line.next;
        if (underline < 0)
          return false;
        let underlineMark = elt(Type.HeaderMark, cx.lineStart + line.pos, cx.lineStart + underline);
        cx.nextLine();
        cx.addLeafElement(leaf, elt(next == 61 ? Type.SetextHeading1 : Type.SetextHeading2, leaf.start, cx.prevLineEnd(), [
          ...cx.parser.parseInline(leaf.content, leaf.start),
          underlineMark
        ]));
        return true;
      }
      finish() {
        return false;
      }
    };
    var DefaultLeafBlocks = {
      LinkReference(_, leaf) {
        return leaf.content.charCodeAt(0) == 91 ? new LinkReferenceParser(leaf) : null;
      },
      SetextHeading() {
        return new SetextHeadingParser();
      }
    };
    var DefaultEndLeaf = [
      (_, line) => isAtxHeading(line) >= 0,
      (_, line) => isFencedCode(line) >= 0,
      (_, line) => isBlockquote(line) >= 0,
      (p, line) => isBulletList(line, p, true) >= 0,
      (p, line) => isOrderedList(line, p, true) >= 0,
      (p, line) => isHorizontalRule(line, p, true) >= 0,
      (p, line) => isHTMLBlock(line, p, true) >= 0
    ];
    var scanLineResult = { text: "", end: 0 };
    var BlockContext = class {
      /**
      @internal
      */
      constructor(parser2, input, fragments, ranges) {
        this.parser = parser2;
        this.input = input;
        this.ranges = ranges;
        this.line = new Line();
        this.atEnd = false;
        this.reusePlaceholders = /* @__PURE__ */ new Map();
        this.stoppedAt = null;
        this.rangeI = 0;
        this.to = ranges[ranges.length - 1].to;
        this.lineStart = this.absoluteLineStart = this.absoluteLineEnd = ranges[0].from;
        this.block = CompositeBlock.create(Type.Document, 0, this.lineStart, 0, 0);
        this.stack = [this.block];
        this.fragments = fragments.length ? new FragmentCursor(fragments, input) : null;
        this.readLine();
      }
      get parsedPos() {
        return this.absoluteLineStart;
      }
      advance() {
        if (this.stoppedAt != null && this.absoluteLineStart > this.stoppedAt)
          return this.finish();
        let { line } = this;
        for (; ; ) {
          for (let markI = 0; ; ) {
            let next = line.depth < this.stack.length ? this.stack[this.stack.length - 1] : null;
            while (markI < line.markers.length && (!next || line.markers[markI].from < next.end)) {
              let mark = line.markers[markI++];
              this.addNode(mark.type, mark.from, mark.to);
            }
            if (!next)
              break;
            this.finishContext();
          }
          if (line.pos < line.text.length)
            break;
          if (!this.nextLine())
            return this.finish();
        }
        if (this.fragments && this.reuseFragment(line.basePos))
          return null;
        start: for (; ; ) {
          for (let type of this.parser.blockParsers)
            if (type) {
              let result = type(this, line);
              if (result != false) {
                if (result == true)
                  return null;
                line.forward();
                continue start;
              }
            }
          break;
        }
        let leaf = new LeafBlock(this.lineStart + line.pos, line.text.slice(line.pos));
        for (let parse of this.parser.leafBlockParsers)
          if (parse) {
            let parser2 = parse(this, leaf);
            if (parser2)
              leaf.parsers.push(parser2);
          }
        lines: while (this.nextLine()) {
          if (line.pos == line.text.length)
            break;
          if (line.indent < line.baseIndent + 4) {
            for (let stop of this.parser.endLeafBlock)
              if (stop(this, line, leaf))
                break lines;
          }
          for (let parser2 of leaf.parsers)
            if (parser2.nextLine(this, line, leaf))
              return null;
          leaf.content += "\n" + line.scrub();
          for (let m of line.markers)
            leaf.marks.push(m);
        }
        this.finishLeaf(leaf);
        return null;
      }
      stopAt(pos) {
        if (this.stoppedAt != null && this.stoppedAt < pos)
          throw new RangeError("Can't move stoppedAt forward");
        this.stoppedAt = pos;
      }
      reuseFragment(start) {
        if (!this.fragments.moveTo(this.absoluteLineStart + start, this.absoluteLineStart) || !this.fragments.matches(this.block.hash))
          return false;
        let taken = this.fragments.takeNodes(this);
        if (!taken)
          return false;
        this.absoluteLineStart += taken;
        this.lineStart = toRelative(this.absoluteLineStart, this.ranges);
        this.moveRangeI();
        if (this.absoluteLineStart < this.to) {
          this.lineStart++;
          this.absoluteLineStart++;
          this.readLine();
        } else {
          this.atEnd = true;
          this.readLine();
        }
        return true;
      }
      /**
      The number of parent blocks surrounding the current block.
      */
      get depth() {
        return this.stack.length;
      }
      /**
      Get the type of the parent block at the given depth. When no
      depth is passed, return the type of the innermost parent.
      */
      parentType(depth = this.depth - 1) {
        return this.parser.nodeSet.types[this.stack[depth].type];
      }
      /**
      Move to the next input line. This should only be called by
      (non-composite) [block parsers](#BlockParser.parse) that consume
      the line directly, or leaf block parser
      [`nextLine`](#LeafBlockParser.nextLine) methods when they
      consume the current line (and return true).
      */
      nextLine() {
        this.lineStart += this.line.text.length;
        if (this.absoluteLineEnd >= this.to) {
          this.absoluteLineStart = this.absoluteLineEnd;
          this.atEnd = true;
          this.readLine();
          return false;
        } else {
          this.lineStart++;
          this.absoluteLineStart = this.absoluteLineEnd + 1;
          this.moveRangeI();
          this.readLine();
          return true;
        }
      }
      /**
      Retrieve the text of the line after the current one, without
      actually moving the context's current line forward.
      */
      peekLine() {
        return this.scanLine(this.absoluteLineEnd + 1).text;
      }
      moveRangeI() {
        while (this.rangeI < this.ranges.length - 1 && this.absoluteLineStart >= this.ranges[this.rangeI].to) {
          this.rangeI++;
          this.absoluteLineStart = Math.max(this.absoluteLineStart, this.ranges[this.rangeI].from);
        }
      }
      /**
      @internal
      Collect the text for the next line.
      */
      scanLine(start) {
        let r = scanLineResult;
        r.end = start;
        if (start >= this.to) {
          r.text = "";
        } else {
          r.text = this.lineChunkAt(start);
          r.end += r.text.length;
          if (this.ranges.length > 1) {
            let textOffset = this.absoluteLineStart, rangeI = this.rangeI;
            while (this.ranges[rangeI].to < r.end) {
              rangeI++;
              let nextFrom = this.ranges[rangeI].from;
              let after = this.lineChunkAt(nextFrom);
              r.end = nextFrom + after.length;
              r.text = r.text.slice(0, this.ranges[rangeI - 1].to - textOffset) + after;
              textOffset = r.end - r.text.length;
            }
          }
        }
        return r;
      }
      /**
      @internal
      Populate this.line with the content of the next line. Skip
      leading characters covered by composite blocks.
      */
      readLine() {
        let { line } = this, { text, end } = this.scanLine(this.absoluteLineStart);
        this.absoluteLineEnd = end;
        line.reset(text);
        for (; line.depth < this.stack.length; line.depth++) {
          let cx = this.stack[line.depth], handler = this.parser.skipContextMarkup[cx.type];
          if (!handler)
            throw new Error("Unhandled block context " + Type[cx.type]);
          let marks = this.line.markers.length;
          if (!handler(cx, this, line)) {
            if (this.line.markers.length > marks)
              cx.end = this.line.markers[this.line.markers.length - 1].to;
            line.forward();
            break;
          }
          line.forward();
        }
      }
      lineChunkAt(pos) {
        let next = this.input.chunk(pos), text;
        if (!this.input.lineChunks) {
          let eol = next.indexOf("\n");
          text = eol < 0 ? next : next.slice(0, eol);
        } else {
          text = next == "\n" ? "" : next;
        }
        return pos + text.length > this.to ? text.slice(0, this.to - pos) : text;
      }
      /**
      The end position of the previous line.
      */
      prevLineEnd() {
        return this.atEnd ? this.lineStart : this.lineStart - 1;
      }
      /**
      @internal
      */
      startContext(type, start, value = 0) {
        this.block = CompositeBlock.create(type, value, this.lineStart + start, this.block.hash, this.lineStart + this.line.text.length);
        this.stack.push(this.block);
      }
      /**
      Start a composite block. Should only be called from [block
      parser functions](#BlockParser.parse) that return null.
      */
      startComposite(type, start, value = 0) {
        this.startContext(this.parser.getNodeType(type), start, value);
      }
      /**
      @internal
      */
      addNode(block, from, to) {
        if (typeof block == "number")
          block = new common.Tree(this.parser.nodeSet.types[block], none, none, (to !== null && to !== void 0 ? to : this.prevLineEnd()) - from);
        this.block.addChild(block, from - this.block.from);
      }
      /**
      Add a block element. Can be called by [block
      parsers](#BlockParser.parse).
      */
      addElement(elt2) {
        this.block.addChild(elt2.toTree(this.parser.nodeSet), elt2.from - this.block.from);
      }
      /**
      Add a block element from a [leaf parser](#LeafBlockParser). This
      makes sure any extra composite block markup (such as blockquote
      markers) inside the block are also added to the syntax tree.
      */
      addLeafElement(leaf, elt2) {
        this.addNode(this.buffer.writeElements(injectMarks(elt2.children, leaf.marks), -elt2.from).finish(elt2.type, elt2.to - elt2.from), elt2.from);
      }
      /**
      @internal
      */
      finishContext() {
        let cx = this.stack.pop();
        let top = this.stack[this.stack.length - 1];
        top.addChild(cx.toTree(this.parser.nodeSet), cx.from - top.from);
        this.block = top;
      }
      finish() {
        while (this.stack.length > 1)
          this.finishContext();
        return this.addGaps(this.block.toTree(this.parser.nodeSet, this.lineStart));
      }
      addGaps(tree) {
        return this.ranges.length > 1 ? injectGaps(this.ranges, 0, tree.topNode, this.ranges[0].from, this.reusePlaceholders) : tree;
      }
      /**
      @internal
      */
      finishLeaf(leaf) {
        for (let parser2 of leaf.parsers)
          if (parser2.finish(this, leaf))
            return;
        let inline = injectMarks(this.parser.parseInline(leaf.content, leaf.start), leaf.marks);
        this.addNode(this.buffer.writeElements(inline, -leaf.start).finish(Type.Paragraph, leaf.content.length), leaf.start);
      }
      elt(type, from, to, children) {
        if (typeof type == "string")
          return elt(this.parser.getNodeType(type), from, to, children);
        return new TreeElement(type, from);
      }
      /**
      @internal
      */
      get buffer() {
        return new Buffer2(this.parser.nodeSet);
      }
    };
    function injectGaps(ranges, rangeI, tree, offset, dummies) {
      let rangeEnd = ranges[rangeI].to;
      let children = [], positions = [], start = tree.from + offset;
      function movePastNext(upto, inclusive) {
        while (inclusive ? upto >= rangeEnd : upto > rangeEnd) {
          let size = ranges[rangeI + 1].from - rangeEnd;
          offset += size;
          upto += size;
          rangeI++;
          rangeEnd = ranges[rangeI].to;
        }
      }
      for (let ch = tree.firstChild; ch; ch = ch.nextSibling) {
        movePastNext(ch.from + offset, true);
        let from = ch.from + offset, node, reuse = dummies.get(ch.tree);
        if (reuse) {
          node = reuse;
        } else if (ch.to + offset > rangeEnd) {
          node = injectGaps(ranges, rangeI, ch, offset, dummies);
          movePastNext(ch.to + offset, false);
        } else {
          node = ch.toTree();
        }
        children.push(node);
        positions.push(from - start);
      }
      movePastNext(tree.to + offset, false);
      return new common.Tree(tree.type, children, positions, tree.to + offset - start, tree.tree ? tree.tree.propValues : void 0);
    }
    var MarkdownParser = class _MarkdownParser extends common.Parser {
      /**
      @internal
      */
      constructor(nodeSet, blockParsers, leafBlockParsers, blockNames, endLeafBlock, skipContextMarkup, inlineParsers, inlineNames, wrappers) {
        super();
        this.nodeSet = nodeSet;
        this.blockParsers = blockParsers;
        this.leafBlockParsers = leafBlockParsers;
        this.blockNames = blockNames;
        this.endLeafBlock = endLeafBlock;
        this.skipContextMarkup = skipContextMarkup;
        this.inlineParsers = inlineParsers;
        this.inlineNames = inlineNames;
        this.wrappers = wrappers;
        this.nodeTypes = /* @__PURE__ */ Object.create(null);
        for (let t of nodeSet.types)
          this.nodeTypes[t.name] = t.id;
      }
      createParse(input, fragments, ranges) {
        let parse = new BlockContext(this, input, fragments, ranges);
        for (let w of this.wrappers)
          parse = w(parse, input, fragments, ranges);
        return parse;
      }
      /**
      Reconfigure the parser.
      */
      configure(spec) {
        let config = resolveConfig(spec);
        if (!config)
          return this;
        let { nodeSet, skipContextMarkup } = this;
        let blockParsers = this.blockParsers.slice(), leafBlockParsers = this.leafBlockParsers.slice(), blockNames = this.blockNames.slice(), inlineParsers = this.inlineParsers.slice(), inlineNames = this.inlineNames.slice(), endLeafBlock = this.endLeafBlock.slice(), wrappers = this.wrappers;
        if (nonEmpty(config.defineNodes)) {
          skipContextMarkup = Object.assign({}, skipContextMarkup);
          let nodeTypes2 = nodeSet.types.slice(), styles;
          for (let s of config.defineNodes) {
            let { name, block, composite, style } = typeof s == "string" ? { name: s } : s;
            if (nodeTypes2.some((t) => t.name == name))
              continue;
            if (composite)
              skipContextMarkup[nodeTypes2.length] = (bl, cx, line) => composite(cx, line, bl.value);
            let id = nodeTypes2.length;
            let group = composite ? ["Block", "BlockContext"] : !block ? void 0 : id >= Type.ATXHeading1 && id <= Type.SetextHeading2 ? ["Block", "LeafBlock", "Heading"] : ["Block", "LeafBlock"];
            nodeTypes2.push(common.NodeType.define({
              id,
              name,
              props: group && [[common.NodeProp.group, group]]
            }));
            if (style) {
              if (!styles)
                styles = {};
              if (Array.isArray(style) || style instanceof highlight.Tag)
                styles[name] = style;
              else
                Object.assign(styles, style);
            }
          }
          nodeSet = new common.NodeSet(nodeTypes2);
          if (styles)
            nodeSet = nodeSet.extend(highlight.styleTags(styles));
        }
        if (nonEmpty(config.props))
          nodeSet = nodeSet.extend(...config.props);
        if (nonEmpty(config.remove)) {
          for (let rm of config.remove) {
            let block = this.blockNames.indexOf(rm), inline = this.inlineNames.indexOf(rm);
            if (block > -1)
              blockParsers[block] = leafBlockParsers[block] = void 0;
            if (inline > -1)
              inlineParsers[inline] = void 0;
          }
        }
        if (nonEmpty(config.parseBlock)) {
          for (let spec2 of config.parseBlock) {
            let found = blockNames.indexOf(spec2.name);
            if (found > -1) {
              blockParsers[found] = spec2.parse;
              leafBlockParsers[found] = spec2.leaf;
            } else {
              let pos = spec2.before ? findName(blockNames, spec2.before) : spec2.after ? findName(blockNames, spec2.after) + 1 : blockNames.length - 1;
              blockParsers.splice(pos, 0, spec2.parse);
              leafBlockParsers.splice(pos, 0, spec2.leaf);
              blockNames.splice(pos, 0, spec2.name);
            }
            if (spec2.endLeaf)
              endLeafBlock.push(spec2.endLeaf);
          }
        }
        if (nonEmpty(config.parseInline)) {
          for (let spec2 of config.parseInline) {
            let found = inlineNames.indexOf(spec2.name);
            if (found > -1) {
              inlineParsers[found] = spec2.parse;
            } else {
              let pos = spec2.before ? findName(inlineNames, spec2.before) : spec2.after ? findName(inlineNames, spec2.after) + 1 : inlineNames.length - 1;
              inlineParsers.splice(pos, 0, spec2.parse);
              inlineNames.splice(pos, 0, spec2.name);
            }
          }
        }
        if (config.wrap)
          wrappers = wrappers.concat(config.wrap);
        return new _MarkdownParser(nodeSet, blockParsers, leafBlockParsers, blockNames, endLeafBlock, skipContextMarkup, inlineParsers, inlineNames, wrappers);
      }
      /**
      @internal
      */
      getNodeType(name) {
        let found = this.nodeTypes[name];
        if (found == null)
          throw new RangeError(`Unknown node type '${name}'`);
        return found;
      }
      /**
      Parse the given piece of inline text at the given offset,
      returning an array of [`Element`](#Element) objects representing
      the inline content.
      */
      parseInline(text, offset) {
        let cx = new InlineContext(this, text, offset);
        outer: for (let pos = offset; pos < cx.end; ) {
          let next = cx.char(pos);
          for (let token of this.inlineParsers)
            if (token) {
              let result = token(cx, next, pos);
              if (result >= 0) {
                pos = result;
                continue outer;
              }
            }
          pos++;
        }
        return cx.resolveMarkers(0);
      }
    };
    function nonEmpty(a) {
      return a != null && a.length > 0;
    }
    function resolveConfig(spec) {
      if (!Array.isArray(spec))
        return spec;
      if (spec.length == 0)
        return null;
      let conf = resolveConfig(spec[0]);
      if (spec.length == 1)
        return conf;
      let rest = resolveConfig(spec.slice(1));
      if (!rest || !conf)
        return conf || rest;
      let conc = (a, b) => (a || none).concat(b || none);
      let wrapA = conf.wrap, wrapB = rest.wrap;
      return {
        props: conc(conf.props, rest.props),
        defineNodes: conc(conf.defineNodes, rest.defineNodes),
        parseBlock: conc(conf.parseBlock, rest.parseBlock),
        parseInline: conc(conf.parseInline, rest.parseInline),
        remove: conc(conf.remove, rest.remove),
        wrap: !wrapA ? wrapB : !wrapB ? wrapA : (inner, input, fragments, ranges) => wrapA(wrapB(inner, input, fragments, ranges), input, fragments, ranges)
      };
    }
    function findName(names, name) {
      let found = names.indexOf(name);
      if (found < 0)
        throw new RangeError(`Position specified relative to unknown parser ${name}`);
      return found;
    }
    var nodeTypes = [common.NodeType.none];
    for (let i = 1, name; name = Type[i]; i++) {
      nodeTypes[i] = common.NodeType.define({
        id: i,
        name,
        props: i >= Type.Escape ? [] : [[common.NodeProp.group, i in DefaultSkipMarkup ? ["Block", "BlockContext"] : ["Block", "LeafBlock"]]],
        top: name == "Document"
      });
    }
    var none = [];
    var Buffer2 = class {
      constructor(nodeSet) {
        this.nodeSet = nodeSet;
        this.content = [];
        this.nodes = [];
      }
      write(type, from, to, children = 0) {
        this.content.push(type, from, to, 4 + children * 4);
        return this;
      }
      writeElements(elts, offset = 0) {
        for (let e of elts)
          e.writeTo(this, offset);
        return this;
      }
      finish(type, length) {
        return common.Tree.build({
          buffer: this.content,
          nodeSet: this.nodeSet,
          reused: this.nodes,
          topID: type,
          length
        });
      }
    };
    var Element = class {
      /**
      @internal
      */
      constructor(type, from, to, children = none) {
        this.type = type;
        this.from = from;
        this.to = to;
        this.children = children;
      }
      /**
      @internal
      */
      writeTo(buf, offset) {
        let startOff = buf.content.length;
        buf.writeElements(this.children, offset);
        buf.content.push(this.type, this.from + offset, this.to + offset, buf.content.length + 4 - startOff);
      }
      /**
      @internal
      */
      toTree(nodeSet) {
        return new Buffer2(nodeSet).writeElements(this.children, -this.from).finish(this.type, this.to - this.from);
      }
    };
    var TreeElement = class {
      constructor(tree, from) {
        this.tree = tree;
        this.from = from;
      }
      get to() {
        return this.from + this.tree.length;
      }
      get type() {
        return this.tree.type.id;
      }
      get children() {
        return none;
      }
      writeTo(buf, offset) {
        buf.nodes.push(this.tree);
        buf.content.push(buf.nodes.length - 1, this.from + offset, this.to + offset, -1);
      }
      toTree() {
        return this.tree;
      }
    };
    function elt(type, from, to, children) {
      return new Element(type, from, to, children);
    }
    var EmphasisUnderscore = { resolve: "Emphasis", mark: "EmphasisMark" };
    var EmphasisAsterisk = { resolve: "Emphasis", mark: "EmphasisMark" };
    var LinkStart = {};
    var ImageStart = {};
    var InlineDelimiter = class {
      constructor(type, from, to, side) {
        this.type = type;
        this.from = from;
        this.to = to;
        this.side = side;
      }
    };
    var Escapable = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    var Punctuation = /[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~\xA1\u2010-\u2027]/;
    try {
      Punctuation = new RegExp("[\\p{S}|\\p{P}]", "u");
    } catch (_) {
    }
    var DefaultInline = {
      Escape(cx, next, start) {
        if (next != 92 || start == cx.end - 1)
          return -1;
        let escaped = cx.char(start + 1);
        for (let i = 0; i < Escapable.length; i++)
          if (Escapable.charCodeAt(i) == escaped)
            return cx.append(elt(Type.Escape, start, start + 2));
        return -1;
      },
      Entity(cx, next, start) {
        if (next != 38)
          return -1;
        let m = /^(?:#\d+|#x[a-f\d]+|\w+);/i.exec(cx.slice(start + 1, start + 31));
        return m ? cx.append(elt(Type.Entity, start, start + 1 + m[0].length)) : -1;
      },
      InlineCode(cx, next, start) {
        if (next != 96 || start && cx.char(start - 1) == 96)
          return -1;
        let pos = start + 1;
        while (pos < cx.end && cx.char(pos) == 96)
          pos++;
        let size = pos - start, curSize = 0;
        for (; pos < cx.end; pos++) {
          if (cx.char(pos) == 96) {
            curSize++;
            if (curSize == size && cx.char(pos + 1) != 96)
              return cx.append(elt(Type.InlineCode, start, pos + 1, [
                elt(Type.CodeMark, start, start + size),
                elt(Type.CodeMark, pos + 1 - size, pos + 1)
              ]));
          } else {
            curSize = 0;
          }
        }
        return -1;
      },
      HTMLTag(cx, next, start) {
        if (next != 60 || start == cx.end - 1)
          return -1;
        let after = cx.slice(start + 1, cx.end);
        let url = /^(?:[a-z][-\w+.]+:[^\s>]+|[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*)>/i.exec(after);
        if (url) {
          return cx.append(elt(Type.Autolink, start, start + 1 + url[0].length, [
            elt(Type.LinkMark, start, start + 1),
            // url[0] includes the closing bracket, so exclude it from this slice
            elt(Type.URL, start + 1, start + url[0].length),
            elt(Type.LinkMark, start + url[0].length, start + 1 + url[0].length)
          ]));
        }
        let comment = /^!--[^>](?:-[^-]|[^-])*?-->/i.exec(after);
        if (comment)
          return cx.append(elt(Type.Comment, start, start + 1 + comment[0].length));
        let procInst = /^\?[^]*?\?>/.exec(after);
        if (procInst)
          return cx.append(elt(Type.ProcessingInstruction, start, start + 1 + procInst[0].length));
        let m = /^(?:![A-Z][^]*?>|!\[CDATA\[[^]*?\]\]>|\/\s*[a-zA-Z][\w-]*\s*>|\s*[a-zA-Z][\w-]*(\s+[a-zA-Z:_][\w-.:]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*(\/\s*)?>)/.exec(after);
        if (!m)
          return -1;
        return cx.append(elt(Type.HTMLTag, start, start + 1 + m[0].length));
      },
      Emphasis(cx, next, start) {
        if (next != 95 && next != 42)
          return -1;
        let pos = start + 1;
        while (cx.char(pos) == next)
          pos++;
        let before = cx.slice(start - 1, start), after = cx.slice(pos, pos + 1);
        let pBefore = Punctuation.test(before), pAfter = Punctuation.test(after);
        let sBefore = /\s|^$/.test(before), sAfter = /\s|^$/.test(after);
        let leftFlanking = !sAfter && (!pAfter || sBefore || pBefore);
        let rightFlanking = !sBefore && (!pBefore || sAfter || pAfter);
        let canOpen = leftFlanking && (next == 42 || !rightFlanking || pBefore);
        let canClose = rightFlanking && (next == 42 || !leftFlanking || pAfter);
        return cx.append(new InlineDelimiter(next == 95 ? EmphasisUnderscore : EmphasisAsterisk, start, pos, (canOpen ? 1 : 0) | (canClose ? 2 : 0)));
      },
      HardBreak(cx, next, start) {
        if (next == 92 && cx.char(start + 1) == 10)
          return cx.append(elt(Type.HardBreak, start, start + 2));
        if (next == 32) {
          let pos = start + 1;
          while (cx.char(pos) == 32)
            pos++;
          if (cx.char(pos) == 10 && pos >= start + 2)
            return cx.append(elt(Type.HardBreak, start, pos + 1));
        }
        return -1;
      },
      Link(cx, next, start) {
        return next == 91 ? cx.append(new InlineDelimiter(
          LinkStart,
          start,
          start + 1,
          1
          /* Mark.Open */
        )) : -1;
      },
      Image(cx, next, start) {
        return next == 33 && cx.char(start + 1) == 91 ? cx.append(new InlineDelimiter(
          ImageStart,
          start,
          start + 2,
          1
          /* Mark.Open */
        )) : -1;
      },
      LinkEnd(cx, next, start) {
        if (next != 93)
          return -1;
        for (let i = cx.parts.length - 1; i >= 0; i--) {
          let part = cx.parts[i];
          if (part instanceof InlineDelimiter && (part.type == LinkStart || part.type == ImageStart)) {
            if (!part.side || cx.skipSpace(part.to) == start && !/[(\[]/.test(cx.slice(start + 1, start + 2))) {
              cx.parts[i] = null;
              return -1;
            }
            let content = cx.takeContent(i);
            let link = cx.parts[i] = finishLink(cx, content, part.type == LinkStart ? Type.Link : Type.Image, part.from, start + 1);
            if (part.type == LinkStart)
              for (let j = 0; j < i; j++) {
                let p = cx.parts[j];
                if (p instanceof InlineDelimiter && p.type == LinkStart)
                  p.side = 0;
              }
            return link.to;
          }
        }
        return -1;
      }
    };
    function finishLink(cx, content, type, start, startPos) {
      let { text } = cx, next = cx.char(startPos), endPos = startPos;
      content.unshift(elt(Type.LinkMark, start, start + (type == Type.Image ? 2 : 1)));
      content.push(elt(Type.LinkMark, startPos - 1, startPos));
      if (next == 40) {
        let pos = cx.skipSpace(startPos + 1);
        let dest = parseURL(text, pos - cx.offset, cx.offset), title;
        if (dest) {
          pos = cx.skipSpace(dest.to);
          if (pos != dest.to) {
            title = parseLinkTitle(text, pos - cx.offset, cx.offset);
            if (title)
              pos = cx.skipSpace(title.to);
          }
        }
        if (cx.char(pos) == 41) {
          content.push(elt(Type.LinkMark, startPos, startPos + 1));
          endPos = pos + 1;
          if (dest)
            content.push(dest);
          if (title)
            content.push(title);
          content.push(elt(Type.LinkMark, pos, endPos));
        }
      } else if (next == 91) {
        let label = parseLinkLabel(text, startPos - cx.offset, cx.offset, false);
        if (label) {
          content.push(label);
          endPos = label.to;
        }
      }
      return elt(type, start, endPos, content);
    }
    function parseURL(text, start, offset) {
      let next = text.charCodeAt(start);
      if (next == 60) {
        for (let pos = start + 1; pos < text.length; pos++) {
          let ch = text.charCodeAt(pos);
          if (ch == 62)
            return elt(Type.URL, start + offset, pos + 1 + offset);
          if (ch == 60 || ch == 10)
            return false;
        }
        return null;
      } else {
        let depth = 0, pos = start;
        for (let escaped = false; pos < text.length; pos++) {
          let ch = text.charCodeAt(pos);
          if (space(ch)) {
            break;
          } else if (escaped) {
            escaped = false;
          } else if (ch == 40) {
            depth++;
          } else if (ch == 41) {
            if (!depth)
              break;
            depth--;
          } else if (ch == 92) {
            escaped = true;
          }
        }
        return pos > start ? elt(Type.URL, start + offset, pos + offset) : pos == text.length ? null : false;
      }
    }
    function parseLinkTitle(text, start, offset) {
      let next = text.charCodeAt(start);
      if (next != 39 && next != 34 && next != 40)
        return false;
      let end = next == 40 ? 41 : next;
      for (let pos = start + 1, escaped = false; pos < text.length; pos++) {
        let ch = text.charCodeAt(pos);
        if (escaped)
          escaped = false;
        else if (ch == end)
          return elt(Type.LinkTitle, start + offset, pos + 1 + offset);
        else if (ch == 92)
          escaped = true;
      }
      return null;
    }
    function parseLinkLabel(text, start, offset, requireNonWS) {
      for (let escaped = false, pos = start + 1, end = Math.min(text.length, pos + 999); pos < end; pos++) {
        let ch = text.charCodeAt(pos);
        if (escaped)
          escaped = false;
        else if (ch == 93)
          return requireNonWS ? false : elt(Type.LinkLabel, start + offset, pos + 1 + offset);
        else {
          if (requireNonWS && !space(ch))
            requireNonWS = false;
          if (ch == 91)
            return false;
          else if (ch == 92)
            escaped = true;
        }
      }
      return null;
    }
    var InlineContext = class {
      /**
      @internal
      */
      constructor(parser2, text, offset) {
        this.parser = parser2;
        this.text = text;
        this.offset = offset;
        this.parts = [];
      }
      /**
      Get the character code at the given (document-relative)
      position.
      */
      char(pos) {
        return pos >= this.end ? -1 : this.text.charCodeAt(pos - this.offset);
      }
      /**
      The position of the end of this inline section.
      */
      get end() {
        return this.offset + this.text.length;
      }
      /**
      Get a substring of this inline section. Again uses
      document-relative positions.
      */
      slice(from, to) {
        return this.text.slice(from - this.offset, to - this.offset);
      }
      /**
      @internal
      */
      append(elt2) {
        this.parts.push(elt2);
        return elt2.to;
      }
      /**
      Add a [delimiter](#DelimiterType) at this given position. `open`
      and `close` indicate whether this delimiter is opening, closing,
      or both. Returns the end of the delimiter, for convenient
      returning from [parse functions](#InlineParser.parse).
      */
      addDelimiter(type, from, to, open, close) {
        return this.append(new InlineDelimiter(type, from, to, (open ? 1 : 0) | (close ? 2 : 0)));
      }
      /**
      Returns true when there is an unmatched link or image opening
      token before the current position.
      */
      get hasOpenLink() {
        for (let i = this.parts.length - 1; i >= 0; i--) {
          let part = this.parts[i];
          if (part instanceof InlineDelimiter && (part.type == LinkStart || part.type == ImageStart))
            return true;
        }
        return false;
      }
      /**
      Add an inline element. Returns the end of the element.
      */
      addElement(elt2) {
        return this.append(elt2);
      }
      /**
      Resolve markers between this.parts.length and from, wrapping matched markers in the
      appropriate node and updating the content of this.parts. @internal
      */
      resolveMarkers(from) {
        for (let i = from; i < this.parts.length; i++) {
          let close = this.parts[i];
          if (!(close instanceof InlineDelimiter && close.type.resolve && close.side & 2))
            continue;
          let emp = close.type == EmphasisUnderscore || close.type == EmphasisAsterisk;
          let closeSize = close.to - close.from;
          let open, j = i - 1;
          for (; j >= from; j--) {
            let part = this.parts[j];
            if (part instanceof InlineDelimiter && part.side & 1 && part.type == close.type && // Ignore emphasis delimiters where the character count doesn't match
            !(emp && (close.side & 1 || part.side & 2) && (part.to - part.from + closeSize) % 3 == 0 && ((part.to - part.from) % 3 || closeSize % 3))) {
              open = part;
              break;
            }
          }
          if (!open)
            continue;
          let type = close.type.resolve, content = [];
          let start = open.from, end = close.to;
          if (emp) {
            let size = Math.min(2, open.to - open.from, closeSize);
            start = open.to - size;
            end = close.from + size;
            type = size == 1 ? "Emphasis" : "StrongEmphasis";
          }
          if (open.type.mark)
            content.push(this.elt(open.type.mark, start, open.to));
          for (let k = j + 1; k < i; k++) {
            if (this.parts[k] instanceof Element)
              content.push(this.parts[k]);
            this.parts[k] = null;
          }
          if (close.type.mark)
            content.push(this.elt(close.type.mark, close.from, end));
          let element = this.elt(type, start, end, content);
          this.parts[j] = emp && open.from != start ? new InlineDelimiter(open.type, open.from, start, open.side) : null;
          let keep = this.parts[i] = emp && close.to != end ? new InlineDelimiter(close.type, end, close.to, close.side) : null;
          if (keep)
            this.parts.splice(i, 0, element);
          else
            this.parts[i] = element;
        }
        let result = [];
        for (let i = from; i < this.parts.length; i++) {
          let part = this.parts[i];
          if (part instanceof Element)
            result.push(part);
        }
        return result;
      }
      /**
      Find an opening delimiter of the given type. Returns `null` if
      no delimiter is found, or an index that can be passed to
      [`takeContent`](#InlineContext.takeContent) otherwise.
      */
      findOpeningDelimiter(type) {
        for (let i = this.parts.length - 1; i >= 0; i--) {
          let part = this.parts[i];
          if (part instanceof InlineDelimiter && part.type == type && part.side & 1)
            return i;
        }
        return null;
      }
      /**
      Remove all inline elements and delimiters starting from the
      given index (which you should get from
      [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter),
      resolve delimiters inside of them, and return them as an array
      of elements.
      */
      takeContent(startIndex) {
        let content = this.resolveMarkers(startIndex);
        this.parts.length = startIndex;
        return content;
      }
      /**
      Return the delimiter at the given index. Mostly useful to get
      additional info out of a delimiter index returned by
      [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter).
      Returns null if there is no delimiter at this index.
      */
      getDelimiterAt(index) {
        let part = this.parts[index];
        return part instanceof InlineDelimiter ? part : null;
      }
      /**
      Skip space after the given (document) position, returning either
      the position of the next non-space character or the end of the
      section.
      */
      skipSpace(from) {
        return skipSpace(this.text, from - this.offset) + this.offset;
      }
      elt(type, from, to, children) {
        if (typeof type == "string")
          return elt(this.parser.getNodeType(type), from, to, children);
        return new TreeElement(type, from);
      }
    };
    InlineContext.linkStart = LinkStart;
    InlineContext.imageStart = ImageStart;
    function injectMarks(elements, marks) {
      if (!marks.length)
        return elements;
      if (!elements.length)
        return marks;
      let elts = elements.slice(), eI = 0;
      for (let mark of marks) {
        while (eI < elts.length && elts[eI].to < mark.to)
          eI++;
        if (eI < elts.length && elts[eI].from < mark.from) {
          let e = elts[eI];
          if (e instanceof Element)
            elts[eI] = new Element(e.type, e.from, e.to, injectMarks(e.children, [mark]));
        } else {
          elts.splice(eI++, 0, mark);
        }
      }
      return elts;
    }
    var NotLast = [Type.CodeBlock, Type.ListItem, Type.OrderedList, Type.BulletList];
    var FragmentCursor = class {
      constructor(fragments, input) {
        this.fragments = fragments;
        this.input = input;
        this.i = 0;
        this.fragment = null;
        this.fragmentEnd = -1;
        this.cursor = null;
        if (fragments.length)
          this.fragment = fragments[this.i++];
      }
      nextFragment() {
        this.fragment = this.i < this.fragments.length ? this.fragments[this.i++] : null;
        this.cursor = null;
        this.fragmentEnd = -1;
      }
      moveTo(pos, lineStart) {
        while (this.fragment && this.fragment.to <= pos)
          this.nextFragment();
        if (!this.fragment || this.fragment.from > (pos ? pos - 1 : 0))
          return false;
        if (this.fragmentEnd < 0) {
          let end = this.fragment.to;
          while (end > 0 && this.input.read(end - 1, end) != "\n")
            end--;
          this.fragmentEnd = end ? end - 1 : 0;
        }
        let c = this.cursor;
        if (!c) {
          c = this.cursor = this.fragment.tree.cursor();
          c.firstChild();
        }
        let rPos = pos + this.fragment.offset;
        while (c.to <= rPos)
          if (!c.parent())
            return false;
        for (; ; ) {
          if (c.from >= rPos)
            return this.fragment.from <= lineStart;
          if (!c.childAfter(rPos))
            return false;
        }
      }
      matches(hash) {
        let tree = this.cursor.tree;
        return tree && tree.prop(common.NodeProp.contextHash) == hash;
      }
      takeNodes(cx) {
        let cur = this.cursor, off = this.fragment.offset, fragEnd = this.fragmentEnd - (this.fragment.openEnd ? 1 : 0);
        let start = cx.absoluteLineStart, end = start, blockI = cx.block.children.length;
        let prevEnd = end, prevI = blockI;
        for (; ; ) {
          if (cur.to - off > fragEnd) {
            if (cur.type.isAnonymous && cur.firstChild())
              continue;
            break;
          }
          let pos = toRelative(cur.from - off, cx.ranges);
          if (cur.to - off <= cx.ranges[cx.rangeI].to) {
            cx.addNode(cur.tree, pos);
          } else {
            let dummy = new common.Tree(cx.parser.nodeSet.types[Type.Paragraph], [], [], 0, cx.block.hashProp);
            cx.reusePlaceholders.set(dummy, cur.tree);
            cx.addNode(dummy, pos);
          }
          if (cur.type.is("Block")) {
            if (NotLast.indexOf(cur.type.id) < 0) {
              end = cur.to - off;
              blockI = cx.block.children.length;
            } else {
              end = prevEnd;
              blockI = prevI;
            }
            prevEnd = cur.to - off;
            prevI = cx.block.children.length;
          }
          if (!cur.nextSibling())
            break;
        }
        while (cx.block.children.length > blockI) {
          cx.block.children.pop();
          cx.block.positions.pop();
        }
        return end - start;
      }
    };
    function toRelative(abs, ranges) {
      let pos = abs;
      for (let i = 1; i < ranges.length; i++) {
        let gapFrom = ranges[i - 1].to, gapTo = ranges[i].from;
        if (gapFrom < abs)
          pos -= gapTo - gapFrom;
      }
      return pos;
    }
    var markdownHighlighting = highlight.styleTags({
      "Blockquote/...": highlight.tags.quote,
      HorizontalRule: highlight.tags.contentSeparator,
      "ATXHeading1/... SetextHeading1/...": highlight.tags.heading1,
      "ATXHeading2/... SetextHeading2/...": highlight.tags.heading2,
      "ATXHeading3/...": highlight.tags.heading3,
      "ATXHeading4/...": highlight.tags.heading4,
      "ATXHeading5/...": highlight.tags.heading5,
      "ATXHeading6/...": highlight.tags.heading6,
      "Comment CommentBlock": highlight.tags.comment,
      Escape: highlight.tags.escape,
      Entity: highlight.tags.character,
      "Emphasis/...": highlight.tags.emphasis,
      "StrongEmphasis/...": highlight.tags.strong,
      "Link/... Image/...": highlight.tags.link,
      "OrderedList/... BulletList/...": highlight.tags.list,
      "BlockQuote/...": highlight.tags.quote,
      "InlineCode CodeText": highlight.tags.monospace,
      "URL Autolink": highlight.tags.url,
      "HeaderMark HardBreak QuoteMark ListMark LinkMark EmphasisMark CodeMark": highlight.tags.processingInstruction,
      "CodeInfo LinkLabel": highlight.tags.labelName,
      LinkTitle: highlight.tags.string,
      Paragraph: highlight.tags.content
    });
    var parser = new MarkdownParser(new common.NodeSet(nodeTypes).extend(markdownHighlighting), Object.keys(DefaultBlockParsers).map((n) => DefaultBlockParsers[n]), Object.keys(DefaultBlockParsers).map((n) => DefaultLeafBlocks[n]), Object.keys(DefaultBlockParsers), DefaultEndLeaf, DefaultSkipMarkup, Object.keys(DefaultInline).map((n) => DefaultInline[n]), Object.keys(DefaultInline), []);
    function leftOverSpace(node, from, to) {
      let ranges = [];
      for (let n = node.firstChild, pos = from; ; n = n.nextSibling) {
        let nextPos = n ? n.from : to;
        if (nextPos > pos)
          ranges.push({ from: pos, to: nextPos });
        if (!n)
          break;
        pos = n.to;
      }
      return ranges;
    }
    function parseCode(config) {
      let { codeParser, htmlParser } = config;
      let wrap = common.parseMixed((node, input) => {
        let id = node.type.id;
        if (codeParser && (id == Type.CodeBlock || id == Type.FencedCode)) {
          let info = "";
          if (id == Type.FencedCode) {
            let infoNode = node.node.getChild(Type.CodeInfo);
            if (infoNode)
              info = input.read(infoNode.from, infoNode.to);
          }
          let parser2 = codeParser(info);
          if (parser2)
            return { parser: parser2, overlay: (node2) => node2.type.id == Type.CodeText, bracketed: id == Type.FencedCode };
        } else if (htmlParser && (id == Type.HTMLBlock || id == Type.HTMLTag || id == Type.CommentBlock)) {
          return { parser: htmlParser, overlay: leftOverSpace(node.node, node.from, node.to) };
        }
        return null;
      });
      return { wrap };
    }
    var StrikethroughDelim = { resolve: "Strikethrough", mark: "StrikethroughMark" };
    var Strikethrough = {
      defineNodes: [{
        name: "Strikethrough",
        style: { "Strikethrough/...": highlight.tags.strikethrough }
      }, {
        name: "StrikethroughMark",
        style: highlight.tags.processingInstruction
      }],
      parseInline: [{
        name: "Strikethrough",
        parse(cx, next, pos) {
          if (next != 126 || cx.char(pos + 1) != 126 || cx.char(pos + 2) == 126)
            return -1;
          let before = cx.slice(pos - 1, pos), after = cx.slice(pos + 2, pos + 3);
          let sBefore = /\s|^$/.test(before), sAfter = /\s|^$/.test(after);
          let pBefore = Punctuation.test(before), pAfter = Punctuation.test(after);
          return cx.addDelimiter(StrikethroughDelim, pos, pos + 2, !sAfter && (!pAfter || sBefore || pBefore), !sBefore && (!pBefore || sAfter || pAfter));
        },
        after: "Emphasis"
      }]
    };
    function parseRow(cx, line, startI = 0, elts, offset = 0) {
      let count2 = 0, first = true, cellStart = -1, cellEnd = -1, esc = false;
      let parseCell = () => {
        elts.push(cx.elt("TableCell", offset + cellStart, offset + cellEnd, cx.parser.parseInline(line.slice(cellStart, cellEnd), offset + cellStart)));
      };
      for (let i = startI; i < line.length; i++) {
        let next = line.charCodeAt(i);
        if (next == 124 && !esc) {
          if (!first || cellStart > -1)
            count2++;
          first = false;
          if (elts) {
            if (cellStart > -1)
              parseCell();
            elts.push(cx.elt("TableDelimiter", i + offset, i + offset + 1));
          }
          cellStart = cellEnd = -1;
        } else if (esc || next != 32 && next != 9) {
          if (cellStart < 0)
            cellStart = i;
          cellEnd = i + 1;
        }
        esc = !esc && next == 92;
      }
      if (cellStart > -1) {
        count2++;
        if (elts)
          parseCell();
      }
      return count2;
    }
    function hasPipe(str, start) {
      for (let i = start; i < str.length; i++) {
        let next = str.charCodeAt(i);
        if (next == 124)
          return true;
        if (next == 92)
          i++;
      }
      return false;
    }
    var delimiterLine = /^\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?$/;
    var TableParser = class {
      constructor() {
        this.rows = null;
      }
      nextLine(cx, line, leaf) {
        if (this.rows == null) {
          this.rows = false;
          let lineText;
          if ((line.next == 45 || line.next == 58 || line.next == 124) && delimiterLine.test(lineText = line.text.slice(line.pos))) {
            let firstRow = [], firstCount = parseRow(cx, leaf.content, 0, firstRow, leaf.start);
            if (firstCount == parseRow(cx, lineText, line.pos))
              this.rows = [
                cx.elt("TableHeader", leaf.start, leaf.start + leaf.content.length, firstRow),
                cx.elt("TableDelimiter", cx.lineStart + line.pos, cx.lineStart + line.text.length)
              ];
          }
        } else if (this.rows) {
          let content = [];
          parseRow(cx, line.text, line.pos, content, cx.lineStart);
          this.rows.push(cx.elt("TableRow", cx.lineStart + line.pos, cx.lineStart + line.text.length, content));
        }
        return false;
      }
      finish(cx, leaf) {
        if (!this.rows)
          return false;
        cx.addLeafElement(leaf, cx.elt("Table", leaf.start, leaf.start + leaf.content.length, this.rows));
        return true;
      }
    };
    var Table = {
      defineNodes: [
        { name: "Table", block: true },
        { name: "TableHeader", style: { "TableHeader/...": highlight.tags.heading } },
        "TableRow",
        { name: "TableCell", style: highlight.tags.content },
        { name: "TableDelimiter", style: highlight.tags.processingInstruction }
      ],
      parseBlock: [{
        name: "Table",
        leaf(_, leaf) {
          return hasPipe(leaf.content, 0) ? new TableParser() : null;
        },
        endLeaf(cx, line, leaf) {
          if (leaf.parsers.some((p) => p instanceof TableParser) || !hasPipe(line.text, line.basePos))
            return false;
          let next = cx.peekLine();
          return delimiterLine.test(next) && parseRow(cx, line.text, line.basePos) == parseRow(cx, next, line.basePos);
        },
        before: "SetextHeading"
      }]
    };
    var TaskParser = class {
      nextLine() {
        return false;
      }
      finish(cx, leaf) {
        cx.addLeafElement(leaf, cx.elt("Task", leaf.start, leaf.start + leaf.content.length, [
          cx.elt("TaskMarker", leaf.start, leaf.start + 3),
          ...cx.parser.parseInline(leaf.content.slice(3), leaf.start + 3)
        ]));
        return true;
      }
    };
    var TaskList = {
      defineNodes: [
        { name: "Task", block: true, style: highlight.tags.list },
        { name: "TaskMarker", style: highlight.tags.atom }
      ],
      parseBlock: [{
        name: "TaskList",
        leaf(cx, leaf) {
          return /^\[[ xX]\][ \t]/.test(leaf.content) && cx.parentType().name == "ListItem" ? new TaskParser() : null;
        },
        after: "SetextHeading"
      }]
    };
    var autolinkRE = /(www\.)|(https?:\/\/)|([\w.+-]{1,100}@)|(mailto:|xmpp:)/gy;
    var urlRE = /[\w-]+(\.[\w-]+)+(\/[^\s<]*)?/gy;
    var lastTwoDomainWords = /[\w-]+\.[\w-]+($|\/)/;
    var emailRE = /[\w.+-]+@[\w-]+(\.[\w.-]+)+/gy;
    var xmppResourceRE = /\/[a-zA-Z\d@.]+/gy;
    function count(str, from, to, ch) {
      let result = 0;
      for (let i = from; i < to; i++)
        if (str[i] == ch)
          result++;
      return result;
    }
    function autolinkURLEnd(text, from) {
      urlRE.lastIndex = from;
      let m = urlRE.exec(text);
      if (!m || lastTwoDomainWords.exec(m[0])[0].indexOf("_") > -1)
        return -1;
      let end = from + m[0].length;
      for (; ; ) {
        let last = text[end - 1], m2;
        if (/[?!.,:*_~]/.test(last) || last == ")" && count(text, from, end, ")") > count(text, from, end, "("))
          end--;
        else if (last == ";" && (m2 = /&(?:#\d+|#x[a-f\d]+|\w+);$/.exec(text.slice(from, end))))
          end = from + m2.index;
        else
          break;
      }
      return end;
    }
    function autolinkEmailEnd(text, from) {
      emailRE.lastIndex = from;
      let m = emailRE.exec(text);
      if (!m)
        return -1;
      let last = m[0][m[0].length - 1];
      return last == "_" || last == "-" ? -1 : from + m[0].length - (last == "." ? 1 : 0);
    }
    var Autolink = {
      parseInline: [{
        name: "Autolink",
        parse(cx, next, absPos) {
          let pos = absPos - cx.offset;
          if (pos && /\w/.test(cx.text[pos - 1]))
            return -1;
          autolinkRE.lastIndex = pos;
          let m = autolinkRE.exec(cx.text), end = -1;
          if (!m)
            return -1;
          if (m[1] || m[2]) {
            end = autolinkURLEnd(cx.text, pos + m[0].length);
            if (end > -1 && cx.hasOpenLink) {
              let noBracket = /([^\[\]]|\[[^\]]*\])*/.exec(cx.text.slice(pos, end));
              end = pos + noBracket[0].length;
            }
          } else if (m[3]) {
            end = autolinkEmailEnd(cx.text, pos);
          } else {
            end = autolinkEmailEnd(cx.text, pos + m[0].length);
            if (end > -1 && m[0] == "xmpp:") {
              xmppResourceRE.lastIndex = end;
              m = xmppResourceRE.exec(cx.text);
              if (m)
                end = m.index + m[0].length;
            }
          }
          if (end < 0)
            return -1;
          cx.addElement(cx.elt("URL", absPos, end + cx.offset));
          return end + cx.offset;
        }
      }]
    };
    var GFM = [Table, TaskList, Strikethrough, Autolink];
    function parseSubSuper(ch, node, mark) {
      return (cx, next, pos) => {
        if (next != ch || cx.char(pos + 1) == ch)
          return -1;
        let elts = [cx.elt(mark, pos, pos + 1)];
        for (let i = pos + 1; i < cx.end; i++) {
          let next2 = cx.char(i);
          if (next2 == ch)
            return cx.addElement(cx.elt(node, pos, i + 1, elts.concat(cx.elt(mark, i, i + 1))));
          if (next2 == 92)
            elts.push(cx.elt("Escape", i, i++ + 2));
          if (space(next2))
            break;
        }
        return -1;
      };
    }
    var Superscript = {
      defineNodes: [
        { name: "Superscript", style: highlight.tags.special(highlight.tags.content) },
        { name: "SuperscriptMark", style: highlight.tags.processingInstruction }
      ],
      parseInline: [{
        name: "Superscript",
        parse: parseSubSuper(94, "Superscript", "SuperscriptMark")
      }]
    };
    var Subscript = {
      defineNodes: [
        { name: "Subscript", style: highlight.tags.special(highlight.tags.content) },
        { name: "SubscriptMark", style: highlight.tags.processingInstruction }
      ],
      parseInline: [{
        name: "Subscript",
        parse: parseSubSuper(126, "Subscript", "SubscriptMark")
      }]
    };
    var Emoji = {
      defineNodes: [{ name: "Emoji", style: highlight.tags.character }],
      parseInline: [{
        name: "Emoji",
        parse(cx, next, pos) {
          let match;
          if (next != 58 || !(match = /^[a-zA-Z_0-9]+:/.exec(cx.slice(pos + 1, cx.end))))
            return -1;
          return cx.addElement(cx.elt("Emoji", pos, pos + 1 + match[0].length));
        }
      }]
    };
    exports2.Autolink = Autolink;
    exports2.BlockContext = BlockContext;
    exports2.Element = Element;
    exports2.Emoji = Emoji;
    exports2.GFM = GFM;
    exports2.InlineContext = InlineContext;
    exports2.LeafBlock = LeafBlock;
    exports2.Line = Line;
    exports2.MarkdownParser = MarkdownParser;
    exports2.Strikethrough = Strikethrough;
    exports2.Subscript = Subscript;
    exports2.Superscript = Superscript;
    exports2.Table = Table;
    exports2.TaskList = TaskList;
    exports2.parseCode = parseCode;
    exports2.parser = parser;
  }
});

// plugin/markdown-structure.js
var require_markdown_structure = __commonJS({
  "plugin/markdown-structure.js"(exports2, module2) {
    var { parser, GFM } = require_dist3();
    var escaped = (text, pos) => {
      let n = 0;
      while (pos > 0 && text[--pos] === "\\") n++;
      return n % 2 === 1;
    };
    function closing(text, token, start) {
      let pos = start;
      while ((pos = text.indexOf(token, pos)) >= 0) {
        if (!escaped(text, pos)) return pos;
        pos += token.length;
      }
      return -1;
    }
    function openDisplay(text) {
      let open = false;
      for (let pos = 0; pos < text.length; pos++) {
        if (escaped(text, pos)) continue;
        if (!open && text[pos] === "`") {
          let end = pos + 1;
          while (text[end] === "`") end++;
          const run = text.slice(pos, end);
          let close = end;
          while ((close = text.indexOf(run, close)) >= 0) {
            if (text[close - 1] !== "`" && text[close + run.length] !== "`") break;
            close += run.length;
          }
          if (close >= 0) pos = close + run.length - 1;
          else pos = end - 1;
        } else if (text.startsWith("$$", pos)) {
          open = !open;
          pos++;
        }
      }
      return open;
    }
    var markdown = parser.configure([GFM, {
      defineNodes: ["KLMath", "KLMathBlock"],
      parseInline: [{ name: "KLMath", before: "Escape", parse(cx, next, pos) {
        if (next !== 36 || escaped(cx.text, pos - cx.offset)) return -1;
        const token = cx.char(pos + 1) === 36 ? "$$" : "$", end = closing(cx.text, token, pos - cx.offset + token.length);
        if (end < 0) return -1;
        if (token === "$" && (/\s/.test(cx.char(pos + 1) ? String.fromCharCode(cx.char(pos + 1)) : "") || /\s/.test(cx.text[end - 1] || "") || /\d/.test(cx.text[end + 1] || "") || cx.text.slice(pos - cx.offset, end).includes("\n"))) return -1;
        return cx.addElement(cx.elt("KLMath", pos, cx.offset + end + token.length));
      } }],
      parseBlock: [{
        name: "KLMathBlock",
        before: "FencedCode",
        endLeaf: (cx, line, leaf) => line.text.startsWith("$$", line.pos) && !openDisplay(leaf.content),
        parse(cx, line) {
          if (!line.text.startsWith("$$", line.pos)) return false;
          const from = cx.lineStart + line.pos;
          let end = cx.lineStart + line.text.length;
          let close = closing(line.text, "$$", line.pos + 2), closed = close >= 0;
          if (closed) end = cx.lineStart + close + 2;
          if (!closed) {
            while (cx.nextLine()) {
              if (line.depth < cx.depth) break;
              end = cx.lineStart + line.text.length;
              close = closing(line.text, "$$", line.pos);
              if (close >= 0) {
                end = cx.lineStart + close + 2;
                closed = true;
                break;
              }
            }
          }
          cx.addElement(cx.elt("KLMathBlock", from, end));
          if (closed) cx.nextLine();
          return true;
        }
      }]
    }]);
    function merge(spans) {
      const out = [];
      for (const s of spans.sort((a, b) => a[0] - b[0])) {
        const last = out[out.length - 1];
        if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
        else out.push([...s]);
      }
      return out;
    }
    function scan2(text) {
      const frontmatter = /^\uFEFF?---\r?\n(?:[^\n]*\n)*?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
      const code = frontmatter ? [[0, frontmatter[0].length]] : [], math = [], links = [], structure = [];
      const masked = frontmatter ? frontmatter[0].replace(/[^\r\n]/g, " ") + text.slice(frontmatter[0].length) : text;
      const tree = markdown.parse(masked);
      tree.iterate({ enter(node) {
        const span = [node.from, node.to];
        if (["FencedCode", "CodeBlock", "InlineCode", "HTMLBlock", "Comment", "CommentBlock"].includes(node.name)) {
          code.push(span);
          return false;
        }
        if (["Link", "Image", "Autolink", "URL"].includes(node.name)) links.push(span);
        if (node.name === "KLMath" || node.name === "KLMathBlock") {
          math.push(span);
          return false;
        }
        if (["ListItem", "Blockquote", "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2"].includes(node.name)) structure.push({ type: node.name, from: node.from, to: node.to });
      } });
      const excluded = merge([...code, ...math]), comments = [];
      let cursor = 0, at = 0;
      while ((cursor = text.indexOf("%%", cursor)) >= 0) {
        while (at < excluded.length && excluded[at][1] <= cursor) at++;
        if (at < excluded.length && excluded[at][0] <= cursor) {
          cursor = excluded[at][1];
          continue;
        }
        if (escaped(text, cursor)) {
          cursor += 2;
          continue;
        }
        const end = text.indexOf("%%", cursor + 2);
        if (text.startsWith("%%kl:", cursor) && end >= 0) {
          cursor = end + 2;
          continue;
        }
        const to = end < 0 ? text.length : end + 2;
        comments.push([cursor, to]);
        cursor = to;
      }
      const wiki = /!?\[\[[^\]\r\n]*\]\]/g;
      let match;
      while (match = wiki.exec(text)) if (!escaped(text, match.index)) links.push([match.index, match.index + match[0].length]);
      return { offsetUnit: "utf16", protected: merge([...code, ...comments]), math, links: merge(links), structure };
    }
    module2.exports = { scan: scan2 };
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/identity.js"(exports2) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports2.ALIAS = ALIAS;
    exports2.DOC = DOC;
    exports2.MAP = MAP;
    exports2.NODE_TYPE = NODE_TYPE;
    exports2.PAIR = PAIR;
    exports2.SCALAR = SCALAR;
    exports2.SEQ = SEQ;
    exports2.hasAnchor = hasAnchor;
    exports2.isAlias = isAlias;
    exports2.isCollection = isCollection;
    exports2.isDocument = isDocument;
    exports2.isMap = isMap;
    exports2.isNode = isNode;
    exports2.isPair = isPair;
    exports2.isScalar = isScalar;
    exports2.isSeq = isSeq;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/visit.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports2.visit = visit;
    exports2.visitAsync = visitAsync;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/directives.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports2.Directives = Directives;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/anchors.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports2.anchorIsValid = anchorIsValid;
    exports2.anchorNames = anchorNames;
    exports2.createNodeAnchors = createNodeAnchors;
    exports2.findNewAnchor = findNewAnchor;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/applyReviver.js"(exports2) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports2.applyReviver = applyReviver;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/toJS.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports2.toJS = toJS;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Node.js"(exports2) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports2.NodeBase = NodeBase;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Alias.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports2.Alias = Alias;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports2.Scalar = Scalar;
    exports2.isScalarValue = isScalarValue;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/createNode.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports2.createNode = createNode;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Collection.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports2.Collection = Collection;
    exports2.collectionFromPath = collectionFromPath;
    exports2.isEmptyPath = isEmptyPath;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyComment.js"(exports2) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports2.indentComment = indentComment;
    exports2.lineComment = lineComment;
    exports2.stringifyComment = stringifyComment;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports2) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports2.FOLD_BLOCK = FOLD_BLOCK;
    exports2.FOLD_FLOW = FOLD_FLOW;
    exports2.FOLD_QUOTED = FOLD_QUOTED;
    exports2.foldFlowLines = foldFlowLines;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyString.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports2.stringifyString = stringifyString;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringify.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports2.createStringifyContext = createStringifyContext;
    exports2.stringify = stringify;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyPair.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports2.stringifyPair = stringifyPair;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/log.js"(exports2) {
    "use strict";
    var node_process = require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports2.debug = debug;
    exports2.warn = warn;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports2.addMergeToJSMap = addMergeToJSMap;
    exports2.isMergeKey = isMergeKey;
    exports2.merge = merge;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports2) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports2.addPairToJSMap = addPairToJSMap;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/Pair.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports2.Pair = Pair;
    exports2.createPair = createPair;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports2.stringifyCollection = stringifyCollection;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/YAMLMap.js"(exports2) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports2.YAMLMap = YAMLMap;
    exports2.findPair = findPair;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/map.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports2.map = map;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports2.YAMLSeq = YAMLSeq;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/seq.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports2.seq = seq;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/string.js"(exports2) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports2.string = string;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/common/null.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports2.nullTag = nullTag;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports2.boolTag = boolTag;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports2) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports2.stringifyNumber = stringifyNumber;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/core/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports2.schema = schema;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/json/schema.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports2.schema = schema;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports2) {
    "use strict";
    var node_buffer = require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports2.binary = binary;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports2.createPairs = createPairs;
    exports2.pairs = pairs;
    exports2.resolvePairs = resolvePairs;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports2.YAMLOMap = YAMLOMap;
    exports2.omap = omap;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports2.falseTag = falseTag;
    exports2.trueTag = trueTag;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intBin = intBin;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports2.YAMLSet = YAMLSet;
    exports2.set = set;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports2.floatTime = floatTime;
    exports2.intTime = intTime;
    exports2.timestamp = timestamp;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports2.schema = schema;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/tags.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports2.coreKnownTags = coreKnownTags;
    exports2.getTags = getTags;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/schema/Schema.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports2.Schema = Schema;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports2.stringifyDocument = stringifyDocument;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/doc/Document.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports2.Document = Document;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/errors.js"(exports2) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports2.YAMLError = YAMLError;
    exports2.YAMLParseError = YAMLParseError;
    exports2.YAMLWarning = YAMLWarning;
    exports2.prettifyError = prettifyError;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-props.js"(exports2) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports2.resolveProps = resolveProps;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-contains-newline.js"(exports2) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports2.containsNewline = containsNewline;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports2) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports2.flowIndentCheck = flowIndentCheck;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-map-includes.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports2.mapIncludes = mapIncludes;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-block-map.js"(exports2) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports2.resolveBlockMap = resolveBlockMap;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports2) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports2.resolveBlockSeq = resolveBlockSeq;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-end.js"(exports2) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports2.resolveEnd = resolveEnd;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports2.resolveFlowCollection = resolveFlowCollection;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports2.composeCollection = composeCollection;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports2.resolveBlockScalar = resolveBlockScalar;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports2.resolveFlowScalar = resolveFlowScalar;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports2.composeScalar = composeScalar;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports2) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports2.emptyScalarPosition = emptyScalarPosition;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-node.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports2.composeEmptyNode = composeEmptyNode;
    exports2.composeNode = composeNode;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/compose-doc.js"(exports2) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports2.composeDoc = composeDoc;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/compose/composer.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports2.Composer = Composer;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst-scalar.js"(exports2) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports2.createScalarToken = createScalarToken;
    exports2.resolveAsScalar = resolveAsScalar;
    exports2.setScalarValue = setScalarValue;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst-stringify.js"(exports2) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports2.stringify = stringify;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst-visit.js"(exports2) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports2.visit = visit;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/cst.js"(exports2) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports2.createScalarToken = cstScalar.createScalarToken;
    exports2.resolveAsScalar = cstScalar.resolveAsScalar;
    exports2.setScalarValue = cstScalar.setScalarValue;
    exports2.stringify = cstStringify.stringify;
    exports2.visit = cstVisit.visit;
    exports2.BOM = BOM;
    exports2.DOCUMENT = DOCUMENT;
    exports2.FLOW_END = FLOW_END;
    exports2.SCALAR = SCALAR;
    exports2.isCollection = isCollection;
    exports2.isScalar = isScalar;
    exports2.prettyToken = prettyToken;
    exports2.tokenType = tokenType;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/lexer.js"(exports2) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports2.Lexer = Lexer;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/line-counter.js"(exports2) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports2.LineCounter = LineCounter;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/parse/parser.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports2.Parser = Parser;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/public-api.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports2.parse = parse;
    exports2.parseAllDocuments = parseAllDocuments;
    exports2.parseDocument = parseDocument;
    exports2.stringify = stringify;
  }
});

// ../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/index.js
var require_dist4 = __commonJS({
  "../../../Users/gradyclopton/Projects/cross-vault-library-lab/.worktrees/linked-references/node_modules/yaml/dist/index.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports2.Composer = composer.Composer;
    exports2.Document = Document.Document;
    exports2.Schema = Schema.Schema;
    exports2.YAMLError = errors.YAMLError;
    exports2.YAMLParseError = errors.YAMLParseError;
    exports2.YAMLWarning = errors.YAMLWarning;
    exports2.Alias = Alias.Alias;
    exports2.isAlias = identity.isAlias;
    exports2.isCollection = identity.isCollection;
    exports2.isDocument = identity.isDocument;
    exports2.isMap = identity.isMap;
    exports2.isNode = identity.isNode;
    exports2.isPair = identity.isPair;
    exports2.isScalar = identity.isScalar;
    exports2.isSeq = identity.isSeq;
    exports2.Pair = Pair.Pair;
    exports2.Scalar = Scalar.Scalar;
    exports2.YAMLMap = YAMLMap.YAMLMap;
    exports2.YAMLSeq = YAMLSeq.YAMLSeq;
    exports2.CST = cst;
    exports2.Lexer = lexer.Lexer;
    exports2.LineCounter = lineCounter.LineCounter;
    exports2.Parser = parser.Parser;
    exports2.parse = publicApi.parse;
    exports2.parseAllDocuments = publicApi.parseAllDocuments;
    exports2.parseDocument = publicApi.parseDocument;
    exports2.stringify = publicApi.stringify;
    exports2.visit = visit.visit;
    exports2.visitAsync = visit.visitAsync;
  }
});

// scan_numbering.cjs
var require_scan_numbering = __commonJS({
  "scan_numbering.cjs"(exports2, module2) {
    var { parseDocument, isScalar, isMap, visit } = require_dist4();
    function numbering2(text) {
      const match = /^\uFEFF?---\r?\n([\s\S]*?)(?:\r?\n)(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
      if (!match || !match[1].includes("kl-numbering")) return {};
      try {
        if (match[1].length > 65536) throw Error("Note properties are too large to inspect numbering.");
        const doc = parseDocument(match[1], { schema: "core", uniqueKeys: true, customTags: [] });
        if (doc.errors.length) throw Error(doc.errors[0].message);
        const data = doc.toJS({ maxAliasCount: 0 });
        for (const key of ["chapter", "section"]) {
          const node = doc.getIn(["kl-numbering", key], true);
          if (isScalar(node) && /^\d+(?:\.\d+)*$/.test(node.source || "")) data["kl-numbering"][key] = node.source;
        }
        if (data?.["kl-numbering"] !== void 0) JSON.stringify(data["kl-numbering"]);
        return data && Object.hasOwn(data, "kl-numbering") ? { numbering: data["kl-numbering"] } : {};
      } catch (error) {
        return { numberingIssue: String(error.message).slice(0, 300) };
      }
    }
    function numberingEdit2(text, value) {
      const after = JSON.stringify(value), newline = text.includes("\r\n") ? "\r\n" : "\n";
      if (!after || typeof value !== "object" || Array.isArray(value)) throw Error("Numbering settings must be an object");
      const opening = /^\uFEFF?---\r?\n/.exec(text);
      if (!opening) {
        const at = text.startsWith("\uFEFF") ? 1 : 0;
        return { start: at, end: at, before: "", after: `---${newline}kl-numbering: ${after}${newline}---${newline}${newline}` };
      }
      const rest = text.slice(opening[0].length), closing = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(rest);
      if (!closing) throw Error("Close the note properties before changing numbering");
      const source = rest.slice(0, closing.index);
      if (source.length > 65536) throw Error("Note properties are too large to edit numbering");
      const doc = parseDocument(source, { schema: "core", uniqueKeys: true, customTags: [] });
      if (doc.errors.length) throw Error(doc.errors[0].message);
      if (doc.contents && !isMap(doc.contents)) throw Error("Note properties must be a mapping");
      doc.toJS({ maxAliasCount: 0 });
      const node = doc.get("kl-numbering", true), base = opening[0].length;
      if (!node) {
        const at = base + source.length;
        return { start: at, end: at, before: "", after: `kl-numbering: ${after}${newline}` };
      }
      if (node.anchor) throw Error("Numbering settings use a YAML anchor; remove that alias relationship before editing them");
      let annotated = false;
      visit(node, (_key, child) => {
        if (child !== node && (child?.comment || child?.commentBefore || child?.anchor)) annotated = true;
      });
      if (annotated && node.items?.length) throw Error("Numbering settings contain comments or anchors; edit those properties in source mode to preserve them");
      if (!node.range) throw Error("Cannot safely locate the numbering settings");
      const [from, to] = node.range, before = source.slice(from, to);
      return { start: base + from, end: base + to, before, after: (from === to ? " " : "") + after + (/\r?\n$/.test(before) ? newline : "") };
    }
    module2.exports = { numbering: numbering2, numberingEdit: numberingEdit2 };
  }
});

// plugin/component-model.js
var require_component_model = __commonJS({
  "plugin/component-model.js"(exports2, module2) {
    var { parser } = require_dist3();
    var { TreeFragment } = require_dist();
    var identity = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(local|library)$/i;
    function input(doc) {
      return typeof doc === "string" ? doc : { length: doc.length, lineChunks: true, chunk: (from) => {
        const line = doc.lineAt(from);
        return from === line.to && from < doc.length ? "\n" : line.text.slice(from - line.from);
      }, read: (from, to) => doc.sliceString(from, to) };
    }
    function read(doc, from, to) {
      return typeof doc === "string" ? doc.slice(from, to) : doc.sliceString(from, to);
    }
    function parseComponents(doc, previous = null, changes = []) {
      const fragments = previous ? TreeFragment.applyChanges(TreeFragment.addTree(previous.tree), changes) : [];
      const tree = parser.parse(input(doc), fragments), items = [], reusable = /* @__PURE__ */ new Map();
      for (const item of previous?.items || []) {
        if (changes.some((c) => c.fromA <= item.to && c.toA >= item.from)) continue;
        let delta = 0;
        for (const c of changes) if (c.toA < item.from) delta = c.toB - c.toA;
        const moved = delta ? { ...item, from: item.from + delta, to: item.to + delta } : item;
        reusable.set(moved.from, moved);
      }
      let unchanged = !!previous;
      tree.iterate({ enter(node) {
        if (node.name !== "Blockquote") return;
        const cached = reusable.get(node.from);
        if (cached && cached.to === node.to) {
          items.push(cached);
          return false;
        }
        const raw = read(doc, node.from, node.to), end = raw.indexOf("\n"), header = (end < 0 ? raw : raw.slice(0, end)).replace(/\r$/, "");
        const match = /^(>\s*)\[!([\w-]+)(?:\|([^\]]+))?\]([+-]?)(?:[ \t]+(.*))?$/.exec(header);
        if (!match) return;
        unchanged = false;
        items.push({ key: {}, from: node.from, to: node.to, raw, header, type: match[2].toLowerCase(), metadata: match[3] || "", id: (match[3] || "").split(/\s+/).find((token) => identity.test(token)) || null, fold: match[4], title: match[5] || "", eol: raw.includes("\r\n") ? "\r\n" : "\n", body: end < 0 ? "" : raw.slice(end + 1).split("\n").map((line) => line.replace(/\r$/, "").replace(/^>[ \t]?/, "")).join("\n") });
        return false;
      } });
      return { tree, items, unchanged: unchanged && items.length === previous.items.length, byKey: new Map(items.map((item) => [item.key, item])) };
    }
    function componentHeaders(source) {
      const tree = parser.parse(source), items = [], starts = [0];
      for (let n = source.indexOf("\n"); n >= 0; n = source.indexOf("\n", n + 1)) starts.push(n + 1);
      const lineAt = (pos) => {
        let lo = 0, hi = starts.length;
        while (lo + 1 < hi) {
          const mid = lo + hi >> 1;
          if (starts[mid] <= pos) lo = mid;
          else hi = mid;
        }
        return lo;
      };
      tree.iterate({ enter(node) {
        if (node.name !== "Blockquote") return;
        const end = source.indexOf("\n", node.from), to = end < 0 ? source.length : end;
        const header = source.slice(node.from, to).replace(/\r$/, "");
        const m = /^(>\s*)\[!([\w-]+)(?:\|([^\]]+))?\]([+-]?)(?:[ \t]+(.*))?$/.exec(header);
        if (!m) return;
        const close = header.indexOf("]"), metadata = m[3] || "";
        items.push({ from: node.from, to: node.to, headerTo: node.from + header.length, header, type: m[2].toLowerCase(), metadata, id: metadata.split(/\s+/).find((t) => identity.test(t)) || null, fold: m[4], foldFrom: node.from + close + 1, title: m[5] || "", line: lineAt(node.from) });
      } });
      return items;
    }
    function replaceComponent(item, { title = item.title, body = item.body, fold = item.fold, type = item.type, metadata = item.metadata } = {}) {
      if (/[\r\n]/.test(title)) throw Error("A callout title must be one line.");
      if (!["", "+", "-"].includes(fold)) throw Error("Invalid fold state.");
      if (!/^[\w-]+$/.test(type) || /[\]\r\n]/.test(metadata)) throw Error("Invalid callout metadata.");
      const header = `> [!${type}${metadata ? "|" + metadata : ""}]${fold}${title ? " " + title : ""}`;
      const eol = item.eol || "\n";
      if (body === item.body && typeof item.raw === "string") {
        if (header === item.header) return item.raw;
        const line = item.raw.indexOf("\n");
        return header + (line < 0 ? "" : eol + item.raw.slice(line + 1));
      }
      if (typeof item.raw === "string" && item.raw.includes("\n") && body) {
        const oldLines = item.body.split("\n"), next = body.split("\n"), rawLines = item.raw.slice(item.raw.indexOf("\n") + 1).split(eol);
        let first = 0, last = oldLines.length, tail = next.length;
        while (first < last && first < tail && oldLines[first] === next[first]) first++;
        while (last > first && tail > first && oldLines[last - 1] === next[tail - 1]) {
          last--;
          tail--;
        }
        return header + eol + [...rawLines.slice(0, first), ...next.slice(first, tail).map((line) => "> " + line), ...rawLines.slice(last)].join(eol);
      }
      return header + (body ? eol + body.split("\n").map((line) => "> " + line).join(eol) : "");
    }
    function cleanContents(body) {
      return body.replace(/^(\s*(?:>\s*)+\[![\w-]+)\|([^\]]+)(\])/gm, (all, head, metadata, end) => {
        const kept = metadata.split(/\s+/).filter((token) => !identity.test(token) && !/^(at|origin|rev|n)=/.test(token)).join(" ");
        return head + (kept ? "|" + kept : "") + end;
      });
    }
    function presentationBody(text) {
      const headers = componentHeaders(text);
      let result = text;
      for (const h of headers.reverse()) result = result.slice(0, h.from) + "> [!component] " + h.title + result.slice(h.headerTo);
      return result;
    }
    module2.exports = { parseComponents, replaceComponent, cleanContents, identity, componentHeaders, presentationBody };
  }
});

// plugin/component-identity-model.js
var require_component_identity_model = __commonJS({
  "plugin/component-identity-model.js"(exports2, module2) {
    var { createHash, randomUUID } = require("node:crypto");
    var { componentHeaders, identity } = require_component_model();
    var uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    var privateToken = (t) => identity.test(t) || /^(at|origin|rev|n)=/.test(t);
    var hash = (s) => createHash("sha256").update(s).digest("hex");
    function metadata(header, values) {
      const tokens = header.metadata.split(/\s+/).filter(Boolean).filter((t) => !privateToken(t));
      if (values.id) tokens.push(values.id);
      if (values.at) tokens.push("at=" + values.at);
      if (values.origin) tokens.push("origin=" + values.origin);
      const end = header.header.indexOf("]");
      return header.header.slice(0, header.header.indexOf("[!")) + `[!${header.type}${tokens.length ? "|" + tokens.join(" ") : ""}]` + header.header.slice(end + 1);
    }
    function records(text) {
      return componentHeaders(text).map((h) => {
        const start = text.lastIndexOf("\n", h.from - 1) + 1, prefix = text.slice(start, h.from);
        const raw = text.slice(h.from, h.to).split("\n").map((line, i) => i && line.startsWith(prefix) ? line.slice(prefix.length) : line).join("\n");
        const legacy = raw.replace(/^(\s*(?:>\s*)+\[![\w-]+)(?:\|[^\]]+)?\]([+-]?)([^\n]*)/gm, (_, head, fold, title) => {
          const unnumbered = title.replace(/^(\s*(?:theorem|result|definition|vocabulary|note|lemma|corollary|proposition|equation|exercise|problem|example|figure|table)\s+)(?:[A-Z]\.)?\d+(?:\.\d+)*(?:\([a-z]\))?\s*[:.)]?\s*/i, "$1");
          return head + "]" + unnumbered;
        }).replace(/\r\n/g, "\n");
        const clean = raw.replace(/^(\s*(?:>\s*)+\[![\w-]+)(?:\|[^\]]+)?\]([+-]?)([^\n]*)/gm, (_, head, fold, title) => head + "]" + title.replace(/^\s*(?:theorem|result|definition|vocabulary|note|lemma|corollary|proposition|equation|exercise|problem|example|figure|table)\s+(?:[A-Z]\.)?\d+(?:\.\d+)*(?:\([a-z]\))?\s*[:.)]?\s*/i, " ")).replace(/\r\n/g, "\n");
        const tokens = h.metadata.split(/\s+/), at = tokens.find((t) => t.startsWith("at="))?.slice(3), origin = tokens.find((t) => t.startsWith("origin="))?.slice(7);
        return { ...h, at: uuid.test(at || "") ? at : null, origin: uuid.test(origin || "") ? origin : null, raw, hash: hash(legacy), hashVersion: 2, legacyContentHash: hash(legacy.replace(/^(\s*(?:>\s*)+\[!)[\w-]+/gm, "$1component")), contentHash: hash(clean.replace(/^(\s*(?:>\s*)+\[!)[\w-]+/gm, "$1component")) };
      });
    }
    function create({ type = "note", title = "", body = "", fold = "", id = randomUUID() + ".local", at = randomUUID() } = {}) {
      if (!/^[\w-]+$/.test(type) || /[\r\n]/.test(title) || !["", "+", "-"].includes(fold) || !identity.test(id) || !uuid.test(at)) throw Error("Invalid component fields");
      return `> [!${type}|${id} at=${at}]${fold}${title ? " " + title : ""}` + (body ? "\n" + body.split("\n").map((line) => "> " + line).join("\n") : "");
    }
    module2.exports = { records, metadata, create, privateToken, hash };
  }
});

// scan_markdown.cjs
if (Number(process.versions.node.split(".")[0]) < 18) {
  process.stdout.write(JSON.stringify({ error: "Markdown scanner requires Node 18 or newer" }) + "\n");
  process.exit(1);
}
var readline = require("node:readline");
var { scan } = require_markdown_structure();
var { numbering, numberingEdit } = require_scan_numbering();
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  try {
    const request = JSON.parse(line);
    if (typeof request.text !== "string") throw Error("text must be a string");
    const result = { id: request.id, ...scan(request.text), ...numbering(request.text) };
    if (request.components) result.components = require_component_identity_model().records(request.text);
    if (Object.hasOwn(request, "numberingPatch")) {
      try {
        result.numberingEdit = numberingEdit(request.text, request.numberingPatch);
      } catch (error) {
        result.numberingEditIssue = String(error.message).slice(0, 500);
      }
    }
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }) + "\n");
  }
});
