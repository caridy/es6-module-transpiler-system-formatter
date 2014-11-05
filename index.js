/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;
var b = types.builders;
var Replacement = require('./lib/replacement');

/**
 * The 'System.register' setting for referencing exports aims to produce code that can
 * be used in environments using the System.import().
 *
 * @constructor
 */
function SystemFormatter(config) {
    this.anonymous = config && config.anonymous;
}

/**
 * Returns an expression which globally references the export named by
 * `identifier` for the given module `mod`. For example:
 *
 *    // rsvp/defer.js, export default
 *    rsvp$defer$$.default
 *
 *    // rsvp/utils.js, export function isFunction
 *    rsvp$utils$$.isFunction
 *
 * @param {Module} mod
 * @param {ast-types.Identifier} identifier
 * @return {ast-types.MemberExpression}
 */
SystemFormatter.prototype.reference = function(mod, identifier) {
  return b.memberExpression(
    b.identifier(mod.id),
    n.Identifier.check(identifier) ? identifier : b.identifier(identifier),
    false
  );
};

/**
 * Process a variable declaration found at the top level of the module. Since
 * we do not need to rewrite exported variables, we can leave variable
 * declarations alone.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Array.<ast-types.Node>}
 */
SystemFormatter.prototype.processVariableDeclaration = function(/* mod, nodePath */) {
  return null;
};

/**
 * Process a function declaration found at the top level of the module. Since
 * we do not need to rewrite exported functions, we can leave function
 * declarations alone.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @returns {Array.<ast-types.Node>}
 */
SystemFormatter.prototype.processFunctionDeclaration = function(/* mod, nodePath */) {
  return null;
};


/**
 * Process a class declaration found at the top level of the module. Since
 * we do not need to rewrite exported classes, we can leave class
 * declarations alone.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @returns {Array.<ast-types.Node>}
 */
SystemFormatter.prototype.processClassDeclaration = function(/* mod, nodePath */) {
  return null;
};

/**
 * Because exported references are captured via a closure as part of a getter
 * on the `exports` object, there's no need to rewrite local references to
 * exported values. For example, `value` in this example can stay as is:
 *
 *   // a.js
 *   export var value = 1;
 *
 * Would be rewritten to look something like this:
 *
 *   var value = 1;
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @return {ast-types.Expression}
 */
SystemFormatter.prototype.exportedReference = function(mod, referencePath) {
  return null;
};

/**
 * Gets a reference to an imported binding by getting the value from the
 * required module on demand. For example, this module:
 *
 *   // b.js
 *   import { value } from './a';
 *   console.log(value);
 *
 * Would be rewritten to look something like this:
 *
 *   var a$$ = require('./a');
 *   console.log(a$$.value):
 *
 * If the given reference does not refer to an imported binding then no
 * rewriting is required and `null` will be returned.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @return {?ast-types.Expression}
 */
SystemFormatter.prototype.importedReference = function(mod, referencePath) {
  return null;
};

/**
 * We do not need to rewrite references to local declarations.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} referencePath
 * @returns {?ast-types.Node}
 */
SystemFormatter.prototype.localReference = function(mod, referencePath) {
  return null;
};

/**
 * @param {Module} mod
 * @param {ast-types.Expression} declaration
 * @return {ast-types.Statement}
 */
SystemFormatter.prototype.defaultExport = function(mod, declaration) {
  if (n.FunctionDeclaration.check(declaration) ||
      n.ClassDeclaration.check(declaration)) {
    // export default function foo () {}
    // -> becomes:
    // function foo () {}
    // __es6_export__('default', foo);
    return [
      declaration,
      b.expressionStatement(
        b.callExpression(b.identifier('__es6_export__'), [b.literal("default"), declaration.id])
      )
    ];
  }
  // export default {foo: 1};
  return [b.expressionStatement(
    b.callExpression(b.identifier('__es6_export__'), [b.literal("default"), declaration])
  )];
};

