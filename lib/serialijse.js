/*global exports*/
(function () {
    "use strict";
    var assert = require("assert"),
        _ = require("underscore");

    var g_global = {};

    function declarePersistable(constructor) {
        var className = constructor.prototype.constructor.name;
        if (g_global.hasOwnProperty(className)) {
            throw new Error(" class " + className + " already registered");
        }
        assert(!g_global.hasOwnProperty(className));
        g_global[className] = constructor;
    }


    function serialize(object) {

        var index = [];
        var objects= [];

        function add_object_in_index(obj, serializing_data) {
            var id = index.length;
            obj.____index = id;
            index.push(serializing_data);
            objects.push(obj);

            return id;
        }
        function find_object(obj) {
            if (obj.____index !== undefined) {
                assert(objects[obj.____index] === obj);
                return obj.____index;
            }
            return -1;
        }
        function _serialize_object(serializingObject, object) {

            var className = object.constructor.name, s, v, id;

            // j => json object to follow
            // d => date
            // a => array
            // o => class  { c: className d: data }
            // @ => already serialized object
            if (className === "Object") {
                // default JSON object
                serializingObject["j"] = object;
                return;
            }
            if (className === "Array") {
                serializingObject["a"] = object.map(_serialize);
                return;
            }
            if (className === "Date") {
                console.log("Date");
                // default JSON object
                serializingObject["d"] = object;
                return;
            }

            if (!g_global.hasOwnProperty(className)) {
                throw new Error("class " + className + " is not registered in class Factory - deserialization will not be possible");
            }

            // check if the object has already been serialized
            id = find_object(object);

            if (id=== -1) { // not found
                // object hasn't yet been serialized
                s = {
                    c: className,
                    d: {}
                };

                id = add_object_in_index(object,s);

                for (v in object) {
                    if (object.hasOwnProperty(v) && v !== '____index') {
                        if (object[v] !== null) {
                            s.d[v] = _serialize(object[v]);
                        }
                    }
                }
            }
            serializingObject.o = id;
            return serializingObject;
        }

        function _serialize(object) {

            assert(object != undefined);

            var serializingObject = {};

            switch (typeof object) {
                case 'number':
                case 'boolean:':
                case 'string':
                    // basic type
                    return object;
                case 'object':
                    _serialize_object(serializingObject, object , index );
                    break;
                default:
                    throw new Error("invalid typeof " + typeof object + " " + JSON.stringify(object, null, " "));
            }

            return serializingObject;
        }

        var obj = _serialize(object);
        // unset temporary ___index properties
        objects.forEach(function (e) { delete e.____index; });

        return JSON.stringify([index, obj]);
    }



    function deserialize(serializationString) {


        var data = JSON.parse(serializationString),
            index = data[0],
            obj = data[1],
            cache=[];


        function deserialize_node_or_value(node) {
            if ("object" === typeof node) {
                return deserialize_node(node);
            }
            return node;
        }

        function deserialize_node(node) {
            // special treatment
            if (node.hasOwnProperty("d")) {
                return new Date(node.d);
            } else if (node.hasOwnProperty("j")) {
                return node.j;
            } else if (node.hasOwnProperty("o")) {

                var object_id = node.o;
                var serializing_data = index[object_id];
                if (cache[object_id] !== undefined) {
                    return cache[object_id];
                }

                var cache_object =  _deserialize_object(serializing_data);
                cache[object_id] = cache_object;
                return  cache_object;

            } else if (node.hasOwnProperty("a")) {
                // return _deserialize_object(node.o);
                var arr = node.a.map(deserialize_node_or_value);
                return arr;
            }
            throw new Error("Unsupported deserialize_node" + JSON.stringify(node));
        }

        function _deserialize_object(object_definition) {

            var constructor, obj, data, v, value, className;

            assert(object_definition.c);
            assert(object_definition.d);

            className = object_definition.c;
            data = object_definition.d;

            constructor = g_global[className];
            if (!constructor) {
                throw new Error(" Cannot find constructor to deserialize class of type" + className+ ". use declarePersistable(Constructor)");

            }
            assert(_.isFunction(constructor));

            obj = new constructor();

            for (v in data) {
                if (data.hasOwnProperty(v)) {
                    obj[v] = deserialize_node_or_value(data[v]);
                }
            }
            return obj;
        }


        return deserialize_node(obj);
    }

    exports.deserialize = deserialize;
    exports.serialize = serialize;
    exports.declarePersistable = declarePersistable;

}());
