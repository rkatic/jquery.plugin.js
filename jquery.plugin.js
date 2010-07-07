// WIP

(function($){

	var F = function(){},
		o = {},
		Object = o.constructor,
		hasOwn = o.hasOwnProperty,
		slice = [].slice,
		f = function(){xyz;},
		g = f, // IE9...
		superTest = /xyz/.test(g) ? /\b_super\b/ : /.*/,
		idPrefix = (+new Date + ':').slice(-9), idCounter = 0,
		undefined;
	
	function newID() {
		return idPrefix + ( ++idCounter );
	}
	
	function object(o) {
		F.prototype = o;
		return new F();
	}
	
	function branch( obj ) {
		var rv = [], prev;
		
		while ( obj && obj !== prev ) {
			rv.push( obj );
			prev = obj;
			obj = obj._parent_;
		}
		
		return rv.reverse();
	}
	
	function uncommonKeys( a, b ) {
		var rv = {}, i = 0, V;
	
		a = branch( a );
		b = branch( b );
		
		while ( a[i] && a[i] === b[i] ) {
			++i;
		}
		
		for ( ; i < b.length; ++i ) {
			var o = b[i];
			for ( var k in o ) {
				if ( hasOwn.call(o, k) ) {
					rv[ k ] = V;
				}
				else { break; }
			}
		}
		
		return rv;
	}
	
	function override( dst, src ) {
		var value, parent = dst._parent_;
		
		for ( var name in uncommonKeys(dst, src) ) {
			if ( !/^_.*_$/.test(name) ) {
				value = src[ name ];
				dst[ name ] = $.isFunction( value ) && superTest.test( value ) ?
					superWrap( value, parent, name ) : value;
			}
		}
		
		return dst;
	}
	
	function superWrap( func, parent, name ) {
		var s = "_super";
	
		return function() {
			var tmp = this[s];
			this[s] = parent[ name ];
			var ret = func.apply( this, arguments );
			this[s] = tmp;
			return ret;
		};
	}
	
	function setObject( obj, path, value ) {
		var names = path.split("."),
			last = names.pop();
		
		for ( var i = 0, l = names.length; i < l; ++i ) {
			obj = obj[ names[i] ] || ( obj[ names[i] ] = {} );
		}
		
		obj[ last ] = value;
	}
	
	$.isClass = function( obj ) {
		return obj && obj.fn && obj.fn._class_ === obj || false;
	};

	$.plugin = function plugin( path ) {
		var args = slice.call( arguments, 1 ),
			base = $.isClass( args[0] ) ? args.shift() : $.plugin.base,
			name = path.split(".").pop();
		
		var plugin = base.extended.apply( base, args );
		
		plugin._name_ = name;
		plugin._fullName_ = path.split(".").join("-");
		
		setObject( $, path, plugin );
		
		$.plugin.bridge( name, plugin );
		
		return plugin;
	};
	
	$.plugin.bridge = function( name, plugin ) {    
		this.fn[ name ] = function( first ) {
			var rv = this,
				id = plugin._id_,
				args = slice.call( arguments, 1 ),
				method;
				
			if ( typeof first === "string" ) {
				method = plugin.fn[ first ];
				
				if ( !$.isFunction(method) ) {
					$.error("'" + first + "' is not a method");
				}
				
			} else if ( $.isFunction(first) ) {
				method = first;
			}
		
			if ( method ) {
				this.each(function() {
					var instance = $.data( this, id ),
						ret = instance && method.apply( instance, args );
					
					if ( ret !== instance && ret !== undefined ) {
						rv = ret;
						return false;
					}
					
					return true;
				});
				
			} else {
				this.each(function() {
					var instance = $.data( this, id );
					
					if ( instance ) {
						instance.option( first );
						
					} else {
						plugin.create( this, first );
					}
				});
			}
			
			return rv;
		};
	};
	
	// Generic base class.
	$.base = {
		_id_: newID(),
	
		// Static method to use to create an instance.
		create: function() {
			// Inline the object function to avoid the aditional call.
			F.prototype = this.fn;
			var instance = new F();
			instance.init.apply( instance, arguments );
			return instance;
		},
		
		_subclass_: function() {
			var cls = object( this );
			cls.fn = object( this.fn );
			cls._parent_ = this;
			cls.fn._parent_ = this.fn;
			cls._id_ = newID();
			cls.fn._class_ = cls;
			return cls;
		},
		
		// Static method to define a subclass.
		extended: function() {
			var rv = this._subclass_();
			
			for ( var arg, i = 0; i < arguments.length; ++i ) {
				arg = arguments[i];
				( $.isClass( arg ) ? rv : rv.fn ).extend( arg );
			}
			
			return rv;
		},
		
		extend: function( props ) {
			var fn = this.fn;
			override( this, props );
			this.fn = fn;
			
			if ( props.fn ) {
				this.fn.extend( props.fn );
			}
			
			return this;
		},
		
		isClassOf: function( obj ) {
			return this.fn.isPrototypeOf( obj );
		}
	};
	
	// Some mobile browsers have not isPrototypeOf!
	if ( !o.isPrototypeOf ) {
		$.base.isClassOf = function( obj ) {
			var prev, proto = this.fn;
			
			while ( obj && obj !== prev ) {
				if ( obj === proto ) {
					return true;
				}
				prev = obj;
				obj = obj._parent_;
			}
			
			return false;
		};
	}
	
	$.base.fn = {
		_class_: $.base,
		
		//constructor
		init: function(){},
		
		extend: function( props ) {
			return override( this, props );
		}
	};
	
	
	$.plugin.base = $.base.extended({
		options: {},
		
		extend: function( props ) {
			var options = this.options;
			$.base.extend.call( this, props );
			this.options = options;
			
			if ( props.options ) {
				$.extend( this.options, props.options )
			}
			
			return this;
		},
		
		option: function( name, value ) {
			if ( typeof name === "object" ) {
				for ( var key in name ) {
					this.setOption( key, name[key] );
				}
				
			} else if ( value === undefined ) {
				return this.options[ name ];
				
			} else {
				this.setOption( name, value );
			}
			
			return this;
		},
		
		setOption: function( name, value ) {
			this.options[ name ] = value;
		},
		
		destroy: function() {
			$.removeData( this.element[0], this._class_._id_ );
			return this;
		}
	});
	
	$.plugin.base.extend({
		create: function( el, options ) {
			var instance = $.data( el, this._id_ );
			if ( instance ) {
				instance.destroy();
			}
		
			instance = object( this.fn );
			instance.element = $(el);
			instance.element.bind('remove', function(){ instance.destroy(); });
			$.data( el, this._id_, instance );
			
			instance.options = $.extend( {}, this.fn.options, options );
			instance.init();
			
			return instance;
		},
		
		_subclass_: function() {
			var rv = $.base._subclass_.call( this );
			
			rv.fn.options = object( this.fn.options );
			
			return rv;
		}
	});
	
})(jQuery);

