// WIP

(function($){

	var F = function(){},
		o = {},
		hasOwn = o.hasOwnProperty,
		slice = [].slice,
		f = function(){xyz;},
		g = f, // IE9...
		superTest = /xyz/.test(g) ? /\b_super\b/ : /.*/,
		specialTest = /^_.*_$/;
		idCounter = 0,
		undefined;
	
	function object(o) {
		F.prototype = o;
		return new F();
	}
	
	function collectOwnKeys( o, res, value ) {
		for ( var k in o ) {
			if ( !hasOwn.call(o, k) ) {
				break;
				
			} else if ( !specialTest.test(k) ) {
				res[ k ] = value;
			}
		}
	}
	
	function extend( dst, src, it ) {
		for ( var i in ( it || src ) ) {
			dst[i] = src[i];
		}
		return dst;
	}
	
	function update( dst, src ) {
		var ckeys = {}, pkeys = {},
			c = src;
				
		while ( c && c !== dst && !c.isSuperOf(dst) ) {
			collectOwnKeys( c, ckeys );
			collectOwnKeys( c.fn, pkeys );
			
			c = c._parent_;
		}
		
		delete pkeys.init;
		delete ckeys.fn;
	
		extend( dst, src, ckeys );
		extend( dst.fn, src.fn, pkeys );
		
		return dst;
	}
	
	function override( dst, src ) {
		var value, parent = dst._parent_ || dst._class_._parent_.fn;
		
		for ( var name in src ) {
			if ( !specialTest.test(name) ) {
				value = src[ name ];
				dst[ name ] = ( name in parent ) && $.isFunction( value ) && superTest.test( value ) ?
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
	
	$.isClass = function( obj ) {
		return obj && obj.fn && obj.fn._class_ === obj || false;
	};

	$.plugin = function plugin( path ) {
		var args = slice.call( arguments, 1 ),
			base = $.isClass( args[0] ) ? args.shift() : $.plugin.base,
			ns = $,
			ns_names = path.split("."),
			name = ns_names.pop(),
			plugin = base.extended.apply( base, args );
		
		plugin._name_ = name;
		plugin._fullName_ = path.split(".").join("-");
		
		$.each( ns_names, function( name ) {
			ns = ns[ name ] || ( ns[ name ] = {} );
		});
		
		ns[ name ] = plugin;
		
		$.plugin.bridge( name, plugin );
		
		return plugin;
	};
	
	$.plugin.bridge = function( name, plugin ) {    
		$.fn[ name ] = function( first ) {
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
						first && instance.option( first );
						
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
		_id_: (+new Date + '').slice(-8),
		
		isSuperOf: o.isPrototypeOf || function(o) {
			var prefix = this._id_ + ':';
			return o && ( o._id_ + '' ).slice( 0, prefix.length ) === prefix || false;
		},
	
		// Static method to use to create an instance.
		create: function() {
			// Inlined object().
			F.prototype = this.fn;
			var instance = new F();
			
			instance.init.apply( instance, arguments );
			return instance;
		},
		
		__subclass: function() {
			var cls = object( this );
			cls.fn = object( this.fn );
			cls._parent_ = this;
			cls._id_ = this._id_ + ':' + ( ++idCounter );
			cls.fn._class_ = cls;
			return cls;
		},
		
		// Static method to define a subclass.
		extended: function() {
			var rv = this.__subclass();
			
			for ( var arg, i = 0; i < arguments.length; ++i ) {
				arg = arguments[i];
				( $.isClass( arg ) ? rv : rv.fn ).extend( arg );
			}
			
			return rv;
		},
		
		extend: function( obj ) {
			if ( $.isClass(obj) ) {
				update( this, obj );
				
			} else {
				var fn = this.fn;
				override( this, obj );
				this.fn = fn;
				
				if ( obj.fn ) {
					this.fn.extend( obj.fn );
				}
			}
			
			return this;
		}
	};
	
	$.base.fn = {
		_class_: $.base,
		
		//constructor
		init: function(){},
		
		extend: function( props ) {
			return override( this, props );
		},
		
		instanceOf: function( cls ) {
			if ( $.isArray(cls) ) {
				for ( var i = 0; i < cls.length; ++i ) {
					if ( this.instanceOf( cls[i] ) ) {
						return true;
					}
				}
				return false;
			}
			
			return cls === this._class_ || cls.isSuperOf( this._class_ );
		}
	};
	
	
	$.plugin.base = $.base.__subclass();
	
	extend( $.plugin.base.fn, {
		options: {},
	
		extend: function( props ) {
			var options = this.options;
			$.base.extend.call( this, props );
			this.options = options;
			
			if ( props.options ) {
				extend( this.options, props.options )
			}
			
			return this;
		},
		
		option: function( name, value ) {
			if ( value === undefined ) {
				if ( typeof name === "string" ) {
					return this.options[ name ];
				}
				
				extend( this.options, name );
				
			} else {
				this.options[ name ] = value;
			}
			
			return this;
		},
		
		destroy: function() {
			$.removeData( this.element[0], this._class_._id_ );
			return this;
		}
	});
	
	extend( $.plugin.base, {
		create: function( el, options ) {
			var instance = $.data( el, this._id_ );
			instance && instance.destroy();
		
			instance = object( this.fn );
			instance.element = $(el).bind('remove', function(){ instance.destroy(); });
			$.data( el, this._id_, instance );
			
			instance.options = extend( extend( {}, instance.options ), options );
			
			instance.init();
			
			return instance;
		},
		
		__subclass: function() {
			var rv = $.base.__subclass.call( this );
			
			rv.fn.options = object( this.fn.options );
			
			return rv;
		}
	});
	
})(jQuery);

