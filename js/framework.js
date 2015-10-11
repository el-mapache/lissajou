(function(root) {
  root.VL = root.VL || {};


   Utils = VL.Utils = {};
    /* Helpers */
    var create = Utils.create = function(proto, staticP) {
      var parent = this;
      var child;

      if (proto && proto.hasOwnProperty('constructor')) {
        child = proto.constructor;
      } else {
        child = function() {
          return parent.apply(this, arguments);
        };
      }


      var Ancestor = function() {
        this.constructor = child;
      };

      Ancestor.prototype = parent.prototype;
      child.prototype = new Ancestor;

      if (proto) {
        Utils.extend(child.prototype, proto, staticP);
      }

      return child;
    };



    var uniqueId = Utils.uniqueId = (function() {
      var idCounter = 0;

      return function() {
        var id = idCounter;
        idCounter++;
        return id;
      };
    }());

    var extend = Utils.extend = function(dest) {
      var args = [].slice.call(arguments, 1);

      if (!dest) return;

      while (args.length != 0) {
        var source = args.shift();
        for (var prop in source)  {
          dest[prop] = source[prop];
        }
      }

      return dest;
    };

    var forEach = Utils.forEach = function(list, callback) {
      var ii = -1;
      var length = list.length;

      while (++ii < length) {
        callback(list[ii], ii, list);
      }
    };





  var EventEmitter = function() {};

  EventEmitter.prototype = {
    _events: {},

    on: function(event, fn, context) {
      this._events = this._events || {};
      this._events[event] = this._events[event] || [];
      this._events[event].push({fn: fn, ctx: context || this});
    },

    unbind: function(event, fn) {
      this._events = this._events || {};
      if (!event in this._events) return;

      var eventList = this._events[event];

      fn ? eventList.splice(eventList.indexOf(fn), 1) : eventList = null;
    },

    trigger: function(event) {
      this._events = this._events || {};
      var events = this._events[event] || [];

      var handlerCount = 0;
      var len = events.length;

      var allEvents = this._events['all'];

      if (allEvents) {
        var currEventCount = 0;
        var length = allEvents.length;

        while (currEventCount < length) {
          var handlerObj = allEvents[currEventCount];

          handlerObj.fn.apply(handlerObj.ctx, [].slice.call(arguments));
          currEventCount++;
        }
      }

      while (handlerCount < len) {
        var handlerObj = events[handlerCount];
        handlerObj.fn.apply(handlerObj.ctx, [].slice.call(arguments));
        handlerCount++;
      }
    },

    attachTo: function(destObject) {
      var props = ['on', 'unbind', 'trigger'];
      var ii = -1;
      var len = props.length;

      while ((ii = ii + 1) < len) {
        if ( typeof destObject === 'function' ) {
          destObject.prototype[props[ii]]  = this[props[ii]];
        } else {
          destObject[props[ii]] = this[props[ii]];
        }
      }
    }
  };

  root.VL.Events = EventEmitter;




  var Collection = function(options) {
    options = options || {};

    this.length = 0;
    this.modelsLookup = {};
    this.models = [];

    this.add(options.models);
    this.init.apply(this, arguments);
  };

  extend(Collection.prototype, {
    init: function() {},

    add: function(models) {
      if (!models) {
        return this;
      }

      models = models instanceof Array ? models : [models];

      forEach(models, this._addModel.bind(this));

      return this;
    },

    remove: function(model) {
      var idToRemove = model && model.id;
      var arrayIndex = this.modelsLookup[idToRemove];

      if (!arrayIndex && arrayIndex !== 0) {
        return this;
      }

      // Remove the model from the array and decrement the collection counter
      var removed = this.models.splice(arrayIndex, 1)[0];
      this.length--;

      // Remove the model from the lookup table
      delete this.modelsLookup[idToRemove];

      // Reindex the lookup
      var lookup = this.modelsLookup;
      this.models.forEach(function(model, index) {
        lookup[model.id] = index;
      });

      this.trigger('collection.remove', removed, this);

      return this;
    },

    get: function(id) {
      if (!id) {
        return this.getAll();
      }

      return this.at(this.modelsLookup[id]);
    },

    getAll: function() {
      return this.models;
    },

    at: function(index) {
      return this.models[index] || null;
    },

    first: function() {
      return this.models[0] || null;
    },

    last: function() {
      return this.models[this.length - 1] || null;
    },

    each: function(callback) {
      forEach(this.models, function(model) {
        callback(model);
      });
    },

    _addModel: function(model, index) {
      // The model is already in the collection.
      if (this.modelsLookup[model.id]) {
        return;
      }

      // Add the model to the list of models.
      this.models.push(model);

      // Add an entry into the lookup table.
      this.modelsLookup[model.id] = this.length;

      model.on('all', this._passModelEvent, this);

      this.length++;

      this.trigger('collection.add');
    },

    _passModelEvent: function(eventName, newVal, oldVal, model) {
      this.trigger(eventName, newVal, oldVal, model);
    },
  });

  root.VL.Events.prototype.attachTo(Collection);

  root.VL.Collection = Collection;




  var Model = function(options) {
    this.id = 'model' + uniqueId();
    this.attributes = {};

    this._buildAttributes(options);
    this.init.apply(this, arguments);
  };

  extend(Model.prototype, {
    init: function(options) {},

    set: function(prop, value) {
      var attrs = this.attributes;

      if (!attrs.hasOwnProperty(prop)) return;

      // Stpre a reference to the previous value to determine whether a
      // 'change' event should fire.
      var old = attrs[prop];

      attrs[prop] = value;

      if (value !== old) {
        this.trigger('model.change.' + prop, value, old, this);
      }

      return attrs[prop];
    },

    get: function(prop) {
      var got = this.attributes[prop];

      if (!got) return null;

      return got;
    },

    _buildAttributes: function(options) {
      var defaults = extend({}, this.defaults);

      if (!defaults || typeof defaults !== 'object') {
        return;
      }

      extend(this.attributes, defaults, options || {});
    },

    // Return a copy of the model's attributes as a javascript object
    data: function() {
      return extend({}, this.attributes);
    }
  });

  root.VL.Events.prototype.attachTo(Model);
  root.VL.Model = Model;



  var View = function(options) {
    this.id = 'view' + uniqueId();
    options = options || {};

    this._setFromOptions(options);
    this._getElement();
    this._bindEvents();

    this.init.apply(this, arguments);
  };

  extend(View.prototype, {
    render: function() {
      return this;
    },

    init: function(options) {
      return this;
    },

    find: function(selector) {
      return this.el.querySelector(selector);
    },

    _setFromOptions: function(options) {
      var OPTIONS = ['template', 'el', 'model', 'collection'];

      for (var option in options) {
        if (~OPTIONS.indexOf(option.toLowerCase())) {
          this[option] = options[option];
        }
      }
    },

    _getElement: function() {
      if (!this.el) {
        this.el = document.createElement('div');
      } else {
        this.el = document.querySelector(this.el);
      }

      return this;
    },

    _bindEvents: function() {
      var events = this.events;

      if (!events) return;


      for (var event in events) {
        if (!event) continue;

        var method = this[events[event]];

        if (typeof method !== 'function') {
          throw new Error('Method not found on view.');
        }

        // An event pair is comprised of a selector, followed by
        // the name of the event to lsiten for.
        var eventPair = event.split(' ');

        var selector = eventPair[0];
        var eventName = eventPair[1];

        this._onEvent(this.el, selector, eventName, method);
      }
      return this;
    },

    _onEvent: function(parent, target, eventName, callback) {
      function isEventTarget(event) {
       if (event.target === this.find(target)) {
          callback.call(this, event);
        }
      }

      parent.addEventListener(eventName, isEventTarget.bind(this));
    }
  });

  root.VL.Events.prototype.attachTo(View);

  root.VL.View = View;


  View.extend = Model.extend = Collection.extend = create;





  if (module && module.exports) {
    module.exports = root.VL;
  } else {
    return root;
  }
}(window));