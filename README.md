es6-module-transpiler-system-formatter
======================================

ES6 Module Transpiler Formatter to Output `System.register()` Format

## Overview

ES6 Module Transpiler `es6-module-transpiler` is an experimental compiler that allows you to write your JavaScript using a subset of the current ES6 module syntax, and compile it into various formats. The `es6-module-transpiler-system-formatter` is one of those output formats that is focus on bringing the ES6 module semantics back to ES5 so you can start using those modules today.

Part of the discussion around this format happened in a github issue https://github.com/google/traceur-compiler/issues/1072, If you plan to understand how this works, make sure you read the thread before asking questions :p

The output of this formatter can be used with [SystemJS] and [es6-micro-loader][].

[es6-micro-loader]: https://github.com/caridy/es6-micro-loader
[SystemJS]: https://github.com/systemjs/systemjs
[es6-module-transpiler]: https://github.com/square/es6-module-transpiler

## Disclaimer

This format is experimental, and it is a living creature, we will continue to tweak it until we fill it is good enough, and then we will change it again :p

You can also use [traceur-compiler][], which implements the same output format with it's own flavors and optimizations. The output should be interchangeable.

[traceur-compiler]: https://github.com/google/traceur-compiler


## Usage

### Build tools

Since this formatters is an plugin for [es6-module-transpiler], you can use it with any existing build tool that supports [es6-module-transpiler] as the underlaying engine to transpile the ES6 modules.

You just need to make sure that `es6-module-transpiler-system-formatter` is accessible for those tools, and pass the proper `formatter` option thru the [es6-module-transpiler]'s configuration.

### Executable

If you plan to use the `compile-module` CLI, the formatters can be used directly from the command line:

```
$ npm install -g es6-module-transpiler
$ npm install es6-module-transpiler-system-formatter
$ compile-modules convert -f ./node_modules/es6-module-transpiler-system-formatter path/to/**/*.js -o build/
```

__The `-f` option allow you to specify the path to the specific formatter.__

### Library

You can also use the formatter with the transpiler as a library:

```javascript
var transpiler = require('es6-module-transpiler');
var SystemFormatter = require('es6-module-transpiler-system-formatter');
var Container = transpiler.Container;
var FileResolver = transpiler.FileResolver;

var container = new Container({
  resolvers: [new FileResolver(['lib/'])],
  formatter: new SystemFormatter()
});

container.getModule('index');
container.write('out/mylib.js');
```

## Supported ES6 Module Syntax

Again, this syntax is in flux and is closely tracking the module work being done by TC39. This package relies on the syntax supported by [es6-module-transpiler], which relies on [esprima], you can have more information about the supported syntax here: https://github.com/square/es6-module-transpiler#supported-es6-module-syntax

[esprima]: https://github.com/ariya/esprima

## Compiled Output

First of all, the output format for `System.register()` might looks alien for many, this is meant to be understood by the loader extension, and considering that [es6-module-transpiler] relies on [Recast] to mutate the original ES6 code, it can output the corresponding [sourceMap], you should be able to debug the module code without having to understand the actual output format.

Second, this output is trying to preserve the semantics of the ES6 modules, including the delayed execution, circular dependencies, on-demand fetching of dependencies, and live bindings. Therefore, there will be weird code that needs to be introduced to preserve those semantic.

[sourceMap]: http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/
[Recast]: https://github.com/benjamn/recast

### Default export

For a module without imports, and a single default exports:

```javascript
export default function (a, b) {
  return a + b;
}
```

will produce something like this:

```javascript
System.register("component/foo", [], function(__es6_export__) {
  return {
    "setters": [],
    "execute": function() {
      "use strict";
      __es6_export__("default", function(a, b) {
        return a + b;
      });
    }
  };
});
```

### Imports and exports

A more complex example will look like this:

```javascript
import assert from "./assert";

export default function (a, b) {
  assert(a);
  assert(b);
  return a + b;
};
```

and the output will be:

```javascript
System.register("component/foo", ["./assert"], function(__es6_export__) {
  var assert;

  function component$assert$$(m, name) {
    assert = m["default"];
  }

  return {
    "setters": [component$assert$$],
    "execute": function() {
      "use strict";
      __es6_export__("default", function(a, b) {
        assert(a);
        assert(b);
        return a + b;
      });
    }
  };
});
```

Part of the goal, is try to preserve as much as possible the original code of the module within the `execute` function. Obviously, this is difficult when you have to export default functions and other declarations. The only modifications you will see in the body are the calls to the `__es6_export__()` method to notify loader that there is a new value for one of the live bindings (export statements), the rest of the code will remain immutable.

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

Thanks, and enjoy living in the ES6 future!