/**
 * Replaces non-default exports. For declarations we simply remove the `export`
 * keyword. For export declarations that just specify bindings, e.g.
 *
 *   export { a, b };
 *
 * we remove them entirely since they'll be handled when we define properties on
 * the `exports` object.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
SystemFormatter.prototype.processExportDeclaration = function(mod, nodePath) {
  var node = nodePath.node,
    declaration = node.declaration,
    specifiers = node.specifiers;

  if (n.FunctionDeclaration.check(declaration) ||
      n.ClassDeclaration.check(declaration)) {
    // export function <name> () {}
    // export class <name> {}
    return Replacement.swaps(nodePath, [declaration, b.expressionStatement(
      b.callExpression(b.identifier('__es6_export__'), [b.literal(declaration.id.name), declaration.id])
    )]);
  } else if (n.VariableDeclaration.check(declaration)) {
    // export var foo = 1, bar = 3;
    declaration.declarations.forEach(function (dec) {
      if (n.VariableDeclarator.check(dec) && dec.init) {
        dec.init = b.callExpression(
          b.identifier('__es6_export__'),
          [
            b.literal(dec.id.name),
            dec.init
          ]
        );
      }
    });
    return Replacement.swaps(nodePath, declaration);
  } else if (declaration) {
    throw new Error('unexpected export style, found a declaration of type: ' + declaration.type);
  } else {
    return Replacement.swaps(nodePath, [].concat(specifiers.map(function (specifier) {
      return b.expressionStatement(
        b.callExpression(b.identifier('__es6_export__'), [b.literal((specifier.name || specifier.id).name), specifier.id])
      );
    })));
  }
};

/**
 * Since import declarations only control how we rewrite references we can just
 * remove them -- they don't turn into any actual statements.
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
SystemFormatter.prototype.processImportDeclaration = function(mod, nodePath) {
  return Replacement.removes(nodePath);
};

/**
 * Replaces reassignment of an exported with an statement to notify the update.
 * e.g.
 *
 *   foo = 1;
 *
 * will become:
 *
 *   __es6_export__("foo", foo = 1);
 *
 * @param {Module} mod
 * @param {ast-types.NodePath} nodePath
 * @return {?Replacement}
 */
SystemFormatter.prototype.processExportReassignment = function (mod, nodePath) {
  if (n.AssignmentExpression.check(nodePath.node)) {
    return Replacement.swaps(nodePath, b.callExpression(
      b.identifier('__es6_export__'),
      [
        b.literal(nodePath.get('left').value.name),
        nodePath.node
      ]
    ));
  } else if (n.UpdateExpression.check(nodePath.node) && nodePath.get("prefix").value) {
    return Replacement.swaps(nodePath, b.callExpression(
      b.identifier('__es6_export__'),
      [
        b.literal(nodePath.get('argument').value.name),
        nodePath.node
      ]
    ));
  } else if (n.UpdateExpression.check(nodePath.node) && !nodePath.get("prefix").value) {
    return Replacement.swaps(nodePath, b.sequenceExpression([
      b.callExpression(
        b.identifier('__es6_export__'),
        [
          b.literal(nodePath.get('argument').value.name),
          b.binaryExpression(
            nodePath.node.operator === '++' ? '+' : '-',
            nodePath.get('argument').value,
            b.literal(1)
          )
        ]
      ),
      nodePath.node
    ]));
  }

  return null;
};

/**
 * Convert a list of ordered modules into a list of files.
 *
 * @param {Array.<Module>} modules Modules in execution order.
 * @return {Array.<ast-types.File}
 */
SystemFormatter.prototype.build = function(modules) {
  var self = this;
  return modules.map(function(mod) {
    var body = mod.ast.program.body,
      meta = self.buildDependenciesMeta(mod),
      wrapperBlock = [];

    // module body runs in strict mode.
    body.unshift(
      b.expressionStatement(b.literal('use strict'))
    );

    // var foo, bar, baz; // which are the imported identifiers
    wrapperBlock.push(self.buildImportedVariables(mod));

    // produce a setter function per each imported module to set the local variables
    wrapperBlock = wrapperBlock.concat(self.buildSetterFunctionDeclarations(mod));

    // return { setters: [], execute: function () {} }
    wrapperBlock.push(b.returnStatement(b.objectExpression([
      b.property(
        'init',
        b.literal('setters'),
        // setters for each imported module
        b.arrayExpression(meta.setters)
      ),
      b.property(
        'init',
        b.literal('execute'),
        // module body
        b.functionExpression(null, [], b.blockStatement(body))
      )
    ])));

    var deps = b.arrayExpression(meta.deps);
    var wrapper = b.functionExpression(null, [b.identifier('__es6_export__')], b.blockStatement(wrapperBlock));

    if (self.anonymous) {
        // replacing the body of the program with the wrapped System.register() call
        mod.ast.program.body = [b.expressionStatement(b.callExpression(b.memberExpression(b.identifier('System'), b.identifier('register'), false), [
            // dependencies argument
            deps,
            // wrapper function
            wrapper
        ]))];
    } else {
        // replacing the body of the program with the wrapped System.register() call
        mod.ast.program.body = [b.expressionStatement(b.callExpression(b.memberExpression(b.identifier('System'), b.identifier('register'), false), [
            // module name argument
            b.literal(mod.name),
            // dependencies argument
            deps,
            // wrapper function
            wrapper
        ]))];
    }

    mod.ast.filename = mod.relativePath;
    return mod.ast;
  });
};

