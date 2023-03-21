import * as fs from "fs";
import * as path from "path";
import { dirname } from "path";
import * as process from "process";
import * as vm from "vm";
import {
  ENV_WING_SIM_INFLIGHT_RESOURCE_PATH,
  ENV_WING_SIM_INFLIGHT_RESOURCE_TYPE,
} from "./function";
import { ISimulatorResourceInstance } from "./resource";
import {
  FunctionAttributes,
  FunctionSchema,
  FUNCTION_TYPE,
} from "./schema-resources";
import { IFunctionClient } from "../cloud";
import { ISimulatorContext } from "../testing/simulator";
import { Module } from "module";

export class Function implements IFunctionClient, ISimulatorResourceInstance {
  private readonly filename: string;
  private readonly env: Record<string, string>;
  private readonly context: ISimulatorContext;
  private readonly timeout: number;

  constructor(props: FunctionSchema["props"], context: ISimulatorContext) {
    if (props.sourceCodeLanguage !== "javascript") {
      throw new Error("Only JavaScript is supported");
    }
    this.filename = path.resolve(context.simdir, props.sourceCodeFile);
    this.env = props.environmentVariables ?? {};
    this.context = context;
    this.timeout = props.timeout;
  }

  public async init(): Promise<FunctionAttributes> {
    return {};
  }

  public async cleanup(): Promise<void> {
    return;
  }

  public async invoke(payload: string): Promise<string> {
    

    return this.context.withTrace({
      message: `Invoke (payload=${JSON.stringify(payload)}).`,
      activity: async () => {
        const index = sandboxRequire(this.filename, {
          context: {
            fs,
            path,
            process: {
              ...process,

              // override process.exit to throw an exception instead of exiting the process
              exit: (exitCode: number) => {
                throw new Error(
                  "process.exit() was called with exit code " + exitCode
                );
              },

              env: {
                ...this.env,
                [ENV_WING_SIM_INFLIGHT_RESOURCE_PATH]: this.context.resourcePath,
                [ENV_WING_SIM_INFLIGHT_RESOURCE_TYPE]: FUNCTION_TYPE,
              }
            },

            // Make the global simulator available to user code so that they can find
            // and use other resource clients
            // TODO: Object.freeze this?
            $simulator: this.context,

            // explicitly DO NOT propagate `console` because inflight
            // function bind console.log to the global $logger object.
          },
          timeout: this.timeout,
        });

        return index.handler(payload);
      },
    });
  }
}

interface RunCodeOptions {
  readonly context: { [key: string]: any };
  readonly timeout: number;
}

/**
 * Requires `filename` into a sandboxed context.

 * @param filename the file to require
 * @param opts the options to use when requiring the file
 */
function sandboxRequire(filename: string, opts: RunCodeOptions) {
  const ctx: any = {};

  // create a copy of all the globals from our current context.
  for (const k of Object.getOwnPropertyNames(global)) {
    ctx[k] = (global as any)[k];
  }

  // append the user's context
  for (const k of Object.keys(opts.context)) {
    ctx[k] = opts.context[k];
  }

  // we are hijacking console.log to log to the inflight $logger so do not propagate
  delete ctx.console;

  // we want to intercept "require" calls and execute the code in the same context so that we can
  // share state between modules within the same inflight VM.
  const makeRequire = (parent: string) =>  {

    const customResolve = (request: string) => {
      return require.resolve(request, { paths: [dirname(parent)] });
    };

    const customRequire = (request: string) => {
      if (Module.isBuiltin(request)) {
        return require(request);
      }

      const filename = customResolve(request);
      const code = fs.readFileSync(filename, "utf-8");
      
      // wrap the module based on https://nodejs.org/api/modules.html#the-module-wrapper
      const wrapped = `(function(exports, require, module, __filename, __dirname) {${code}});`

      // execute this code in the same VM context we used for the inflight entrypoint
      const mod = vm.runInContext(wrapped, context, { timeout: opts.timeout });
      const exports = {};
      mod(exports, makeRequire(filename), module, filename, dirname(filename));
      return exports;
    };

    customRequire.resolve = customResolve;

    return customRequire;
  };

  const context = vm.createContext(ctx);
  const rootRequire = makeRequire(filename);
  return rootRequire(filename);
}
