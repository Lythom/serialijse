(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.serialijse = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*global exports,require*/
var lib = require("./lib/serialijse");
exports.serialize = lib.serialize;
exports.deserialize = lib.deserialize;
exports.declarePersistable = lib.declarePersistable;

},{"./lib/serialijse":2}],2:[function(require,module,exports){
(function (exports) {
    "use strict";
    var g_global = {};

    var isFunction = function(obj) {
        return typeof obj == 'function' || false;
    };

    function registerConstructor(object) {
        var constructor = object.constructor;
        if (constructor != null) {
            var constructorName = object.constructor.name;
            if (constructorName !== '') {
                g_global[constructorName] = constructor;
            } else {
                throw new Error("Can't serialize with anonymous constructors.");
            }
        } else {
            throw new Error("Can't serialize with no constructor.");
        }
    }

    function declarePersistable(constructor) {
        var className = constructor.prototype.constructor.name;
        if (!g_global.hasOwnProperty(className)) {
            g_global[className] = constructor;
        }
    }

    function serialize(object) {

        if(object === undefined){
            throw new Error("serialize: expect a valid object to serialize ");
        }

        var index = [];
        var objects = [];

        function add_object_in_index(obj, serializing_data) {
            var id = index.length;
            obj.____index = id;
            index.push(serializing_data);
            objects.push(obj);

            return id;
        }

        function find_object(obj) {
            if (obj.____index !== undefined) {
                return obj.____index;
            }
            return -1;
        }

        function _serialize_object(serializingObject, object) {

            if (object === null) {
                serializingObject.o = null;
                return;
            }


            var className = object.constructor.name, s, v, id;

            // j => json object to follow
            // d => date
            // a => array
            // o => class  { c: className d: data }
            // o => null
            // @ => already serialized object

            if (className === "Array") {
                serializingObject["a"] = object.map(_serialize);
                return;
            }
            if (className === "Date") {
                serializingObject["d"] = object.getTime();
                return;
            }
            if (className !== "Object" && !g_global.hasOwnProperty(className) ) {
                registerConstructor(object);
            }

            // check if the object has already been serialized
            id = find_object(object);

            if (id === -1) { // not found
                // object hasn't yet been serialized
                s = {
                    c: className,
                    d: {}
                };

                id = add_object_in_index(object, s);

                if (object != null && isFunction(object._serialize)) {
                    s.d = object._serialize();
                } else {
                    for (v in object) {
                        if (object.hasOwnProperty(v) && v !== '____index') {
                            s.d[v] = _serialize(object[v]);
                        }
                    }
                }


            }
            serializingObject.o = id;
            return serializingObject;
        }

        function _serialize(object) {

            if (object === undefined) {
                return undefined;
            }

            var serializingObject = {};

            switch (typeof object) {
                case 'number':
                case 'boolean':
                case 'string':
                    // basic type
                    return object;
                case 'object':
                    _serialize_object(serializingObject, object, index);
                    break;
                default:
                    throw new Error("invalid typeof " + typeof object + " " + JSON.stringify(object, null, " "));
            }

            return serializingObject;
        }

        var obj = _serialize(object);
        // unset temporary ___index properties
        objects.forEach(function (e) {
            delete e.____index;
        });

        return JSON.stringify([index, obj]);// ,null," ");
    }


    function deserialize(serializationString) {


        var data;
        if (typeof serializationString === 'string') {
            data = JSON.parse(serializationString);
        } else if (typeof serializationString ==='object') {
            data = serializationString;
        }
        var index = data[0],
            obj = data[1],
            cache = [];

        function deserialize_node_or_value(node) {
            if ("object" === typeof node) {
                return deserialize_node(node);
            }
            return node;
        }

        function deserialize_node(node) {
            // special treatment
            if (!node) { return null;}

            if (node.hasOwnProperty("d")) {
                return new Date(node.d);
            } else if (node.hasOwnProperty("j")) {
                return node.j;
            } else if (node.hasOwnProperty("o")) {

                var object_id = node.o;

                if (object_id === null) {
                    return null;
                }
                if (cache[object_id] !== undefined) {
                    return cache[object_id];
                }
                var serializing_data = index[object_id];

                var cache_object = _deserialize_object(serializing_data, object_id);
                return  cache_object;

            } else if (node.hasOwnProperty("a")) {
                return node.a.map(deserialize_node_or_value);
            }
            throw new Error("Unsupported deserialize_node" + JSON.stringify(node));
        }

        function _deserialize_object(object_definition, object_id) {

            var constructor, obj, data, v, className;

            className = object_definition.c;
            data = object_definition.d;

            if (className === "Object") {
                obj = {};
            } else {
                constructor = g_global[className];
                if (!constructor) {
                    throw new Error(" Cannot find constructor to deserialize class of type" + className + ".");
                }
                if (isFunction(constructor.prototype._deserialize)) {
                    return constructor.prototype._deserialize(data);
                } else {
                    obj = new constructor();
                }
            }

            cache[object_id] = obj;
            for (v in data) {
                if (data.hasOwnProperty(v)) {
                    try {
                        obj[v] = deserialize_node_or_value(data[v]);
                    }
                    catch(err) {
                        console.log(" property : ", v);
                        console.log(err);
                        throw err;
                    }
                }
            }
            return obj;
        }


        return deserialize_node(obj);
    }

    exports.deserialize = deserialize;
    exports.serialize = serialize;
    exports.declarePersistable = declarePersistable;


})(typeof exports === 'undefined'? this['serialijse']={}: exports);


},{}]},{},[1])(1)
});