/**
 * Build a series of identifiers based on the imports (and exports with sources)
 * in the given module.
 *
 * @private
 * @param {Module} mod
 * @return {
 *   setters: {ast-types.Array}
 *   deps: {ast-types.Array}
 * }
 */
SystemFormatter.prototype.buildDependenciesMeta = function(mod) {
  var requiredModules = [];
  var importedModules = [];
  var importedModuleIdentifiers = [];

  // `(import|export) { ... } from 'math'`
  [mod.imports, mod.exports].forEach(function(declarations) {
    declarations.modules.forEach(function(sourceModule) {
      if (~requiredModules.indexOf(sourceModule)) {
        return;
      }
      requiredModules.push(sourceModule);
      importedModuleIdentifiers.push(b.identifier(sourceModule.id));

      var matchingDeclaration;
      declarations.declarations.some(function(declaration) {
        if (declaration.source === sourceModule) {
          matchingDeclaration = declaration;
          return true;
        }
      });

      assert.ok(
        matchingDeclaration,
        'no matching declaration for source module: ' + sourceModule.relativePath
      );

      importedModules.push(b.literal(matchingDeclaration.sourcePath));
    });
  });

  return {
    setters: importedModuleIdentifiers, // [path$to$foo$$, path$to$bar$$]
    deps: importedModules               // ["./foo", "./bar"]
  };
};

/**
 * Build the variable declaration statement for all imported identifiers
 * in the given module.
 *
 * @private
 * @param {Module} mod
 * @return {ast-types.VariableDeclaration}
 */
SystemFormatter.prototype.buildImportedVariables = function(mod) {
  // import {foo} from "foo"; should hoist variables declaration
  if (mod.imports.names.length > 0) {
    return b.variableDeclaration('var', mod.imports.names.map(function (name) {
      return b.identifier(name);
    }));
  } else {
    return b.emptyStatement();
  }
};

/**
 * Build a series of setter functions on the imports (and exports with sources)
 * in the given module.
 *
 * @private
 * @param {Module} mod
 * @return {ast-types.Array}
 */
SystemFormatter.prototype.buildSetterFunctionDeclarations = function(mod) {
  var fnByModule = {};

  function getFnDeclarationBody(id) {
    if (!fnByModule[id]) {
      fnByModule[id] = b.functionDeclaration(b.identifier(id), [b.identifier('m')], b.blockStatement([]));
    }
    return fnByModule[id].body.body;
  }

  mod.imports.modules.forEach(function (mod) {
    getFnDeclarationBody(mod.id);
  });

  // import {foo} from "foo"; should hoist variables declaration
  mod.imports.names.forEach(function (name) {
    var specifier = mod.imports.findSpecifierByName(name),
      id = mod.getModule(specifier.declaration.node.source.value).id;

    if (specifier.from) {
      // import { value } from './a';
      // import a from './a';
      getFnDeclarationBody(id).push(
        b.expressionStatement(b.assignmentExpression("=",
          b.identifier(specifier.name),
          b.memberExpression(
            b.identifier('m'),
            b.literal(specifier.from),
            true
          )
        ))
      );
    } else {
      // import * as a from './a'
      getFnDeclarationBody(id).push(
        b.expressionStatement(b.assignmentExpression("=",
          b.identifier(specifier.name),
          b.identifier('m')
        ))
      );
    }

  });

  mod.exports.names.forEach(function(name) {
    var specifier = mod.exports.findSpecifierByName(name),
      id;

    assert.ok(
      specifier,
      'no export specifier found for export name `' +
      name + '` from ' + mod.relativePath
    );

    if (!specifier.declaration.node.source) {
      return;
    }
    id = mod.getModule(specifier.declaration.node.source.value).id;
    getFnDeclarationBody(id).push(b.expressionStatement(
      b.callExpression(b.identifier('__es6_export__'), [
        b.literal(specifier.name),
        b.memberExpression(
          b.identifier('m'),
          b.literal(specifier.from),
          true
        )
      ])
    ));
  });

  if (Object.keys(fnByModule).length > 0) {
    return Object.keys(fnByModule).map(function (id) {
      return fnByModule[id];
    });
  } else {
    return [];
  }
};

module.exports = SystemFormatter;
