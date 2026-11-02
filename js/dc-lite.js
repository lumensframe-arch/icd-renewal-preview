/* dc-lite: minimal renderer for the exported ICD design pages.
   Supports {{path}} in text and attributes, <sc-for list as>, onClick handlers and ref callbacks. */
(function () {
  function get(scope, path) {
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  var HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  function interp(str, scope) { return str.replace(HOLE, function (_, p) { var v = get(scope, p); return v == null ? '' : String(v); }); }
  function whole(str) { var m = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/.exec(str || ''); return m ? m[1] : null; }

  function DCLogic(props) { this.props = props || {}; this.state = this.state || {}; }
  DCLogic.prototype.setState = function (patch) {
    var s = this.state;
    if (typeof patch === 'function') patch = patch(s);
    for (var k in patch) s[k] = patch[k];
    if (this.__render) this.__render();
  };

  function mount(Comp, root, tpl) {
    var inst = new Comp({});
    if (!inst.state) inst.state = {};
    var handlers = {}, refs = {}, hn = 0, rn = 0;

    function proc(node, scope, out) {
      if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'helmet') return;
      if (tag === 'sc-for') {
        var lp = whole(node.getAttribute('list')), list = lp ? get(scope, lp) : null, as = node.getAttribute('as') || 'item';
        (list || []).forEach(function (item, i) {
          var s = Object.create(scope); s[as] = item; s.index = i;
          node.childNodes.forEach(function (c) { proc(c, s, out); });
        });
        return;
      }
      if (tag === 'sc-if') {
        var cp = whole(node.getAttribute('value') || node.getAttribute('test'));
        if (cp && get(scope, cp)) node.childNodes.forEach(function (c) { proc(c, scope, out); });
        return;
      }
      var el = node.cloneNode(false);
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var name = a.name.toLowerCase(), val = a.value;
        if (name === 'onclick') {
          var fn = get(scope, whole(val) || ''); el.removeAttribute(a.name);
          if (typeof fn === 'function') { var id = 'h' + (hn++); handlers[id] = fn; el.setAttribute('data-dc-click', id); }
        } else if (name === 'ref') {
          var rf = get(scope, whole(val) || ''); el.removeAttribute(a.name);
          if (typeof rf === 'function') { var rid = 'r' + (rn++); refs[rid] = rf; el.setAttribute('data-dc-ref', rid); }
        } else if (val.indexOf('{{') >= 0) {
          el.setAttribute(a.name, interp(val, scope));
        }
      });
      node.childNodes.forEach(function (c) { proc(c, scope, el); });
      out.appendChild(el);
    }

    var first = true;
    function render() {
      handlers = {}; refs = {}; hn = 0; rn = 0;
      var vals = inst.renderVals ? inst.renderVals() : {};
      var next = document.createElement('div');
      tpl.content.childNodes.forEach(function (c) { proc(c, vals, next); });
      if (first || !window.morphdom) { root.innerHTML = ''; while (next.firstChild) root.appendChild(next.firstChild); }
      else {
        window.morphdom(root, next, {
          childrenOnly: true,
          onBeforeElUpdated: function (from, to) {
            if (from.tagName === 'VIDEO') return false; /* keep playing videos untouched */
            return !from.isEqualNode(to);
          }
        });
      }
      root.querySelectorAll('[data-dc-ref]').forEach(function (el) {
        var f = refs[el.getAttribute('data-dc-ref')]; if (f) { try { f(el); } catch (e) {} }
      });
      first = false;
    }
    var queued = false;
    inst.__render = function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; render(); }); };
    root.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-dc-click]') : null;
      if (t && root.contains(t)) { var f = handlers[t.getAttribute('data-dc-click')]; if (f) f(e); }
    });
    render();
  }

  window.DCLogic = DCLogic;
  window.DCLite = { mount: mount };
})();
