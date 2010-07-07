(function($){

    var F = function(){},
        slice = Array.prototype.slice,
        superTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/,
        idPrefix = (+new Date + ':').slice(-9), idCounter = 0;
    
    // we need this one because $.data( obj ) === $.data( create(obj) )
    function newID() {
        return idPrefix + ( ++idCounter );
    }
    
    function create(o) {
        F.prototype = o;
        return new F();
    }
    
    function override( dst, src, proto, areStatics ) {
        proto = proto || Object.prototype;
        var value, specialTest = areStatics ? /^(_.*_|fn)$/ : /^_.*_$/;
        
        for ( var name in src ) {
            if ( !specialTest.test(name) ) {
                value = src[name];
                dst[name] = $.isFunction(value) && superTest.test(value) ?
                    proxy( value, proto, name ) : value;
            }
        }
        
        return dst;
    }
    
    function proxy( value, proto, name ) {
        return function() {
            var tmp = this._super;
            this._super = proto[name];
            var ret = value.apply(this, arguments);
            this._super = tmp;
            return ret;
        }
    }
    
    $.isClass = function( obj ) {
        return obj && obj.fn && obj.fn._class_ === obj;
    };

    $.plugin = function plugin( name, props ) {
        var plugin, base = $.plugin.base;
        
        if ( $.isClass(props) ) {
            //$.plugin( name, base [, props] )
            base = props;
            props = arguments[2];
            if ( props === false ) {
                //$.plugin( name, plugin, false )
                plugin = base;
            }
        }
        
        plugin = plugin || base.extended( name, props );
                
        this[ name ] = plugin;
        
        this.fn[ name ] = function( first ) {
            if ( typeof first === "string" ) {
                //if first argument is a string then it is a method name to call
                var ret, instance, id = plugin._id_, args = slice.call(arguments, 1);
                for ( var i = 0, length = this.length; i < length; ++i ) {
                    if ( instance = $.data( this[i], id )
                      && ( ret = instance[first].apply(instance, args) ) !== instance ) {
                        return ret;
                    }
                }
                return this;
                
            } else if ( $.isFunction(first) ) {
                //if first argument is a function then call it for each instance
                var instance, id = plugin._id_, args = slice.call(arguments, 1);
                for ( var i = 0, length = this.length; i < length; ++i ) {
                    if ( instance = $.data( this[i], id ) && first.apply(instance, args) === false ) {
                        break;
                    }
                }
                return this;
                
            } else {
                //otherwise we create plugin instances for each node
                //and the first argument (if exists) is an options hash
                return this.each(function() {
                    plugin.create( this, first );
                });
            }
        };
        
        return plugin;
    };
    
    //generic base class
    $.base = {
        _name_: "base",
        _id_: newID(),
    
        //static method to use instead of the 'new' operator to create an instance
        create: function() {
            F.prototype = this.fn;
            var instance = new F();
            instance.init.apply( instance, arguments );
            return instance;
        },
        
        //static method to define a subclass (metaprogramming)
        extended: function( props ) {
            var name = '', ret = create( this );
            ret.fn = create( this.fn );
            
            if ( typeof props === "string" ) {
                name = props;
                props = arguments[1];
            }
            
            ret._name_ = name;
            ret._base_ = this;
            ret._id_ = newID();
            ret.fn._class_ = ret;
            
            if ( props ) {
                ret.fn.extend( props );
            }
            
            return ret;
        },
        
        extend: function( props ) {
            override( this, props, this._base_, true );
            
            if ( props.fn ) {
                this.fn.extend( props.fn )
            }
            
            return this;
        },
        
        isClassOf: function( obj ) {
            return this.fn.isPrototypeOf( obj );
        }
    };
    
    $.base.fn = {
        _class_: $.base,
        
        //constructor
        init: function(){},
        
        extend: function( props ) {
            var superClass = this._class_._base_;
            return override( this, props, ( superClass && superClass.fn ) );
        }
    };
    
    
    $.plugin.base = $.base.extended("plugin_base").extend({
    
        create: function( el, options ) {
            var instance = $.data( el, this._id_ );
            if ( instance ) {
                instance.destroy();
            }
        
            instance = create( this.fn );
            instance.el = el;
            instance.$el = $(el);
            instance.$el.bind('remove', function(e){ instance.destroy(); });
            $.data( el, this._id_, instance );
            
            instance._opt = $.extend( {}, this._options_, options );
            instance.init();
            
            return instance;
        },
        
        extended: function() {
            var ret = $.base.extended.apply( this, arguments );
            
            //default options inherits default options of parent plugin
            ret._options_ = create( this._options_ );
            
            return ret;
        },
        
        setOptions: function( options ) {
            $.extend( this._options_, options );
            return this;
        }
    });

    $.plugin.base._options_ = {};
        
    $.plugin.base.fn.destroy = function() {
       $.removeData( this.el, this._class_._id_ );
       return this;
    };
    
})(jQuery);


